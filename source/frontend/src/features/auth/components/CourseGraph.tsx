import styles from './LoginPage.module.css';

// Decorative: a small prerequisite graph whose edges carry a slow pulse (off under reduced motion).
const NODES = [
  { id: 'a', x: 40, y: 40, label: 'Nhập môn', done: true },
  { id: 'b', x: 40, y: 130, label: 'Toán rời rạc', done: true },
  { id: 'c', x: 200, y: 40, label: 'Cấu trúc DL', done: true },
  { id: 'd', x: 200, y: 130, label: 'CSDL', done: false },
  { id: 'e', x: 360, y: 85, label: 'PBL', done: false },
] as const;

const EDGES = [
  ['a', 'c'],
  ['b', 'c'],
  ['b', 'd'],
  ['c', 'e'],
  ['d', 'e'],
] as const;

const NODE_W = 104;
const NODE_H = 32;

function centre(id: string) {
  const node = NODES.find((item) => item.id === id);
  return node ? { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 } : null;
}

function edgePath(from: string, to: string) {
  const a = centre(from);
  const b = centre(to);
  if (!a || !b) return '';
  const startX = a.x + NODE_W / 2;
  const endX = b.x - NODE_W / 2;
  const mid = (startX + endX) / 2;
  return `M${startX} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${endX} ${b.y}`;
}

export function CourseGraph() {
  return (
    <svg
      className={styles.graph}
      viewBox="0 0 480 200"
      aria-hidden="true"
      focusable="false"
    >
      {EDGES.map(([from, to]) => (
        <path
          key={`e-${from}${to}`}
          className={styles.edge}
          d={edgePath(from, to)}
        />
      ))}
      {EDGES.map(([from, to], index) => (
        <path
          key={`f-${from}${to}`}
          className={styles.flow}
          d={edgePath(from, to)}
          style={{ animationDelay: `${index * 0.55}s` }}
        />
      ))}
      {NODES.map((node) => (
        <g key={node.id}>
          <rect
            className={
              node.done ? `${styles.node} ${styles.nodeDone}` : styles.node
            }
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx={8}
          />
          <text
            className={styles.nodeLabel}
            x={node.x + NODE_W / 2}
            y={node.y + NODE_H / 2 + 4}
            textAnchor="middle"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
