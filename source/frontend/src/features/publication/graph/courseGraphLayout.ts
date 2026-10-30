import type { CourseGraph, GraphEdge, GraphNode } from '../api/publication';

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 44;
const COLUMN_GAP = 56;
const ROW_GAP = 16;
export const COLUMN_WIDTH = NODE_WIDTH + COLUMN_GAP;
export const HEADER_HEIGHT = 36;

export interface PlacedNode extends GraphNode {
  x: number;
  y: number;
  column: number;
}

export interface GraphColumn {
  key: string;
  label: string;
  x: number;
}

// Fixed columns: requisites outside the frame first, then one column per planned semester (D4).
// Inside a column the order is the server's (semester, sortOrder) order, so the picture never reshuffles.
export function layoutCourseGraph(graph: CourseGraph): {
  nodes: PlacedNode[];
  columns: GraphColumn[];
  width: number;
  height: number;
} {
  const hasExternal = graph.nodes.some((node) => node.external);
  const semesters = Math.max(
    graph.version.semesterCount,
    ...graph.nodes.map((node) => node.semester ?? 0),
  );
  const offset = hasExternal ? 1 : 0;
  const columns: GraphColumn[] = [
    ...(hasExternal ? [{ key: 'external', label: 'Ngoài khung' }] : []),
    ...Array.from({ length: semesters }, (_, index) => ({
      key: String(index + 1),
      label: `Học kỳ ${index + 1}`,
    })),
  ].map((column, index) => ({ ...column, x: index * COLUMN_WIDTH }));
  const rows = new Map<number, number>();
  const nodes = graph.nodes.map((node) => {
    const column = node.external ? 0 : (node.semester ?? 1) - 1 + offset;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return {
      ...node,
      column,
      x: column * COLUMN_WIDTH + NODE_WIDTH / 2,
      y: HEADER_HEIGHT + row * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT / 2,
    };
  });
  const tallest = Math.max(1, ...rows.values());
  return {
    nodes,
    columns,
    width: columns.length * COLUMN_WIDTH - COLUMN_GAP,
    height: HEADER_HEIGHT + tallest * (NODE_HEIGHT + ROW_GAP),
  };
}

// Walks the ordering relations (PRIOR, PREREQUISITE) both ways from one node, with a visited set so a
// cycle ends. A corequisite is shown as a direct neighbour but never continues the chain (D4).
export function dependencyChain(
  edges: readonly GraphEdge[],
  start: string,
): {
  ancestors: Set<string>;
  descendants: Set<string>;
  corequisites: Set<string>;
} {
  const ordering = edges.filter((edge) => edge.relationType !== 'COREQUISITE');
  const walk = (from: 'source' | 'target', to: 'source' | 'target') => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of ordering)
        if (
          edge[to] === current &&
          !seen.has(edge[from]) &&
          edge[from] !== start
        ) {
          seen.add(edge[from]);
          queue.push(edge[from]);
        }
    }
    return seen;
  };
  const corequisites = new Set(
    edges
      .filter((edge) => edge.relationType === 'COREQUISITE')
      .flatMap((edge) =>
        edge.source === start
          ? [edge.target]
          : edge.target === start
            ? [edge.source]
            : [],
      ),
  );
  return {
    ancestors: walk('source', 'target'),
    descendants: walk('target', 'source'),
    corequisites,
  };
}

export const RELATION_LABELS: Record<GraphEdge['relationType'], string> = {
  PRIOR: 'Học trước',
  PREREQUISITE: 'Tiên quyết',
  COREQUISITE: 'Song hành',
};
