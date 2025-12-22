require("dotenv").config();
const Redis = require("ioredis");

const redisUrl = `rediss://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

const redis = new Redis(redisUrl, {
  tls: {
    rejectUnauthorized: false
  }
});

redis.on("connect", () => {
  console.log("✅ Redis connected (Upstash)");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redis.on("ready", async () => {
  try {
    const pong = await redis.ping();
    console.log("✅ Redis ping successful:", pong);
  } catch (err) {
    console.error("❌ Redis ping failed", err);
  }
});

module.exports = redis;
