import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Graph from 'graphology';
import { detectCycles } from '../../src/analysis/cycle-detector.js';
import logger from '../../src/utils/logger.js';

// Mute the logger for tests to keep the output clean.
before(() => {
  logger.setLevel('silent');
});

// Restore the original logger level after tests.
after(() => {
  logger.setLevel('info');
});

describe('detectCycles', () => {
  it('should return an empty array for an empty graph', () => {
    const graph = new Graph({ type: 'directed' });
    const cycles = detectCycles(graph);
    assert.deepStrictEqual(cycles, [], 'Expected no cycles for an empty graph');
  });

  it('should return an empty array for a null or undefined graph', () => {
    const cycles1 = detectCycles(null);
    assert.deepStrictEqual(cycles1, [], 'Expected no cycles for a null graph');

    const cycles2 = detectCycles(undefined);
    assert.deepStrictEqual(cycles2, [], 'Expected no cycles for an undefined graph');
  });

  it('should return an empty array for a graph with no edges (only nodes)', () => {
    const graph = new Graph({ type: 'directed' });
    graph.addNode('/path/a.js');
    graph.addNode('/path/b.js');
    graph.addNode('/path/c.js');

    const cycles = detectCycles(graph);
    assert.deepStrictEqual(cycles, [], 'Expected no cycles for a graph with only nodes');
  });

  it('should return an empty array for a directed acyclic graph (DAG)', () => {
    const graph = new Graph({ type: 'directed' });
    // A -> B -> C
    // A -> D
    graph.addNode('/path/a.js');
    graph.addNode('/path/b.js');
    graph.addNode('/path/c.js');
    graph.addNode('/path/d.js');

    graph.addDirectedEdge('/path/a.js', '/path/b.js');
    graph.addDirectedEdge('/path/b.js', '/path/c.js');
    graph.addDirectedEdge('/path/a.js', '/path/d.js');

    const cycles = detectCycles(graph);
    assert.deepStrictEqual(cycles, [], 'Expected no cycles in a DAG');
  });

  it('should detect a simple two-node cycle (A -> B -> A)', () => {
    const graph = new Graph({ type: 'directed' });
    const nodeA = '/path/a.js';
    const nodeB = '/path/b.js';
    graph.addNode(nodeA);
    graph.addNode(nodeB);

    graph.addDirectedEdge(nodeA, nodeB);
    graph.addDirectedEdge(nodeB, nodeA);

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 1, 'Expected to find one cycle group');

    // The order of nodes in the result from tarjan-graph is not guaranteed,
    // so we sort both the expected and actual results for a stable comparison.
    const sortedCycle = cycles[0].sort();
    const expectedCycle = [nodeA, nodeB].sort();
    assert.deepStrictEqual(sortedCycle, expectedCycle, 'The detected cycle should contain both nodes A and B');
  });

  it('should detect a three-node cycle (A -> B -> C -> A)', () => {
    const graph = new Graph({ type: 'directed' });
    const nodeA = '/path/a.js';
    const nodeB = '/path/b.js';
    const nodeC = '/path/c.js';
    graph.addNode(nodeA);
    graph.addNode(nodeB);
    graph.addNode(nodeC);

    graph.addDirectedEdge(nodeA, nodeB);
    graph.addDirectedEdge(nodeB, nodeC);
    graph.addDirectedEdge(nodeC, nodeA);

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 1, 'Expected to find one cycle group');

    const sortedCycle = cycles[0].sort();
    const expectedCycle = [nodeA, nodeB, nodeC].sort();
    assert.deepStrictEqual(sortedCycle, expectedCycle, 'The detected cycle should contain nodes A, B, and C');
  });

  it('should detect a self-referencing cycle (A -> A)', () => {
    const graph = new Graph({ type: 'directed', allowSelfLoops: true });
    const nodeA = '/path/a.js';
    graph.addNode(nodeA);
    graph.addDirectedEdge(nodeA, nodeA); // Self-loop

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 1, 'Expected to find one cycle group');
    assert.deepStrictEqual(cycles[0], [nodeA], 'The cycle should be the self-referencing node');
  });

  it('should not report a single node as a cycle if it has no self-loop', () => {
    const graph = new Graph({ type: 'directed' });
    const nodeA = '/path/a.js';
    const nodeB = '/path/b.js';
    graph.addNode(nodeA);
    graph.addNode(nodeB);

    // This creates a component of [B] but it's not a cycle
    graph.addDirectedEdge(nodeA, nodeB);

    const cycles = detectCycles(graph);
    assert.deepStrictEqual(cycles, [], 'A single node without a self-loop should not be a cycle');
  });

  it('should correctly identify multiple, disjoint cycles', () => {
    const graph = new Graph({ type: 'directed', allowSelfLoops: true });
    // Cycle 1: A -> B -> A
    const nodeA = '/path/a.js';
    const nodeB = '/path/b.js';
    graph.addDirectedEdge(nodeA, nodeB);
    graph.addDirectedEdge(nodeB, nodeA);

    // Cycle 2: C -> D -> E -> C
    const nodeC = '/path/c.js';
    const nodeD = '/path/d.js';
    const nodeE = '/path/e.js';
    graph.addDirectedEdge(nodeC, nodeD);
    graph.addDirectedEdge(nodeD, nodeE);
    graph.addDirectedEdge(nodeE, nodeC);

    // Cycle 3: F -> F (self-loop)
    const nodeF = '/path/f.js';
    graph.addDirectedEdge(nodeF, nodeF);

    // Some non-cycle nodes
    const nodeG = '/path/g.js';
    graph.addDirectedEdge(nodeA, nodeG); // A -> G

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 3, 'Expected to find three distinct cycle groups');

    // Normalize results for comparison by sorting nodes within each cycle and then sorting the cycles themselves.
    const normalize = (arr) => arr.map(c => c.sort()).sort((a, b) => a[0].localeCompare(b[0]));

    const normalizedCycles = normalize(cycles);
    const normalizedExpected = normalize([
      [nodeA, nodeB],
      [nodeC, nodeD, nodeE],
      [nodeF]
    ]);

    assert.deepStrictEqual(normalizedCycles, normalizedExpected, 'Should detect all three disjoint cycles correctly');
  });

  it('should detect a cycle within a larger, more complex graph', () => {
    const graph = new Graph({ type: 'directed' });
    // Structure:
    // entry -> lib1 -> util
    // entry -> lib2 -> cycleA -> cycleB -> cycleA
    // lib2 -> helper
    const entry = '/path/entry.js';
    const lib1 = '/path/lib1.js';
    const util = '/path/util.js';
    const lib2 = '/path/lib2.js';
    const cycleA = '/path/cycle/a.js';
    const cycleB = '/path/cycle/b.js';
    const helper = '/path/helper.js';

    graph.addDirectedEdge(entry, lib1);
    graph.addDirectedEdge(lib1, util);
    graph.addDirectedEdge(entry, lib2);
    graph.addDirectedEdge(lib2, cycleA);
    graph.addDirectedEdge(lib2, helper);

    // The cycle
    graph.addDirectedEdge(cycleA, cycleB);
    graph.addDirectedEdge(cycleB, cycleA);

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 1, 'Expected to find exactly one cycle group');

    const sortedCycle = cycles[0].sort();
    const expectedCycle = [cycleA, cycleB].sort();
    assert.deepStrictEqual(sortedCycle, expectedCycle, 'The detected cycle should contain cycleA and cycleB');
  });

  it('should correctly identify two cycles that share a node', () => {
    const graph = new Graph({ type: 'directed' });
    // A -> B -> A (Cycle 1)
    // B -> C -> B (Cycle 2)
    // All three nodes (A, B, C) are in the same Strongly Connected Component.
    const nodeA = '/path/a.js';
    const nodeB = '/path/b.js';
    const nodeC = '/path/c.js';

    graph.addDirectedEdge(nodeA, nodeB);
    graph.addDirectedEdge(nodeB, nodeA);
    graph.addDirectedEdge(nodeB, nodeC);
    graph.addDirectedEdge(nodeC, nodeB);

    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 1, 'Expected one combined SCC for overlapping cycles');

    const sortedCycle = cycles[0].sort();
    const expectedCycle = [nodeA, nodeB, nodeC].sort();
    assert.deepStrictEqual(sortedCycle, expectedCycle, 'The cycle should contain all nodes from the overlapping cycles');
  });
});