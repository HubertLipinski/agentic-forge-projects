/**
 * @file src/proxy-handler.js
 * @description Core request handler for the proxy server. Intercepts requests, forwards them to OpenAI, and logs the entire interaction.
 *
 * This module is the heart of the LLM Log Streamer. It uses `undici` for high-performance
 * HTTP forwarding. It's designed to handle both standard and streaming API responses from
 * OpenAI, meticulously logging every part of the request/response lifecycle.
 */

import { randomUUID } from 'node:crypto';
import { pipeline, Readable } from 'node:stream';
import { promisify } from 'node:util';
import { request as undiciRequest } from 'undici';
import { getLogger } from '../logger.js';
import { getConfig } from './utils/config.js';

const streamPipeline = promisify(pipeline);
const logger = getLogger();
const { openaiTarget } = getConfig();

/**
 * Parses the body of an incoming HTTP request.
 * Supports JSON and other text-based formats.
 *
 * @param {import('http').IncomingMessage} req - The incoming request object.
 * @returns {Promise<string | object>} The parsed body (object for JSON, string otherwise).
 */
async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const bodyBuffer = Buffer.concat(chunks);
  const bodyString = bodyBuffer.toString('utf-8');

  if (!bodyString) {
    return null;
  }

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyString);
    } catch (error) {
      logger.warn('Failed to parse request body as JSON, treating as text.', {
        error: error.message,
      });
      return bodyString;
    }
  }

  return bodyString;
}

/**
 * Calculates token usage based on the OpenAI response body.
 * For non-streaming responses, it's directly available in `body.usage`.
 * For streaming responses, it sums up the `usage` from the last chunk.
 *
 * @param {object} body - The response body.
 * @param {boolean} isStream - Whether the response was streamed.
 * @returns {object | null} An object with { prompt_tokens, completion_tokens, total_tokens } or null.
 */
function calculateTokenUsage(body, isStream) {
  if (!body) return null;

  if (!isStream && body.usage) {
    return body.usage;
  }

  if (isStream && Array.isArray(body) && body.length > 0) {
    const lastChunk = body[body.length - 1];
    if (lastChunk?.usage) {
      return lastChunk.usage;
    }
  }

  return null;
}

/**
 * Handles streaming responses by piping the upstream response to the client
 * and simultaneously capturing the data for logging.
 *
 * @param {import('http').ServerResponse} clientRes - The response object for the original client.
 * @param {import('undici').Dispatcher.ResponseData} upstreamRes - The response from the OpenAI API.
 * @param {object} logContext - The context object for logging.
 * @returns {Promise<object[]>} A promise that resolves with an array of parsed stream chunks.
 */
async function handleStreamingResponse(clientRes, upstreamRes, logContext) {
  const capturedChunks = [];
  const upstreamBody = upstreamRes.body;

  // Create a Tee stream. It forwards data to the client response and also allows us to capture it.
  const passthrough = new Readable({
    async read() {
      for await (const chunk of upstreamBody) {
        try {
          const chunkString = chunk.toString('utf-8');
          // OpenAI streams are Server-Sent Events (SSE). We parse them to extract the JSON data.
          const lines = chunkString
            .split('\n')
            .filter((line) => line.startsWith('data: '));

          for (const line of lines) {
            const jsonData = line.substring('data: '.length).trim();
            if (jsonData === '[DONE]') {
              capturedChunks.push({ special_event: 'DONE' });
              continue;
            }
            capturedChunks.push(JSON.parse(jsonData));
          }
        } catch (error) {
          logger.warn('Failed to parse stream chunk for logging', {
            reqId: logContext.reqId,
            error: error.message,
          });
          // Still push the raw chunk to not lose data.
          capturedChunks.push({ raw_chunk: chunk.toString('utf-8') });
        }

        // Push the original chunk to the client.
        if (!this.push(chunk)) {
          // Handle backpressure if needed, though pipeline should manage this.
          await new Promise((resolve) => upstreamBody.once('readable', resolve));
        }
      }
      // Signal end of stream.
      this.push(null);
    },
  });

  // Use pipeline to ensure streams are properly handled and closed.
  await streamPipeline(passthrough, clientRes);

  return capturedChunks;
}

/**
 * The main request handler for the proxy server.
 * It intercepts a client request, forwards it to the OpenAI API,
 * captures both the request and response, logs them, and then sends
 * the response back to the client.
 *
 * @param {import('http').IncomingMessage} req - The incoming request from the client.
 * @param {import('http').ServerResponse} res - The response object to send back to the client.
 */
export async function proxyHandler(req, res) {
  const reqId = randomUUID();
  const startTime = process.hrtime.bigint();

  const logContext = {
    reqId,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
    },
  };

  try {
    const requestBody = await parseRequestBody(req);
    logContext.req.body = requestBody;

    const targetUrl = new URL(req.url, openaiTarget);

    // Forward the request to the OpenAI API using undici
    const upstreamRes = await undiciRequest(targetUrl.href, {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host, // Set the host header to the target's host
      },
      body: requestBody ? JSON.stringify(requestBody) : null,
      // Allow undici to handle streaming responses
      bodyTimeout: 0,
      headersTimeout: 0,
    });

    logContext.res = {
      statusCode: upstreamRes.statusCode,
      headers: upstreamRes.headers,
    };

    // Write upstream headers and status code to the client response
    res.statusCode = upstreamRes.statusCode;
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      // The 'transfer-encoding' header is managed by Node.js and should not be set manually.
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    }

    const isStream =
      requestBody?.stream === true ||
      upstreamRes.headers['content-type']?.includes('text/event-stream');

    if (isStream) {
      logContext.res.body = await handleStreamingResponse(
        res,
        upstreamRes,
        logContext,
      );
    } else {
      const responseBodyText = await upstreamRes.body.text();
      try {
        logContext.res.body = responseBodyText
          ? JSON.parse(responseBodyText)
          : null;
      } catch (e) {
        logContext.res.body = responseBodyText; // Log as raw text if not JSON
      }
      res.end(responseBodyText);
    }

    const endTime = process.hrtime.bigint();
    logContext.timing = {
      totalMs: Number(endTime - startTime) / 1_000_000,
    };

    logContext.usage = calculateTokenUsage(logContext.res.body, isStream);

    logger.info('OpenAI API call processed', logContext);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Log the error with as much context as possible
    logger.error('Error processing proxy request', {
      ...logContext,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      timing: { totalMs: durationMs },
    });

    // Send a generic error response to the client
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    if (!res.writableEnded) {
      res.end(
        JSON.stringify({
          error: {
            message: 'An internal proxy error occurred.',
            type: 'proxy_error',
            reqId,
          },
        }),
      );
    }
  }
}