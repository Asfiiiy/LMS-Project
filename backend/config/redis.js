const path = require("path");
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const Redis = require("ioredis");

// Use REDIS_URL if available, otherwise build from components
let redisUrl;
if (process.env.REDIS_URL) {
  redisUrl = process.env.REDIS_URL.replace(/^["']|["']$/g, '');
} else {
  // Build URL with 'default' username for Upstash
  const redisPassword = (process.env.REDIS_PASSWORD || '').replace(/^["']|["']$/g, '');
  redisUrl = `rediss://default:${encodeURIComponent(redisPassword)}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
}

const redis = new Redis(redisUrl, {
  tls: {
    rejectUnauthorized: false
  },
  connectTimeout: parseInt(
    process.env.REDIS_CONNECT_TIMEOUT_MS || "10000",
    10
  ),
  commandTimeout: parseInt(
    process.env.REDIS_COMMAND_TIMEOUT_MS || "5000",
    10
  ),
  // Env was often set to 1; that fails every command while reconnecting. Floor at 10.
  maxRetriesPerRequest: Math.max(
    parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || "20", 10) || 20,
    10
  ),
  // Briefly queue commands while reconnecting after idle disconnect (Upstash, etc.)
  enableOfflineQueue: true,
  keepAlive: parseInt(process.env.REDIS_KEEPALIVE_MS || "30000", 10),
  // Never return null here — that stops all reconnection forever after a few failures.
  retryStrategy(times) {
    const delay = Math.min(times * 200, 30000);
    if (times === 1 || times % 20 === 0) {
      console.warn(`[Redis] reconnect scheduled (attempt ${times}), delay ${delay}ms`);
    }
    return delay;
  },
  reconnectOnError(err) {
    const msg = err.message || "";
    if (msg.includes("Connection is closed")) return true;
    if (msg.includes("READONLY")) return true;
    return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE"].some(
      (code) => msg.includes(code)
    );
  }
});

redis.on("connect", () => {
  console.log("✅ Redis connected (Upstash)");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redis.on("close", () => {
  console.warn("[Redis] connection closed (will retry via retryStrategy)");
});

redis.on("reconnecting", (delay) => {
  console.warn(`[Redis] reconnecting in ${delay}ms`);
});

redis.on("ready", () => {
  // Removed ping to reduce Redis usage - connection is ready
  console.log("✅ Redis ready (connection established)");
});

/**
 * Non-critical Redis work: bounded wait, never block callers indefinitely.
 * Clears the timeout when work finishes first, and absorbs late rejections from
 * the losing branch so Node does not emit PromiseRejectionHandledWarning.
 */
async function safeRedis(fn, fallback = null) {
  let timer;
  const work = Promise.resolve().then(() => fn());
  try {
    const result = await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("safeRedis timeout")),
          2000
        );
      })
    ]);
    return result;
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
    work.catch(() => {});
  }
}

redis.safeRedis = safeRedis;
module.exports = redis;
