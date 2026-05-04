/**
 * @file src/utils/priority-queue.js
 * @description A min-priority queue implementation using a binary heap.
 * This data structure is essential for algorithms like A* pathfinding, where
 * efficiently retrieving the element with the lowest priority (e.g., cost) is critical.
 *
 * The queue stores elements as objects: `{ value, priority }`.
 * It maintains the heap property, ensuring that the element with the minimum
 * priority is always at the root of the heap, allowing for O(1) peeking
 * and O(log n) insertion and extraction.
 */

/**
 * Represents a node in the priority queue.
 * @template T The type of the value stored in the node.
 */
class PriorityQueueNode {
  /**
   * @param {T} value The data to store.
   * @param {number} priority The priority of the data. Lower numbers mean higher priority.
   */
  constructor(value, priority) {
    /** @type {T} */
    this.value = value;
    /** @type {number} */
    this.priority = priority;
  }
}

/**
 * A Min-Priority Queue implemented with a binary heap.
 * @template T The type of values stored in the queue.
 */
export class PriorityQueue {
  /**
   * Initializes a new, empty priority queue.
   */
  constructor() {
    /**
     * The array that stores the heap's nodes.
     * The heap property is maintained: for any node at index i, its children
     * are at indices 2*i + 1 and 2*i + 2, and its parent is at floor((i-1)/2).
     * @private
     * @type {PriorityQueueNode<T>[]}
     */
    this.heap = [];
  }

  /**
   * Adds a value to the queue with a given priority.
   * The new element is added to the end of the heap and then "bubbled up"
   * to its correct position to maintain the heap property.
   * Time complexity: O(log n)
   *
   * @param {T} value The value to enqueue.
   * @param {number} priority The priority of the value.
   */
  enqueue(value, priority) {
    const newNode = new PriorityQueueNode(value, priority);
    this.heap.push(newNode);
    this.bubbleUp();
  }

  /**
   * Removes and returns the value with the highest priority (lowest priority number).
   * If the queue is empty, it returns null.
   * The root element is replaced with the last element in the heap, which is then
   * "sunk down" to its correct position.
   * Time complexity: O(log n)
   *
   * @returns {T | null} The value with the highest priority, or null if the queue is empty.
   */
  dequeue() {
    if (this.isEmpty()) {
      return null;
    }

    const min = this.heap[0];
    const end = this.heap.pop();

    if (!this.isEmpty()) {
      this.heap[0] = end;
      this.sinkDown();
    }

    return min.value;
  }

  /**
   * Returns the value with the highest priority without removing it.
   * Time complexity: O(1)
   *
   * @returns {T | null} The value with the highest priority, or null if the queue is empty.
   */
  peek() {
    return this.isEmpty() ? null : this.heap[0].value;
  }

  /**
   * Checks if the priority queue is empty.
   *
   * @returns {boolean} True if the queue has no elements, false otherwise.
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Gets the current number of elements in the queue.
   *
   * @returns {number} The size of the queue.
   */
  get size() {
    return this.heap.length;
  }

  /**
   * Moves the last element up the heap to its correct position.
   * @private
   */
  bubbleUp() {
    let index = this.heap.length - 1;
    const element = this.heap[index];

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];

      if (element.priority >= parent.priority) {
        break; // Heap property is satisfied
      }

      // Swap with parent
      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  /**
   * Moves the root element down the heap to its correct position.
   * @private
   */
  sinkDown() {
    let index = 0;
    const length = this.heap.length;
    const element = this.heap[0];

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let leftChild, rightChild;
      let swapIndex = null;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.priority < element.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swapIndex === null && rightChild.priority < element.priority) ||
          (swapIndex !== null && rightChild.priority < leftChild.priority)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) {
        break; // Heap property is satisfied
      }

      // Swap with the smaller child
      this.heap[index] = this.heap[swapIndex];
      this.heap[swapIndex] = element;
      index = swapIndex;
    }
  }
}