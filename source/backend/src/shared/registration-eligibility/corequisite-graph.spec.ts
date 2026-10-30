import { buildCorequisiteGraph, corequisitePath } from './corequisite-graph.js';

describe('corequisite graph', () => {
  it('condenses reciprocal groups and orders dependencies first', () => {
    const graph = buildCorequisiteGraph(
      ['C', 'B', 'A'],
      new Map([
        ['A', ['B']],
        ['B', ['A', 'C']],
      ]),
    );
    expect(graph.components).toEqual([
      { id: 'A', courseIds: ['A', 'B'], dependencyComponentIds: ['C'] },
      { id: 'C', courseIds: ['C'], dependencyComponentIds: [] },
    ]);
    expect(graph.dependencyFirstOrder).toEqual(['C', 'A']);
  });
  it('returns a shortest simple path through a diamond and cycle', () => {
    const edges = new Map([
      ['A', ['B', 'C']],
      ['B', ['A', 'D']],
      ['C', ['D']],
    ]);
    expect(corequisitePath(edges, 'A', 'D')).toEqual(['A', 'B', 'D']);
    expect(corequisitePath(edges, 'A', 'X')).toEqual([]);
  });
  it('handles a large component without recursion or a member count limit', () => {
    const ids = Array.from({ length: 1000 }, (_, index) => String(index));
    const graph = buildCorequisiteGraph(
      ids,
      new Map(ids.map((id, index) => [id, [ids[(index + 1) % ids.length]]])),
    );
    expect(graph.components).toHaveLength(1);
    expect(graph.components[0].courseIds).toHaveLength(1000);
  });
});
