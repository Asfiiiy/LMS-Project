let errorsLast24h = 0;
let loginFailures = 0;
let rateLimitBlocks = 0;

module.exports = {
  recordError() {
    errorsLast24h++;
  },

  recordLoginFailure() {
    loginFailures++;
  },

  recordRateLimitBlock() {
    rateLimitBlocks++;
  },

  getMetrics() {
    return {
      errorsLast24h,
      loginFailures,
      rateLimitBlocks
    };
  }
};

