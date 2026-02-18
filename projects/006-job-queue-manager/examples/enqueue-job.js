/**
 * @file examples/enqueue-job.js
 * @description A client-side example script showing how to make an HTTP request
 * to the API server to create and enqueue new jobs.
 *
 * This script demonstrates various job creation scenarios, including:
 * 1. A simple, immediate job.
 * 2. A job with a future delay.
 * 3. A high-priority job.
 * 4. A job configured to fail and retry.
 * 5. A job that sends a webhook notification on completion.
 *
 * To run this example:
 * 1. Ensure the Job Queue Manager server is running (`npm start server`).
 * 2. Run this script from the project root: `node examples/enqueue-job.js`
 */

// --- Configuration ---

/**
 * The base URL of the Job Queue Manager API server.
 * This should match the host and port where your server is running.
 * It's good practice to use environment variables for this in real applications.
 * @constant {string}
 */
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * The endpoint for creating jobs.
 * @constant {string}
 */
const JOBS_ENDPOINT = `${API_BASE_URL}/jobs`;

// --- Core Function ---

/**
 * Sends a request to the API server to create a new job.
 *
 * @param {object} jobData - The data for the job, conforming to the `createJobSchema`.
 * @returns {Promise<object>} The server's response data on success.
 * @throws {Error} If the request fails or the server returns a non-OK status.
 */
export async function enqueueJob(jobData) {
  console.log(`\n--- Enqueuing job of type: ${jobData.type} ---`);
  console.log('Payload:', JSON.stringify(jobData, null, 2));

  try {
    const response = await fetch(JOBS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(jobData),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      // The server responded with an error status (4xx or 5xx).
      const errorMessage = responseBody.message || `HTTP error! Status: ${response.status}`;
      console.error(`[FAIL] Failed to enqueue job. Server responded with ${response.status}.`);
      console.error('Error details:', responseBody);
      throw new Error(errorMessage);
    }

    console.log('[SUCCESS] Job enqueued successfully!');
    console.log('Server Response:', responseBody);
    return responseBody;
  } catch (error) {
    // A network error occurred, or there was an issue parsing the JSON response.
    console.error('[ERROR] An unexpected error occurred while trying to enqueue the job.');
    console.error('Error:', error.message);
    // Re-throw the error so the calling script can handle it if needed.
    throw error;
  }
}

/**
 * The main execution function that demonstrates enqueuing different types of jobs.
 * This function is called when the script is run directly.
 */
async function main() {
  console.log(`Targeting API server at: ${API_BASE_URL}`);

  // Example 1: A simple job to send a welcome email.
  const simpleJob = {
    type: 'send-welcome-email',
    payload: {
      userId: 'user-123',
      email: 'test@example.com',
    },
  };
  await enqueueJob(simpleJob).catch(() => {}); // Catch to allow script to continue

  // Example 2: A job delayed by 10 seconds.
  const delayedJob = {
    type: 'generate-report',
    payload: {
      reportId: 'report-xyz',
      format: 'pdf',
    },
    delay: 10000, // 10 seconds in milliseconds
  };
  await enqueueJob(delayedJob).catch(() => {});

  // Example 3: A high-priority job that should be processed before others.
  const priorityJob = {
    type: 'process-payment',
    payload: {
      orderId: 'order-456',
      amount: 99.99,
    },
    priority: 10, // Max priority
  };
  await enqueueJob(priorityJob).catch(() => {});

  // Example 4: A job configured to fail on its first attempt to demonstrate retries.
  const retryJob = {
    type: 'sync-external-api',
    payload: {
      apiEndpoint: 'https://example.com/api/data',
      shouldFail: true, // Custom flag for the worker to simulate failure
      executionTime: 500,
    },
    retry: {
      maxAttempts: 3,
      backoff: 2000, // 2-second base backoff
    },
  };
  await enqueueJob(retryJob).catch(() => {});

  // Example 5: A job with a webhook to notify an external service upon completion.
  // For testing, you can use a service like https://webhook.site/
  const webhookJob = {
    type: 'process-image',
    payload: {
      imageId: 'img-789.jpg',
      sourceUrl: 'https://example.com/images/img-789.jpg',
    },
    webhook: {
      url: 'https://webhook.site/d2a3e0f0-c1b2-4d5e-8f6a-9b8c7d6e5f4a', // Replace with your test URL
      headers: {
        'X-Custom-Auth': 'my-secret-token',
      },
    },
  };
  await enqueueJob(webhookJob).catch(() => {});

  console.log('\n--- All example jobs have been submitted. ---');
  console.log('Check the server and worker logs to see them being processed.');
}

// This block checks if the script is being run directly.
// If so, it executes the main demonstration function.
// This allows `enqueueJob` to be imported and used in other scripts without
// automatically running the `main` function.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((err) => {
    console.error('\nScript finished with an error.');
    process.exit(1);
  });
}