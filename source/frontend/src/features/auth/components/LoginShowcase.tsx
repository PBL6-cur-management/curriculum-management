import { useEffect, useState, type CSSProperties } from 'react';
import styles from './LoginShowcase.module.css';

// Login brand panel: three short scenes of what a training program holds, rotating on their own.
// Decorative except the scene buttons; under reduced motion it stays on one scene and never animates.

const SCENE_MS = 3500;

// A curriculum frame: four semesters; one prerequisite chain lights up across them.
const SEMESTERS = [
  ['Giải tích 1', 'Tin học đại cương', 'Triết học'],
  ['Vật lý 1', 'Kỹ thuật lập trình', 'Toán rời rạc'],
  ['Cấu trúc dữ liệu', 'Kiến trúc máy tính', 'Giải tích 2'],
  ['Cơ sở dữ liệu', 'Hệ điều hành', 'PBL 2'],
];
// [semester, row] of each course on the chain, in order.
const CHAIN = [
  [0, 1],
  [1, 1],
  [2, 0],
  [3, 0],
] as const;

const COL_W = 136;
const COL_GAP = 20;
const CHIP_H = 52;
const ROW_GAP = 14;
const HEAD_H = 30;
const TOP = HEAD_H + 12;
const STEP = 0.5; // seconds between two lit courses

const chipX = (column: number) => column * (COL_W + COL_GAP);
const chipY = (row: number) => TOP + row * (CHIP_H + ROW_GAP);

const FLOW = [
  { role: 'Giảng viên', step: 'Soạn đề xuất' },
  { role: 'Điều phối nhóm', step: 'Cấp 1' },
  { role: 'Giám đốc CTĐT', step: 'Cấp 2' },
  { role: 'Phòng Đào tạo', step: 'Cấp 3' },
];

const VERSIONS = [
  { name: 'Phiên bản 2023', cohorts: ['K23'] },
  { name: 'Phiên bản 2024', cohorts: ['K24'] },
  { name: 'Phiên bản 2025', cohorts: ['K25', 'K26'] },
];

const delay = (seconds: number) =>
  ({ animationDelay: `${seconds}s` }) as CSSProperties;

function FrameScene() {
  const width = 4 * COL_W + 3 * COL_GAP;
  const height = TOP + 3 * CHIP_H + 2 * ROW_GAP + 4;
  const step = (index: number) => 0.7 + index * STEP;
  const chainIndex = (column: number, row: number) =>
    CHAIN.findIndex(([c, r]) => c === column && r === row);
  return (
    <svg
      className={styles.path}
      viewBox={`-4 -4 ${width + 8} ${height + 8}`}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="login-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" className={styles.arrowHead} />
        </marker>
      </defs>
      {SEMESTERS.map((courses, column) => (
        <g key={column}>
          <rect
            className={styles.semesterPill}
            x={chipX(column)}
            y={0}
            width={COL_W}
            height={HEAD_H}
            rx={8}
          />
          <text
            className={styles.semesterText}
            x={chipX(column) + COL_W / 2}
            y={HEAD_H / 2 + 5}
            textAnchor="middle"
          >
            Học kỳ {column + 1}
          </text>
          {courses.map((name, row) => {
            const lit = chainIndex(column, row);
            const last = lit === CHAIN.length - 1;
            return (
              <g
                key={name}
                className={styles.chip}
                style={delay(0.05 + (column * 3 + row) * 0.04)}
              >
                <rect
                  className={styles.chipBox}
                  x={chipX(column)}
                  y={chipY(row)}
                  width={COL_W}
                  height={CHIP_H}
                  rx={10}
                />
                {lit >= 0 && (
                  <rect
                    className={last ? styles.chipTarget : styles.chipLit}
                    style={delay(step(lit))}
                    x={chipX(column)}
                    y={chipY(row)}
                    width={COL_W}
                    height={CHIP_H}
                    rx={10}
                  />
                )}
                <text
                  className={styles.chipText}
                  x={chipX(column) + COL_W / 2}
                  y={chipY(row) + CHIP_H / 2 + 5}
                  textAnchor="middle"
                >
                  {name}
                </text>
                {lit >= 0 && (
                  <text
                    className={
                      last
                        ? `${styles.chipTextLit} ${styles.chipTextTarget}`
                        : styles.chipTextLit
                    }
                    style={delay(step(lit))}
                    x={chipX(column) + COL_W / 2}
                    y={chipY(row) + CHIP_H / 2 + 5}
                    textAnchor="middle"
                  >
                    {name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
      {CHAIN.slice(1).map(([column, row], index) => {
        const [fromColumn, fromRow] = CHAIN[index];
        const x1 = chipX(fromColumn) + COL_W;
        const y1 = chipY(fromRow) + CHIP_H / 2;
        const x2 = chipX(column) - 2;
        const y2 = chipY(row) + CHIP_H / 2;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={`${column}-${row}`}
            className={styles.arrow}
            style={delay(step(index) + 0.1)}
            d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
            pathLength={1}
            markerEnd="url(#login-arrow)"
          />
        );
      })}
    </svg>
  );
}

function FlowScene() {
  return (
    <div className={styles.flow}>
      <div className={styles.flowTrack}>
        <span className={styles.flowLine}>
          <span className={styles.flowLineFill} />
        </span>
        {FLOW.map((node, index) => (
          <div key={node.role} className={styles.flowNode}>
            <span className={styles.flowDot} style={delay(0.3 + index * 0.55)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
            <b>{node.step}</b>
            <span>{node.role}</span>
          </div>
        ))}
      </div>
      <div className={styles.flowDone} style={delay(2.3)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
        Đề xuất có hiệu lực từ học kỳ sau
      </div>
    </div>
  );
}

function VersionScene() {
  let order = 0;
  return (
    <div className={styles.versions}>
      {VERSIONS.map((version, index) => (
        <div
          key={version.name}
          className={styles.version}
          style={delay(index * 0.2)}
        >
          <div className={styles.versionHead}>
            <b>{version.name}</b>
            <span>
              {index === VERSIONS.length - 1 ? 'Đang áp dụng' : 'Đã ban hành'}
            </span>
          </div>
          <div className={styles.versionBody}>
            <span className={styles.versionLine} />
            <span className={styles.versionLine} />
            <span className={styles.versionLineShort} />
          </div>
          <div className={styles.cohorts}>
            {version.cohorts.map((cohort) => (
              <span
                key={cohort}
                className={styles.cohort}
                style={delay(0.9 + order++ * 0.18)}
              >
                Khóa {cohort}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const SCENES = [
  { title: 'Khung chương trình và học phần tiên quyết', render: FrameScene },
  { title: 'Đề xuất thay đổi qua ba cấp duyệt', render: FlowScene },
  { title: 'Phiên bản ban hành cho từng khóa', render: VersionScene },
];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function LoginShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = prefersReducedMotion();

  useEffect(() => {
    if (still || paused) return;
    const timer = window.setTimeout(
      () => setActive((current) => (current + 1) % SCENES.length),
      SCENE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, still]);

  return (
    <div
      className={`${styles.showcase} ${paused ? styles.paused : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.stage} aria-hidden="true">
        {SCENES.map((scene, index) => (
          <div
            key={scene.title}
            className={`${styles.scene} ${index === active ? styles.active : ''}`}
          >
            <scene.render />
          </div>
        ))}
      </div>
      <div className={styles.caption}>
        <p className={styles.sceneTitle} aria-live="polite">
          {SCENES[active].title}
        </p>
        <div className={styles.dots}>
          {SCENES.map((scene, index) => (
            <button
              key={scene.title}
              type="button"
              className={`${styles.dot} ${index === active ? styles.dotActive : ''}`}
              aria-label={scene.title}
              aria-current={index === active}
              onClick={() => setActive(index)}
              style={{ '--scene-ms': `${SCENE_MS}ms` } as CSSProperties}
            >
              <span />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
