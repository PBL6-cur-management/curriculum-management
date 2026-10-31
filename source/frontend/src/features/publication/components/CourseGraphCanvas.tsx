import {
  Graph,
  type EdgeData,
  type IElementEvent,
  type NodeData,
} from '@antv/g6';
import { useEffect, useRef, useState } from 'react';
import type { GraphEdge } from '../api/publication';
import {
  COLUMN_WIDTH,
  HEADER_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphColumn,
  type PlacedNode,
} from '../graph/courseGraphLayout';

interface CourseGraphCanvasProps {
  nodes: PlacedNode[];
  edges: GraphEdge[];
  columns: GraphColumn[];
  width: number;
  height: number;
  selected: string | null;
  chain: {
    ancestors: Set<string>;
    descendants: Set<string>;
    corequisites: Set<string>;
  } | null;
  onSelect: (nodeId: string | null) => void;
}

// Light-mode tokens of the app (DESIGN.md): brand blue, slate ink, pass green, warning amber.
const COLOR = {
  brand: '#0071a6',
  ink: '#0f172a',
  muted: '#94a3b8',
  border: '#cbd5e1',
  surface: '#ffffff',
  external: '#f1f5f9',
  ancestor: '#059669',
  descendant: '#d97706',
};

const truncate = (text: string, max = 22) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function nodeData(node: PlacedNode): NodeData {
  return {
    id: node.id,
    data: { external: node.external },
    style: {
      x: node.x,
      y: node.y,
      size: [NODE_WIDTH, NODE_HEIGHT],
      radius: 8,
      fill: node.external ? COLOR.external : COLOR.surface,
      stroke: COLOR.border,
      lineWidth: 1,
      opacity: 1,
      lineDash: node.external ? [4, 3] : undefined,
      labelText: `${node.courseCode}\n${truncate(node.courseName)}`,
      labelPlacement: 'center',
      labelFill: COLOR.ink,
      labelFontSize: 11,
      labelLineHeight: 15,
      cursor: 'pointer',
    },
  };
}

function edgeData(edge: GraphEdge): EdgeData {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { relationType: edge.relationType },
    style: {
      stroke: COLOR.muted,
      lineWidth: 1,
      opacity: 1,
      endArrow: edge.relationType !== 'COREQUISITE',
      lineDash: edge.relationType === 'COREQUISITE' ? [4, 4] : undefined,
    },
  };
}

// The G6 picture. Positions come from the fixed semester layout; G6 only draws, pans and zooms.
export function CourseGraphCanvas({
  nodes,
  edges,
  columns,
  width,
  height,
  selected,
  chain,
  onSelect,
}: CourseGraphCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<Graph | null>(null);
  const [drawn, setDrawn] = useState(0);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    const instance = new Graph({
      container: container.current,
      width,
      height,
      data: { nodes: nodes.map(nodeData), edges: edges.map(edgeData) },
      node: {
        type: 'rect',
        state: {
          // Every lit state names its opacity: G6 keeps a state-only attribute after the state is
          // cleared, so a node dimmed by one selection would stay faded when the next one lights it.
          selected: { stroke: COLOR.brand, lineWidth: 3, opacity: 1 },
          ancestor: { stroke: COLOR.ancestor, lineWidth: 2, opacity: 1 },
          descendant: { stroke: COLOR.descendant, lineWidth: 2, opacity: 1 },
          dimmed: { opacity: 0.35 },
        },
      },
      edge: {
        type: 'cubic-horizontal',
        state: {
          active: { stroke: COLOR.brand, lineWidth: 2, opacity: 1 },
          dimmed: { opacity: 0.15 },
        },
      },
      // Fixed scale: semester columns line up with the headers above; the wrapper scrolls instead.
      behaviors: [],
    });
    instance.on('node:click', (event: IElementEvent) =>
      select.current(event.target.id),
    );
    instance.on('canvas:click', () => select.current(null));
    // G6 renders asynchronously: hand the instance out only once drawn, and never destroy it mid-render
    // (StrictMode mounts twice in development).
    let alive = true;
    const rendered = instance
      .render()
      .then(() => {
        if (!alive) return;
        graph.current = instance;
        setDrawn((count) => count + 1);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      graph.current = null;
      void rendered.finally(() => instance.destroy());
    };
  }, [nodes, edges, width, height]);

  useEffect(() => {
    const instance = graph.current;
    if (!instance) return;
    const states: Record<string, string[]> = {};
    for (const node of nodes) {
      if (!selected || !chain) states[node.id] = [];
      else if (node.id === selected) states[node.id] = ['selected'];
      else if (chain.ancestors.has(node.id)) states[node.id] = ['ancestor'];
      else if (
        chain.descendants.has(node.id) ||
        chain.corequisites.has(node.id)
      )
        states[node.id] = ['descendant'];
      else states[node.id] = ['dimmed'];
    }
    const lit =
      selected && chain
        ? new Set([
            selected,
            ...chain.ancestors,
            ...chain.descendants,
            ...chain.corequisites,
          ])
        : null;
    for (const edge of edges)
      states[edge.id] = !lit
        ? []
        : lit.has(edge.source) && lit.has(edge.target)
          ? ['active']
          : ['dimmed'];
    void instance.setElementState(states, false).catch(() => undefined);
  }, [selected, chain, nodes, edges, drawn]);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ position: 'relative', width }}>
        {columns.map((column) => (
          <div
            key={column.key}
            aria-hidden
            style={{
              position: 'absolute',
              left: column.x,
              top: 0,
              width: COLUMN_WIDTH - 56,
              height: HEADER_HEIGHT - 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--ctdt-color-fill-quaternary)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ctdt-color-text-secondary)',
              zIndex: 1,
            }}
          >
            {column.label}
          </div>
        ))}
        <div
          ref={container}
          role="img"
          aria-label="Đồ thị học phần theo học kỳ. Danh sách phụ thuộc bên dưới có cùng nội dung."
          style={{ width, height }}
        />
      </div>
    </div>
  );
}
