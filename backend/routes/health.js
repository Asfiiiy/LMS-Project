// backend/routes/health.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const redis = require("../config/redis");
const os = require("os");
const fs = require("fs");
const version = require('../version.json');
const metrics = require('../utils/metrics');

/**
 * Bounded MySQL + Redis checks (fail fast under pool saturation).
 */
async function healthCheckCore() {
  const results = await Promise.allSettled([
    Promise.race([
      pool.execute("SELECT 1"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MySQL health timeout")), 3000)
      )
    ]),
    Promise.race([
      redis.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis health timeout")), 2000)
      )
    ])
  ]);

  return {
    mysql: results[0].status === "fulfilled" ? "connected" : "timeout",
    redis: results[1].status === "fulfilled" ? "connected" : "timeout",
    mysqlError:
      results[0].status === "rejected"
        ? String(results[0].reason?.message || results[0].reason)
        : null,
    redisError:
      results[1].status === "rejected"
        ? String(results[1].reason?.message || results[1].reason)
        : null
  };
}

/**
 * Health check endpoint
 */
router.get("/", async (req, res) => {
  const healthTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(200).json({
        status: "degraded",
        message: "Health check timeout",
        timestamp: new Date().toISOString()
      });
    }
  }, 5000);

  const start = Date.now();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptime_seconds: process.uptime(), // Keep for backward compatibility
    responseTime: null, // Will calculate after checks
    response_time_ms: 0, // Keep for backward compatibility
    version: {
      number: version.version,
      releaseDate: version.releaseDate,
      notes: version.notes
    },
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      cpu_cores: os.cpus().length,
      load_avg: os.loadavg()
    },
    checks: {
      database: { status: "unknown", error: null },
      redis: { status: "unknown", error: null },
      memory: { used: null, total: null, usage_percent: null },
      disk: { status: "unknown", error: null },
      sockets: { status: "unknown", value: null, error: null },
      queue: {
        pending: 0,
        failed: 0,
        running: 0
      },
      apiMetrics: metrics.getMetrics()
    }
  };

  try {
    const core = await healthCheckCore();
    if (core.mysql === "connected") {
      health.checks.database.status = "ok";
    } else {
      health.checks.database.status = "error";
      health.checks.database.error = core.mysqlError || "timeout";
      health.status = "degraded";
    }
    if (core.redis === "connected") {
      health.checks.redis.status = "ok";
    } else {
      health.checks.redis.status = "error";
      health.checks.redis.error = core.redisError || "timeout";
      health.status = "degraded";
    }
  } catch (err) {
    health.checks.database.status = "error";
    health.checks.database.error = err.message;
    health.checks.redis.status = "error";
    health.checks.redis.error = err.message;
    health.status = "degraded";
  }

  // === MEMORY CHECK ===
  try {
    const m = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Node.js Process Memory (Heap)
    health.checks.memory.process_heap_used = (m.heapUsed / 1024 / 1024).toFixed(2) + " MB";
    health.checks.memory.process_heap_total = (m.heapTotal / 1024 / 1024).toFixed(2) + " MB";
    health.checks.memory.process_heap_percent = (
      (m.heapUsed / m.heapTotal) * 100
    ).toFixed(1) + "%";
    
    // System Memory (Total RAM)
    health.checks.memory.system_total = (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB";
    health.checks.memory.system_used = (usedMem / 1024 / 1024 / 1024).toFixed(2) + " GB";
    health.checks.memory.system_free = (freeMem / 1024 / 1024 / 1024).toFixed(2) + " GB";
    health.checks.memory.system_usage_percent = (
      (usedMem / totalMem) * 100
    ).toFixed(1) + "%";
    
    // Legacy fields for backward compatibility
    health.checks.memory.used = (m.heapUsed / 1024 / 1024).toFixed(2) + " MB";
    health.checks.memory.total = (m.heapTotal / 1024 / 1024).toFixed(2) + " MB";
    health.checks.memory.usage_percent = (
      (m.heapUsed / m.heapTotal) * 100
    ).toFixed(1) + "%";
  } catch (err) {
    health.checks.memory.error = err.message;
    health.status = "degraded";
  }

  // === DISK CHECK (simple check) ===
  try {
    fs.statSync("/");
    health.checks.disk.status = "ok";
  } catch (err) {
    health.checks.disk.status = "error";
    health.checks.disk.error = err.message;
    health.status = "degraded";
  }

  // === SOCKET CONNECTION COUNT ===
  try {
    const io = req.app.get("io");
    if (io && io.engine) {
      health.checks.sockets.status = "ok";
      health.checks.sockets.value = io.engine.clientsCount;
    }
  } catch (err) {
    health.checks.sockets.status = "error";
    health.checks.sockets.error = err.message;
    health.status = "degraded";
  }

  // === RESPONSE TIME ===
  health.responseTime = Date.now() - start;
  health.response_time_ms = health.responseTime; // Keep for backward compatibility

  if (res.headersSent) return;
  clearTimeout(healthTimeout);
  const code = health.status === "ok" ? 200 : 503;
  res.status(code).json(health);
});

module.exports = router;

