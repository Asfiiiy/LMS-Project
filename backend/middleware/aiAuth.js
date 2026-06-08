/**
 * AI Token Authentication Middleware
 * Validates AI tokens for AI automation endpoints
 */

const AITokenService = require('../services/aiTokenService');
const AILogger = require('../services/aiLogger');
const { isValidPermission, validatePermissions } = require('../config/aiPermissions');
const { logSystemEvent } = require('../utils/eventLogger');

/**
 * Middleware to authenticate AI tokens
 * Sets req.aiToken with token data if valid
 */
const aiAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided. AI token required.'
      });
    }

    // Extract token (support both "Bearer <token>" and just "<token>")
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No AI token provided.'
      });
    }

    // Validate token
    const validation = await AITokenService.validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        message: `AI token validation failed: ${validation.reason}`,
        reason: validation.reason
      });
    }

    // Check security alerts
    const securityCheck = await AITokenService.checkSecurityAlerts(token);

    if (securityCheck.hasAlert) {
      // Auto-revoke if high severity
      if (securityCheck.severity === 'high') {
        await AITokenService.revokeTokenByString(
          token,
          `Auto-revoked: ${securityCheck.reason}`
        );

        return res.status(401).json({
          success: false,
          message: 'AI token has been automatically revoked due to security alert.',
          reason: securityCheck.reason,
          autoRevoked: true
        });
      }

      // Log security alert but allow request (medium severity)
      console.warn(`[AIAuth] Security alert for token ${validation.tokenData.name}: ${securityCheck.reason}`);
    }

    // Get client IP
    const ipAddress = req.ip || 
                     req.connection.remoteAddress || 
                     req.headers['x-forwarded-for']?.split(',')[0] || 
                     'unknown';

    // Update token usage
    await AITokenService.updateTokenUsage(token, ipAddress);

    // Attach token data to request
    req.aiToken = validation.tokenData;
    req.aiTokenString = token;
    req.aiTokenIp = ipAddress;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware to check if AI token has specific permission
 * @param {string} permission - Required permission
 */
const aiRequirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.aiToken) {
      return res.status(401).json({
        success: false,
        message: 'AI token not authenticated'
      });
    }

    // Validate permission is in whitelist
    if (!isValidPermission(permission)) {
      // Log invalid permission attempt
      setImmediate(async () => {
        await logSystemEvent({
          userId: req.aiToken.created_by || null,
          role: 'system',
          action: 'ai_permission_invalid',
          description: `Invalid permission requested: ${permission} (Token: ${req.aiToken.name})`,
          req
        });
      });

      return res.status(400).json({
        success: false,
        message: `Invalid permission: ${permission}`
      });
    }

    // Check if token has permission
    if (!AITokenService.hasPermission(req.aiToken, permission)) {
      // Log permission denial
      setImmediate(async () => {
        await logSystemEvent({
          userId: req.aiToken.created_by || null,
          role: 'ai_token',
          action: 'ai_permission_denied',
          description: `Permission denied: ${permission} (Token: ${req.aiToken.name}, Endpoint: ${req.originalUrl})`,
          req
        });
      });

      return res.status(403).json({
        success: false,
        message: `AI token does not have required permission: ${permission}`,
        tokenName: req.aiToken.name,
        requiredPermission: permission
      });
    }

    next();
  };
};

/**
 * Helper function to log AI action and send response
 * Wraps the response to automatically log the action
 */
const aiLogResponse = async (req, res, originalSend) => {
  const startTime = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    const responseTime = Date.now() - startTime;

    // Log the action asynchronously (don't block response)
    setImmediate(async () => {
      try {
        await AILogger.logAction({
          tokenId: req.aiToken?.id,
          tokenName: req.aiToken?.name || 'Unknown',
          actionType: req.aiActionType || 'unknown',
          actionDescription: req.aiActionDescription || `${req.method} ${req.path}`,
          endpoint: req.originalUrl || req.path,
          method: req.method,
          ipAddress: req.aiTokenIp || req.ip || 'unknown',
          userAgent: req.headers['user-agent'],
          requestBody: req.body,
          responseStatus: res.statusCode,
          responseTimeMs: responseTime,
          responseBody: data,
          errorMessage: data.success === false ? data.message : null,
          affectedIds: req.aiAffectedIds || {}
        });
      } catch (error) {
        // no-op
      }
    });

    return originalJson(data);
  };

  return originalSend;
};

module.exports = {
  aiAuth,
  aiRequirePermission,
  aiLogResponse
};
