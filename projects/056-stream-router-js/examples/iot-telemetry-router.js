/**
 * @file examples/iot-telemetry-router.js
 * @description Example script showing how to route IoT sensor data (in JSON format)
 * from a source stream to different processing streams based on sensor ID or value thresholds.
 *
 * To run this example:
 * `node examples/iot-telemetry-router.js`
 *
 * This script simulates an IoT device sending telemetry data as a stream of JSON objects.
 * The StreamRouter is configured to:
 * 1. Route data from 'temp-sensor-01' to a dedicated handler.
 * 2. Route any temperature readings above 90.0 to a high-temperature alert handler.
 * 3. Route any humidity readings above 75.0 to a high-humidity alert handler.
 * 4. Send all other data to a default "catch-all" log.
 * 5. It also demonstrates the `passThrough` option by logging all data that passes through the router.
 */

import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { createStreamRouter } from '../index.js';

const pipelineAsync = promisify(pipeline);

/**
 * Simulates a stream of IoT telemetry data.
 * In a real application, this could be from an MQTT client, a WebSocket, or an HTTP request stream.
 * @returns {Readable} A readable stream in object mode that emits sensor data.
 */
function createTelemetrySource() {
  const telemetryData = [
    { sensorId: 'temp-sensor-01', type: 'temperature', value: 22.5, unit: 'C' },
    { sensorId: 'humidity-sensor-01', type: 'humidity', value: 45.2, unit: '%' },
    { sensorId: 'temp-sensor-02', type: 'temperature', value: 95.1, unit: 'C' }, // High temp alert
    { sensorId: 'temp-sensor-01', type: 'temperature', value: 23.1, unit: 'C' },
    { sensorId: 'pressure-sensor-01', type: 'pressure', value: 1012.5, unit: 'hPa' }, // Default route
    { sensorId: 'humidity-sensor-02', type: 'humidity', value: 80.0, unit: '%' }, // High humidity alert
    { sensorId: 'temp-sensor-02', type: 'temperature', value: 34.7, unit: 'C' },
    { sensorId: 'temp-sensor-01', type: 'temperature', value: 22.8, unit: 'C' },
  ];

  return Readable.from(telemetryData, { objectMode: true });
}

/**
 * Creates a simple Writable stream for demonstration purposes.
 * This stream logs the data it receives with a custom prefix.
 * @param {string} name - A name to identify the destination in log output.
 * @returns {Writable} A writable stream in object mode.
 */
function createLogDestination(name) {
  return new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      console.log(`[${name}] Received data:`, JSON.stringify(chunk));
      callback();
    },
  });
}

/**
 * Main function to set up and run the IoT telemetry routing pipeline.
 */
async function main() {
  console.log('--- IoT Telemetry Router Example ---');
  console.log('Simulating a stream of sensor data and routing it based on content...\n');

  // 1. Create the source stream
  const source = createTelemetrySource();

  // 2. Create destination streams for different routing paths
  const tempSensor01Dest = createLogDestination('Temp Sensor 01 Handler');
  const highTempAlertDest = createLogDestination('High Temperature Alert');
  const highHumidityAlertDest = createLogDestination('High Humidity Alert');
  const defaultDest = createLogDestination('Default Log');
  const passthroughDest = createLogDestination('Passthrough Monitor');

  try {
    // 3. Define the routing rules using JSONPath expressions
    const rules = [
      {
        name: 'route-temp-sensor-01',
        type: 'jsonpath',
        // Matches any object where sensorId is 'temp-sensor-01'
        expression: '$[?(@.sensorId === "temp-sensor-01")]',
        destination: tempSensor01Dest,
      },
      {
        name: 'alert-high-temperature',
        type: 'jsonpath',
        // Matches any object where type is 'temperature' AND value is greater than 90
        expression: '$[?(@.type === "temperature" && @.value > 90)]',
        destination: highTempAlertDest,
      },
      {
        name: 'alert-high-humidity',
        type: 'jsonpath',
        // Matches any object where type is 'humidity' AND value is greater than 75
        expression: '$[?(@.type === "humidity" && @.value > 75)]',
        destination: highHumidityAlertDest,
      },
    ];

    // 4. Create the StreamRouter instance
    const router = createStreamRouter({
      rules,
      objectMode: true, // We are processing JavaScript objects
      defaultDestination: defaultDest, // Route unmatched data here
      passThrough: true, // Allow data to flow through the router to another stream
    });

    // Handle any errors that occur within the router stream itself
    router.on('error', (error) => {
      console.error('Error in StreamRouter:', error);
    });

    // 5. Set up the stream pipeline
    // source -> router -> passthroughDest
    // The router also fans out to the destinations defined in the rules.
    await pipelineAsync(source, router, passthroughDest);

    console.log('\n--- Pipeline finished successfully ---');

    // 6. Display metrics from the router
    const metrics = router.getMetrics();
    console.log('\n--- StreamRouter Metrics ---');
    console.log(JSON.stringify(metrics, null, 2));

  } catch (error) {
    console.error('An error occurred during the pipeline execution:', error);
    process.exitCode = 1;
  }
}

main();