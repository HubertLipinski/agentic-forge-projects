/**
 * @file src/server.js
 * @description The main Fastify API server entry point.
 * This file is responsible for initializing the Fastify server, configuring logging,
 * registering plugins and routes, setting up schema validation, and implementing
 * a graceful shutdown mechanism. It serves as the primary interface for clients
 * to interact with the job queue.
 */

import Fastify from 'fastify';
import pino from 'pino';
import redisClient from './config/redis.js';
import ajv from './config/ajv.js';
import jobRoutes from './routes/jobs.js';

// --- Constants ---
const SERVER_PORT = process.env.SERVER_PORT || 3000;
const SERVER_HOST = process.env.SERVER_HOST || '127.0.0.1';
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Creates and configures the main Fastify server instance.
 *
 * @returns {import('fastify').FastifyInstance} The configured Fastify server instance.
 */
function buildServer() {
  // Configure Pino logger for Fastify.
  // In production, you might want to remove the 'pino-pretty' transport
  // for better performance and structured JSON logging.
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              ignore: 'pid,hostname,reqId,req,res',
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            },
          }
        : undefined,
  });

  const server = Fastify({
    logger,
    // Generate unique request IDs for better traceability in logs.
    genReqId: () => crypto.randomUUID(),
    // Disable trustProxy by default for security. Set to `true` if behind a trusted proxy.
    trustProxy: false,
  });

  // --- Schema Configuration ---
  // Set the custom Ajv instance as the schema validator for Fastify.
  // This ensures consistent validation behavior across the application.
  server.setValidatorCompiler(({ schema }) => ajv.compile(schema));

  // Add a shared error schema to be referenced by routes ($ref: 'errorSchema#').
  // This promotes consistency in error responses.
  server.addSchema({
    $id: 'errorSchema',
    type: 'object',
    properties: {
      statusCode: { type: 'number' },
      error: { type: 'string' },
      message: { type: 'string' },
    },
  });

  // --- Route Registration ---
  // Register all job-related routes under the `/jobs` prefix.
  server.register(jobRoutes, { prefix: '/jobs' });

  // --- Health Check Route ---
  // A simple, un-prefixed route for monitoring services to check server liveness.
  server.get('/health', { logLevel: 'silent' }, async (request, reply) => {
    return reply.code(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return server;
}

/**
 * Starts the Fastify server and handles graceful shutdown.
 *
 * @param {import('fastify').FastifyInstance} server - The Fastify server instance to start.
 */
async function startServer(server) {
  try {
    // Ensure the Redis client is connected before the server starts accepting requests.
    await redisClient.connect();
    server.log.info('Redis client connected successfully for the server.');

    // Start listening for incoming requests.
    await server.listen({ port: SERVER_PORT, host: SERVER_HOST });

    // Log server address after it has successfully started.
    const addresses = server.addresses().map(addr => `http://${addr.address}:${addr.port}`);
    server.log.info(`Server listening at: ${addresses.join(', ')}`);
  } catch (err) {
    server.log.fatal({ err }, 'Server failed to start.');
    await redisClient.quit().catch(e => server.log.error(e, 'Failed to quit Redis on startup error.'));
    process.exit(1);
  }
}

/**
 * Registers signal handlers to gracefully shut down the server.
 *
 * @param {import('fastify').FastifyInstance} server - The Fastify server instance.
 */
function setupGracefulShutdown(server) {
  const signals = ['SIGINT', 'SIGTERM'];

  const shutdown = async (signal) => {
    server.log.info(`Received ${signal}. Initiating graceful shutdown...`);

    // Use a timeout to force exit if shutdown takes too long.
    const shutdownTimeout = setTimeout(() => {
      server.log.warn(`Graceful shutdown timed out after ${GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
      process.exit(1);
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

    try {
      // Stop accepting new connections.
      await server.close();
      server.log.info('Fastify server closed successfully.');

      // Disconnect from Redis.
      await redisClient.quit();
      server.log.info('Redis client disconnected successfully.');
    } catch (err) {
      server.log.error({ err }, 'Error during graceful shutdown.');
    } finally {
      clearTimeout(shutdownTimeout);
      server.log.info('Graceful shutdown complete.');
      process.exit(0);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => shutdown(signal));
  });
}

/**
 * The main entry point for starting the API server.
 * It builds the server, sets up shutdown handlers, and starts listening.
 */
export async function start() {
  const server = buildServer();
  setupGracefulShutdown(server);
  await startServer(server);
}