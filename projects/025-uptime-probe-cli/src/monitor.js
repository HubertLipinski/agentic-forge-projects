import { performProbe } from './probe.js';
import {
  loadState,
  saveState,
  createInitialEndpointState,
  updateEndpointState,
} from './utils/state.js';
import {
  renderDashboard,
  startSpinner,
  stopSpinner,
  stopAllSpinners,
  showGoodbyeMessage,
  showStateSavedMessage,
} from './utils/display.js';

/**
 * @typedef {import('./utils/config-loader.js').ProbeConfig} ProbeConfig
 * @typedef {import('./utils/state.js').MonitoringState} MonitoringState
 */

/**
 * The main orchestrator for the monitoring process. It manages the application
 * state, schedules probes, and triggers UI updates.
 */
class Monitor {
  /** @type {ProbeConfig} */
  #config;
  /** @type {MonitoringState} */
  #state;
  /** @type {NodeJS.Timeout|null} */
  #timerId = null;
  /** @type {boolean} */
  #isFirstRun = true;
  /** @type {boolean} */
  #isShuttingDown = false;

  /**
   * @param {ProbeConfig} config The validated application configuration.
   * @param {MonitoringState} initialState The initial state loaded from the state file.
   */
  constructor(config, initialState) {
    this.#config = config;
    this.#state = this.#initializeState(initialState);
  }

  /**
   * Initializes the monitoring state by merging the loaded state with the
   * current configuration. Endpoints not present in the loaded state are
   * given a default initial state.
   *
   * @param {MonitoringState} loadedState State loaded from the persistence file.
   * @returns {MonitoringState} The synchronized and ready-to-use state object.
   */
  #initializeState(loadedState) {
    const synchronizedState = {};
    for (const endpointConfig of this.#config.endpoints) {
      // Use structuredClone to avoid accidental mutation of the loaded state
      const existingState = loadedState[endpointConfig.name];
      synchronizedState[endpointConfig.name] = existingState
        ? structuredClone(existingState)
        : createInitialEndpointState();
    }
    return synchronizedState;
  }

  /**
   * Executes a single probing run for all configured endpoints concurrently.
   * It updates the state for each endpoint and triggers a dashboard refresh.
   */
  async #runProbeCycle() {
    if (this.#isShuttingDown) return;

    // On the first run, we don't show spinners, just the initial dashboard.
    // On subsequent runs, spinners indicate that a check is in progress.
    if (this.#isFirstRun) {
      this.#isFirstRun = false;
    } else {
      this.#config.endpoints.forEach(endpoint => startSpinner(endpoint.name));
    }

    const probePromises = this.#config.endpoints.map(async (endpointConfig) => {
      const probeResult = await performProbe(endpointConfig);
      const currentState = this.#state[endpointConfig.name];
      const newState = updateEndpointState(currentState, probeResult);
      this.#state[endpointConfig.name] = newState;

      // Stop the individual spinner after its probe is complete.
      // This provides immediate feedback rather than waiting for all probes.
      stopSpinner(endpointConfig.name, newState, endpointConfig);
    });

    // Wait for all probes in the current cycle to complete.
    await Promise.all(probePromises);

    // After all probes are done and spinners are stopped, re-render the full dashboard.
    this.#render();

    // Schedule the next cycle.
    this.#scheduleNextRun();
  }

  /**
   * Renders the dashboard UI with the current state.
   */
  #render() {
    renderDashboard(this.#state, this.#config.endpoints, this.#config.interval);
  }

  /**
   * Schedules the next probe cycle using `setTimeout`.
   */
  #scheduleNextRun() {
    if (this.#isShuttingDown) return;

    const intervalMs = this.#config.interval * 1000;
    this.#timerId = setTimeout(() => this.#runProbeCycle(), intervalMs);
  }

  /**
   * Starts the monitoring loop. It performs an initial render and then
   * begins the first probe cycle.
   */
  start() {
    this.#render(); // Initial render with loaded or default state
    this.#runProbeCycle();
  }

  /**
   * Gracefully stops the monitoring loop. It prevents new probes from starting,
   * clears any scheduled timers, stops all UI spinners, and saves the final state.
   *
   * @returns {Promise<void>} A promise that resolves when shutdown is complete.
   */
  async shutdown() {
    if (this.#isShuttingDown) return;
    this.#isShuttingDown = true;

    showGoodbyeMessage();

    if (this.#timerId) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }

    stopAllSpinners('Shutdown initiated.');

    await saveState(this.#state);
    showStateSavedMessage();
  }
}

/**
 * Initializes and starts the monitoring process.
 * This is the main entry point for the monitoring logic.
 *
 * @param {ProbeConfig} config - The validated application configuration.
 * @returns {Promise<Monitor>} A promise that resolves with the created Monitor instance.
 */
export async function startMonitoring(config) {
  const initialState = await loadState();
  const monitor = new Monitor(config, initialState);
  monitor.start();
  return monitor;
}