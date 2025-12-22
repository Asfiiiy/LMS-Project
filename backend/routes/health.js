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
 * Health check endpoint
 */
router.get("/", async (req, res) => {
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

  // === DATABASE CHECK ===
  try {
    await pool.execute("SELECT 1");
    health.checks.database.status = "ok";
  } catch (err) {
    health.checks.database.status = "error";
    health.checks.database.error = err.message;
    health.status = "degraded";
  }

  // === REDIS CHECK ===
  try {
    await redis.ping();
    health.checks.redis.status = "ok";
  } catch (err) {
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

  const code = health.status === "ok" ? 200 : 503;
  res.status(code).json(health);
});

module.exports = router;

