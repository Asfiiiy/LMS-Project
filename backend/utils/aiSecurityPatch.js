/**
 * AI Security Patch
 * Comprehensive security fixes and monitoring for AI automation system
 */

const pool = require('../config/db');
const AITokenService = require('../services/aiTokenService');
const { logSystemEvent } = require('../utils/eventLogger');
const { validatePermissions } = require('../config/aiPermissions');

class AISecurityPatch {
  /**
   * Fix 1: Revoke tokens with wildcard permissions
   * Wildcard permissions are a security risk
   */
  static async revokeWildcardTokens() {
    try {
      console.log('[Security Patch] Checking for tokens with wildcard permissions...');
      
      const [tokens] = await pool.execute(
        'SELECT id, name, token, permissions FROM ai_tokens WHERE is_revoked = 0 AND is_active = 1'
      );

      let revokedCount = 0;
      for (const token of tokens) {
        try {
          const permissions = typeof token.permissions === 'string' 
            ? JSON.parse(token.permissions) 
            : token.permissions;

          if (permissions && permissions.includes('*')) {
            await AITokenService.revokeToken(
              token.id,
              'Security patch: Wildcard permissions are not allowed'
            );
            revokedCount++;
            console.log(`[Security Patch] Revoked token ${token.id} (${token.name}) - had wildcard permission`);
          }
        } catch (error) {
          console.error(`[Security Patch] Error processing token ${token.id}:`, error);
        }
      }

      console.log(`[Security Patch] Revoked ${revokedCount} tokens with wildcard permissions`);
      return { success: true, revokedCount };
    } catch (error) {
      console.error('[Security Patch] Error revoking wildcard tokens:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix 2: Validate all token permissions against whitelist
   */
  static async validateAllTokenPermissions() {
    try {
      console.log('[Security Patch] Validating all token permissions...');
      
      const [tokens] = await pool.execute(
        'SELECT id, name, permissions FROM ai_tokens WHERE is_revoked = 0'
      );

      let fixedCount = 0;
      let invalidCount = 0;

      for (const token of tokens) {
        try {
          const permissions = typeof token.permissions === 'string' 
            ? JSON.parse(token.permissions) 
            : token.permissions;

          if (!permissions || !Array.isArray(permissions)) {
            continue;
          }

          const validation = validatePermissions(permissions);
          
          if (!validation.valid) {
            // Remove invalid permissions
            const validPermissions = permissions.filter(p => 
              validation.invalidPermissions && !validation.invalidPermissions.includes(p)
            );

            if (validPermissions.length === 0) {
              // No valid permissions left - revoke token
              await AITokenService.revokeToken(
                token.id,
                'Security patch: Token had no valid permissions'
              );
              invalidCount++;
            } else {
              // Update with only valid permissions
              await pool.execute(
                'UPDATE ai_tokens SET permissions = ? WHERE id = ?',
                [JSON.stringify(validPermissions), token.id]
              );
              fixedCount++;
            }
          }
        } catch (error) {
          console.error(`[Security Patch] Error processing token ${token.id}:`, error);
        }
      }

      console.log(`[Security Patch] Fixed ${fixedCount} tokens, revoked ${invalidCount} invalid tokens`);
      return { success: true, fixedCount, invalidCount };
    } catch (error) {
      console.error('[Security Patch] Error validating permissions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix 3: Revoke expired tokens that are still active
   */
  static async revokeExpiredTokens() {
    try {
      console.log('[Security Patch] Checking for expired tokens...');
      
      const [tokens] = await pool.execute(
        `SELECT id, name, expires_at FROM ai_tokens 
         WHERE is_revoked = 0 AND is_active = 1 AND expires_at IS NOT NULL AND expires_at < NOW()`
      );

      let revokedCount = 0;
      for (const token of tokens) {
        await AITokenService.revokeToken(
          token.id,
          'Security patch: Token has expired'
        );
        revokedCount++;
      }

      console.log(`[Security Patch] Revoked ${revokedCount} expired tokens`);
      return { success: true, revokedCount };
    } catch (error) {
      console.error('[Security Patch] Error revoking expired tokens:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix 4: Clean up old IP tracking data (older than 90 days)
   */
  static async cleanupOldIPTracking() {
    try {
      console.log('[Security Patch] Cleaning up old IP tracking data...');
      
      const [result] = await pool.execute(
        `DELETE FROM ai_token_ip_tracking 
         WHERE last_used_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
      );

      console.log(`[Security Patch] Deleted ${result.affectedRows} old IP tracking records`);
      return { success: true, deletedCount: result.affectedRows };
    } catch (error) {
      console.error('[Security Patch] Error cleaning up IP tracking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix 5: Generate security report
   */
  static async generateSecurityReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        tokens: {},
        security: {},
        recommendations: []
      };

      // Token statistics
      const [tokenStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN security_alert_count > 0 THEN 1 ELSE 0 END) as with_alerts
         FROM ai_tokens`
      );

      report.tokens = tokenStats[0];

      // Security statistics
      const [securityStats] = await pool.execute(
        `SELECT 
          COUNT(DISTINCT token_id) as tokens_with_multiple_ips,
          MAX(unique_ip_count) as max_unique_ips,
          AVG(unique_ip_count) as avg_unique_ips
         FROM ai_tokens
         WHERE unique_ip_count > 3`
      );

      report.security = securityStats[0];

      // Recommendations
      if (report.tokens.expired > 0) {
        report.recommendations.push(`Revoke ${report.tokens.expired} expired tokens`);
      }
      if (report.tokens.with_alerts > 0) {
        report.recommendations.push(`Review ${report.tokens.with_alerts} tokens with security alerts`);
      }
      if (report.security.tokens_with_multiple_ips > 0) {
        report.recommendations.push(`Investigate ${report.security.tokens_with_multiple_ips} tokens used from multiple IPs`);
      }

      return { success: true, report };
    } catch (error) {
      console.error('[Security Patch] Error generating report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run all security patches
   */
  static async runAllPatches() {
    console.log('🔒 Starting AI Security Patch...');
    console.log('');

    const results = {
      wildcardTokens: await this.revokeWildcardTokens(),
      validatePermissions: await this.validateAllTokenPermissions(),
      expiredTokens: await this.revokeExpiredTokens(),
      cleanupIPTracking: await this.cleanupOldIPTracking(),
      securityReport: await this.generateSecurityReport()
    };

    console.log('');
    console.log('✅ Security patch completed!');
    console.log('');

    // Log security patch execution
    setImmediate(async () => {
      await logSystemEvent({
        userId: null,
        role: 'system',
        action: 'ai_security_patch_executed',
        description: `Security patch executed: ${JSON.stringify(results)}`,
        req: null
      });
    });

    return results;
  }

  /**
   * Monitor token usage for anomalies
   */
  static async monitorTokenUsage() {
    try {
      // Check for tokens with unusual activity
      const [anomalies] = await pool.execute(
        `SELECT 
          t.id,
          t.name,
          t.usage_count,
          t.unique_ip_count,
          t.security_alert_count,
          COUNT(DISTINCT l.id) as log_count_24h
         FROM ai_tokens t
         LEFT JOIN ai_action_logs l ON t.id = l.token_id AND l.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         WHERE t.is_revoked = 0 AND t.is_active = 1
         GROUP BY t.id
         HAVING log_count_24h > 1000 OR unique_ip_count > 5
         ORDER BY log_count_24h DESC`
      );

      if (anomalies.length > 0) {
        console.warn(`[Security Monitor] Found ${anomalies.length} tokens with unusual activity`);
        return { success: true, anomalies, hasAnomalies: true };
      }

      return { success: true, anomalies: [], hasAnomalies: false };
    } catch (error) {
      console.error('[Security Patch] Error monitoring token usage:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AISecurityPatch;
