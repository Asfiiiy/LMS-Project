/**
 * AI Token Service
 * Handles generation, validation, and management of AI tokens
 */

const crypto = require('crypto');
const pool = require('../config/db');
const geoip = require('geoip-lite');

// Token encryption key (should be in .env in production)
const ENCRYPTION_KEY = process.env.AI_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt token (optional - for additional security)
 */
const encryptToken = (text) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32), 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    return null;
  }
};

/**
 * Decrypt token (optional - for additional security)
 */
const decryptToken = (encryptedData) => {
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.substring(0, 32), 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
};

class AITokenService {
  /**
   * Generate a new AI token
   * @param {Object} options - Token options
   * @param {string} options.name - Token name
   * @param {string} options.description - Token description
   * @param {number} options.createdBy - Admin user ID who created the token
   * @param {Date} options.expiresAt - Expiration date (null for no expiration)
   * @param {Array} options.permissions - Array of permissions
   * @param {number} options.rateLimit - Rate limit per minute
   * @returns {Promise<Object>} Created token object
   */
  static async generateToken(options) {
    const { name, description, createdBy, expiresAt, permissions, rateLimit = 60 } = options;

    // Generate secure random token using cryptographically secure random bytes
    // Increased entropy: 64 bytes (512 bits) for better security
    const randomBytes = crypto.randomBytes(64);
    const token = `ai_tok_${randomBytes.toString('hex')}`;
    
    // Token is now 128 hex characters (512 bits) - very secure

    try {
      const [result] = await pool.execute(
        `INSERT INTO ai_tokens 
         (token, name, description, created_by, expires_at, permissions, rate_limit_per_minute) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          token,
          name,
          description || null,
          createdBy,
          expiresAt || null,
          permissions ? JSON.stringify(permissions) : null,
          rateLimit
        ]
      );

      const [rows] = await pool.execute(
        'SELECT * FROM ai_tokens WHERE id = ?',
        [result.insertId]
      );

      return {
        success: true,
        token: rows[0]
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate an AI token
   * @param {string} token - Token to validate
   * @returns {Promise<Object>} Token validation result
   */
  static async validateToken(token) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM ai_tokens WHERE token = ?',
        [token]
      );

      if (rows.length === 0) {
        return { valid: false, reason: 'Token not found' };
      }

      const tokenData = rows[0];

      // Check if token is revoked
      if (tokenData.is_revoked) {
        return { 
          valid: false, 
          reason: 'Token has been revoked',
          revokedAt: tokenData.revoked_at,
          revokedReason: tokenData.revoked_reason
        };
      }

      // Check if token is active
      if (!tokenData.is_active) {
        return { valid: false, reason: 'Token is inactive' };
      }

      // Check expiration
      if (tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();
        if (now > expiresAt) {
          return { valid: false, reason: 'Token has expired' };
        }
      }

      return { valid: true, tokenData };
    } catch (error) {
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Update token usage (last_used_at, usage_count, last_used_ip)
   * @param {string} token - Token string
   * @param {string} ipAddress - IP address that used the token
   */
  static async updateTokenUsage(token, ipAddress) {
    try {
      // Get token ID
      const [tokenRows] = await pool.execute(
        'SELECT id FROM ai_tokens WHERE token = ?',
        [token]
      );

      if (tokenRows.length === 0) return;

      const tokenId = tokenRows[0].id;

      // Update token usage
      await pool.execute(
        `UPDATE ai_tokens 
         SET last_used_at = NOW(), 
             last_used_ip = ?,
             usage_count = usage_count + 1
         WHERE id = ?`,
        [ipAddress, tokenId]
      );

      // Track IP usage for security monitoring
      const geo = geoip.lookup(ipAddress);
      await pool.execute(
        `INSERT INTO ai_token_ip_tracking (token_id, ip_address, country_code, country_name, usage_count)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           last_used_at = NOW(),
           usage_count = usage_count + 1`,
        [
          tokenId,
          ipAddress,
          geo?.country || null,
          geo?.country || null
        ]
      );

      // Update unique IP count
      const [ipCount] = await pool.execute(
        'SELECT COUNT(DISTINCT ip_address) as count FROM ai_token_ip_tracking WHERE token_id = ?',
        [tokenId]
      );

      await pool.execute(
        'UPDATE ai_tokens SET unique_ip_count = ? WHERE id = ?',
        [ipCount[0].count, tokenId]
      );
    } catch (error) {
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Check for security alerts (multiple IPs, unusual patterns)
   * @param {string} token - Token string
   * @returns {Promise<Object>} Security check result
   */
  static async checkSecurityAlerts(token) {
    try {
      const [tokenRows] = await pool.execute(
        'SELECT id, unique_ip_count FROM ai_tokens WHERE token = ?',
        [token]
      );

      if (tokenRows.length === 0) {
        return { hasAlert: false };
      }

      const tokenId = tokenRows[0].id;
      const uniqueIpCount = tokenRows[0].unique_ip_count;

      // Alert if token is used from more than 3 unique IPs (potential exposure)
      if (uniqueIpCount > 3) {
        // Increment security alert count
        await pool.execute(
          `UPDATE ai_tokens 
           SET security_alert_count = security_alert_count + 1,
               last_security_alert_at = NOW()
           WHERE id = ?`,
          [tokenId]
        );

        return {
          hasAlert: true,
          severity: 'high',
          reason: `Token used from ${uniqueIpCount} different IP addresses. Possible token exposure.`,
          uniqueIpCount
        };
      }

      // Check for rapid usage from different IPs (within short time)
      const [recentIps] = await pool.execute(
        `SELECT COUNT(DISTINCT ip_address) as count 
         FROM ai_token_ip_tracking 
         WHERE token_id = ? 
         AND first_used_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
        [tokenId]
      );

      if (recentIps[0].count > 2) {
        await pool.execute(
          `UPDATE ai_tokens 
           SET security_alert_count = security_alert_count + 1,
               last_security_alert_at = NOW()
           WHERE id = ?`,
          [tokenId]
        );

        return {
          hasAlert: true,
          severity: 'medium',
          reason: `Token used from ${recentIps[0].count} different IPs in the last hour.`,
          recentIpCount: recentIps[0].count
        };
      }

      return { hasAlert: false };
    } catch (error) {
      return { hasAlert: false };
    }
  }

  /**
   * Revoke a token
   * @param {number} tokenId - Token ID
   * @param {string} reason - Reason for revocation
   * @returns {Promise<boolean>} Success status
   */
  static async revokeToken(tokenId, reason = 'Manually revoked by admin') {
    try {
      await pool.execute(
        `UPDATE ai_tokens 
         SET is_revoked = TRUE,
             is_active = FALSE,
             revoked_at = NOW(),
             revoked_reason = ?
         WHERE id = ?`,
        [reason, tokenId]
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke token by token string
   * @param {string} token - Token string
   * @param {string} reason - Reason for revocation
   * @returns {Promise<boolean>} Success status
   */
  static async revokeTokenByString(token, reason = 'Security alert: Token exposure detected') {
    try {
      const [tokenRows] = await pool.execute(
        'SELECT id FROM ai_tokens WHERE token = ?',
        [token]
      );

      if (tokenRows.length === 0) {
        return false;
      }

      return await this.revokeToken(tokenRows[0].id, reason);
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate token - generate new token and revoke old one
   * @param {number} tokenId - Token ID to rotate
   * @param {number} createdBy - Admin user ID performing rotation
   * @returns {Promise<Object>} New token object
   */
  static async rotateToken(tokenId, createdBy) {
    try {
      // Get existing token
      const token = await this.getTokenById(tokenId);
      if (!token) {
        throw new Error('Token not found');
      }

      // Generate new token with same permissions
      const newTokenResult = await this.generateToken({
        name: `${token.name} (Rotated)`,
        description: `Rotated from token ID ${tokenId}`,
        createdBy,
        expiresAt: token.expires_at ? new Date(token.expires_at) : null,
        permissions: typeof token.permissions === 'string' 
          ? JSON.parse(token.permissions) 
          : token.permissions,
        rateLimit: token.rate_limit_per_minute
      });

      // Revoke old token
      await this.revokeToken(tokenId, 'Token rotated - replaced with new token');

      return {
        success: true,
        oldTokenId: tokenId,
        newToken: newTokenResult.token
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all tokens (for admin)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of tokens
   */
  static async getAllTokens(filters = {}) {
    try {
      let query = 'SELECT * FROM ai_tokens WHERE 1=1';
      const params = [];

      if (filters.isActive !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.isActive);
      }

      if (filters.isRevoked !== undefined) {
        query += ' AND is_revoked = ?';
        params.push(filters.isRevoked);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get token by ID
   * @param {number} tokenId - Token ID
   * @returns {Promise<Object|null>} Token object
   */
  static async getTokenById(tokenId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM ai_tokens WHERE id = ?',
        [tokenId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if token has permission
   * @param {Object} tokenData - Token data object
   * @param {string} permission - Permission to check
   * @returns {boolean} Has permission
   */
  static hasPermission(tokenData, permission) {
    if (!tokenData.permissions) {
      return false; // No permissions = no access
    }

    try {
      const permissions = typeof tokenData.permissions === 'string' 
        ? JSON.parse(tokenData.permissions) 
        : tokenData.permissions;

      // Validate permission is in whitelist (import at top of file)
      const { isValidPermission } = require('../config/aiPermissions');
      
      // Reject wildcard permissions for security
      if (permissions.includes('*')) {
        return false;
      }

      // Check for exact match only
      return permissions.includes(permission) && isValidPermission(permission);
    } catch (error) {
      return false;
    }
  }
}

module.exports = AITokenService;
