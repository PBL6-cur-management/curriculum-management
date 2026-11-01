import { useEffect, useState, type CSSProperties } from 'react';
import styles from './LoginShowcase.module.css';

// Login brand panel: three short scenes of what a training program holds, rotating on their own.
// Decorative except the scene buttons; under reduced motion it stays on one scene and never animates.

const SCENE_MS = 3500;

// A slice of the prerequisite graph: four semesters of real DUT courses; one chain lights up in turn.
const SEMESTERS = [
  [
    ['3190111', 'Giải tích 1'],
    ['1022863', 'Kỹ thuật lập trình'],
    ['1022940', 'Nhập môn ngành'],
  ],
  [
    ['3190121', 'Giải tích 2'],
    ['1023280', 'Cấu trúc dữ liệu'],
    ['3050011', 'Vật lý 1'],
  ],
  [
    ['1023693', 'Lập trình hướng đối tượng'],
    ['1021263', 'Toán rời rạc'],
    ['3190260', 'Đại số tuyến tính'],
  ],
  [
    ['1023290', 'Cơ sở dữ liệu'],
    ['1020292', 'Mạng máy tính'],
    ['3190141', 'Xác suất thống kê'],
  ],
] as const;
// Row of the chain's course in each semester.
const CHAIN_ROW = [1, 1, 0, 0];
const STEP = 0.6; // seconds between two lit courses

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
  return (
    <div className={styles.graph}>
      {SEMESTERS.map((courses, column) => (
        <div key={column} className={styles.semester}>
          <span className={styles.semesterHead}>Học kỳ {column + 1}</span>
          {courses.map(([code, name], row) => {
            const onChain = CHAIN_ROW[column] === row;
            const last = column === SEMESTERS.length - 1;
            const className = onChain
              ? `${styles.course} ${last ? styles.courseTarget : styles.courseLit}`
              : `${styles.course} ${styles.courseDim}`;
            return (
              <span
                key={code}
                className={className}
                style={
                  {
                    '--enter': `${0.04 * (column * 3 + row)}s`,
                    '--lit': `${0.6 + column * STEP}s`,
                  } as CSSProperties
                }
              >
                <span className={styles.courseCode}>{code}</span>
                <span className={styles.courseName}>{name}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
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
  { title: 'Học phần tiên quyết qua các học kỳ', render: FrameScene },
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
