/**
 * @file examples/self-monitoring-server.js
 * @description An example of a simple HTTP server that exposes a `/health` endpoint
 *              to report on its own process health using the process-health-checker library.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import http from 'node:http';
import { checkProcessHealth, utils } from '../src/index.js';

// Configuration for the server
const PORT = 3000;
const HOST = '127.0.0.1'; // Binds to localhost by default for security

// The PID of the current process, which we will be monitoring.
const selfPid = process.pid;

/**
 * Handles incoming HTTP requests.
 * It routes requests to the appropriate handler based on the URL.
 *
 * @param {http.IncomingMessage} req - The request object.
 * @param {http.ServerResponse} res - The response object.
 */
async function requestHandler(req, res) {
  const { method, url } = req;
  const requestUrl = new URL(url, `http://${req.headers.host}`);

  console.log(`[${new Date().toISOString()}] Received ${method} request for ${requestUrl.pathname}`);

  try {
    if (requestUrl.pathname === '/health' && method === 'GET') {
      await handleHealthCheck(req, res);
    } else {
      handleNotFound(req, res);
    }
  } catch (error) {
    console.error(`[ERROR] Failed to handle request: ${error.message}`, error.stack);
    handleServerError(req, res);
  }
}

/**
 * Responds to a health check request.
 * It uses the library to get the current process's health and returns it as JSON.
 *
 * @param {http.IncomingMessage} req - The request object.
 * @param {http.ServerResponse} res - The response object.
 */
async function handleHealthCheck(req, res) {
  try {
    const rawHealthStatus = await checkProcessHealth(selfPid);

    // Create a more human-readable response object using the library's utils
    const responsePayload = {
      status: 'ok',
      pid: rawHealthStatus.pid,
      uptime: utils.formatUptime(rawHealthStatus.uptime),
      memory: {
        rss: utils.formatMemory(rawHealthStatus.memory.rss),
        heapTotal: utils.formatMemory(rawHealthStatus.memory.heapTotal),
        heapUsed: utils.formatMemory(rawHealthStatus.memory.heapUsed),
      },
      cpu: {
        userMicroseconds: rawHealthStatus.cpu.user,
        systemMicroseconds: rawHealthStatus.cpu.system,
      },
      // Include raw data for machine consumption
      raw: rawHealthStatus,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responsePayload, null, 2));
  } catch (error) {
    console.error(`[ERROR] Failed to get process health: ${error.message}`);
    // If the health check itself fails, it's a server error.
    handleServerError(req, res, 'Failed to retrieve health status.');
  }
}

/**
 * Responds with a 404 Not Found error for unhandled routes.
 *
 * @param {http.IncomingMessage} req - The request object.
 * @param {http.ServerResponse} res - The response object.
 */
function handleNotFound(req, res) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

/**
 * Responds with a 500 Internal Server Error.
 *
 * @param {http.IncomingMessage} req - The request object.
 * @param {http.ServerResponse} res - The response object.
 * @param {string} [message='Internal Server Error'] - A custom error message.
 */
function handleServerError(req, res, message = 'Internal Server Error') {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Main function to create and start the HTTP server.
 */
function main() {
  const server = http.createServer(requestHandler);

  server.on('error', (err) => {
    console.error(`[FATAL] Server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please choose another port.`);
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Self-monitoring server running on http://${HOST}:${PORT}`);
    console.log(`   Process PID: ${selfPid}`);
    console.log(`   To check health, run: curl http://${HOST}:${PORT}/health`);
    console.log('   Press Ctrl+C to stop the server.');
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    console.log(`\n[INFO] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('[INFO] Server closed. Exiting.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Start the server
main();