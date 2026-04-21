/**
 * src/services/docker-service.js
 *
 * This module acts as a service layer, providing an abstraction over the Docker
 * Engine API. It uses the 'dockerode' library to communicate with the Docker
 * daemon and exposes a clean, promise-based interface for listing images,
 * containers, and removing images. This centralizes all Docker-related
- * communication, making the rest of the application agnostic to the underlying
 * implementation details of the Docker API.
 *
 * @module services/docker-service
 */

import Docker from 'dockerode';
import ora from 'ora';
import chalk from 'chalk';

/**
 * A custom error class for Docker-related operations.
 * This allows for more specific error handling in the application's higher layers.
 */
class DockerServiceError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'DockerServiceError';
    this.cause = cause;
  }
}

let dockerInstance;

/**
 * Initializes and returns a singleton Dockerode instance.
 * It attempts to connect to the Docker daemon and verifies the connection.
 * If the connection fails, it throws a specific DockerServiceError.
 *
 * @returns {Promise<Docker>} A promise that resolves with the Dockerode instance.
 * @throws {DockerServiceError} If the Docker daemon is not reachable or fails to respond.
 */
async function getDockerInstance() {
  if (dockerInstance) {
    return dockerInstance;
  }

  const spinner = ora('Connecting to Docker daemon...').start();
  try {
    const docker = new Docker(); // Uses DOCKER_HOST or default socket path
    await docker.ping(); // Verify the connection
    spinner.succeed('Connected to Docker daemon.');
    dockerInstance = docker;
    return dockerInstance;
  } catch (error) {
    spinner.fail(chalk.red('Failed to connect to Docker daemon.'));
    const errorMessage = `Could not connect to the Docker daemon. Please ensure Docker is running.\n  Error: ${error.message}`;
    throw new DockerServiceError(errorMessage, error);
  }
}

/**
 * Fetches a list of all local Docker images.
 *
 * The raw image data from Dockerode is processed to create a more structured
 * and useful object for the application, including a unique ID, tags, creation date, and size.
 *
 * @returns {Promise<Array<object>>} A promise that resolves to an array of image objects.
 * @throws {DockerServiceError} If fetching images fails.
 */
export async function listImages() {
  try {
    const docker = await getDockerInstance();
    const images = await docker.listImages({ all: true });

    // Map the raw Dockerode image format to a more usable structure
    return images.map(img => ({
      id: img.Id.replace('sha256:', '').substring(0, 12),
      repoTags: img.RepoTags ?? [],
      created: img.Created,
      size: img.Size,
      // VirtualSize is often more representative of the space an image consumes
      // but Size is the size of the layers on disk. We'll use Size for consistency.
      virtualSize: img.VirtualSize,
    }));
  } catch (error) {
    if (error instanceof DockerServiceError) {
      throw error; // Re-throw connection errors
    }
    throw new DockerServiceError('Failed to list Docker images.', error);
  }
}

/**
 * Fetches a list of all containers (both running and stopped).
 *
 * This is used to identify which images are currently in use by any container.
 * The function extracts the ImageID from each container.
 *
 * @returns {Promise<Array<object>>} A promise that resolves to an array of container objects.
 * @throws {DockerServiceError} If fetching containers fails.
 */
export async function listContainers() {
  try {
    const docker = await getDockerInstance();
    return await docker.listContainers({ all: true });
  } catch (error) {
    if (error instanceof DockerServiceError) {
      throw error; // Re-throw connection errors
    }
    throw new DockerServiceError('Failed to list Docker containers.', error);
  }
}

/**
 * Deletes a Docker image by its ID.
 *
 * @param {string} imageId - The full or short ID of the image to delete.
 * @returns {Promise<object>} A promise that resolves with the result from the Docker API.
 * @throws {DockerServiceError} If the image deletion fails (e.g., image is in use).
 */
export async function deleteImage(imageId) {
  try {
    const docker = await getDockerInstance();
    const image = docker.getImage(imageId);
    // The 'force: false' option prevents deleting an image that is used by a container.
    return await image.remove({ force: false });
  } catch (error) {
    if (error instanceof DockerServiceError) {
      throw error; // Re-throw connection errors
    }
    // Docker API returns 409 Conflict if image is in use, or 404 if not found.
    // We wrap it in our custom error for consistent handling.
    const message = error.statusCode === 409
      ? `Image ${imageId} is in use and cannot be deleted.`
      : `Failed to delete image ${imageId}.`;
    throw new DockerServiceError(message, error);
  }
}