import { useEffect, useState, type CSSProperties } from 'react';
import styles from './LoginShowcase.module.css';

// Login brand panel: three short scenes of what a training program holds, rotating on their own.
// Decorative except the scene buttons; under reduced motion it stays on one scene and never animates.

const SCENE_MS = 2000;

type Block = 'general' | 'core' | 'major';

const FRAME: { semester: string; courses: { name: string; block: Block }[] }[] =
  [
    {
      semester: 'HK1',
      courses: [
        { name: 'Giải tích 1', block: 'general' },
        { name: 'Tin học đại cương', block: 'general' },
        { name: 'Triết học', block: 'general' },
      ],
    },
    {
      semester: 'HK2',
      courses: [
        { name: 'Toán rời rạc', block: 'core' },
        { name: 'Lập trình C++', block: 'core' },
        { name: 'Vật lý 1', block: 'general' },
      ],
    },
    {
      semester: 'HK3',
      courses: [
        { name: 'Cấu trúc dữ liệu', block: 'core' },
        { name: 'Kiến trúc máy tính', block: 'core' },
        { name: 'PBL 1', block: 'major' },
      ],
    },
    {
      semester: 'HK4',
      courses: [
        { name: 'Cơ sở dữ liệu', block: 'core' },
        { name: 'Hệ điều hành', block: 'major' },
        { name: 'PBL 2', block: 'major' },
      ],
    },
  ];

const BLOCK_LABEL: Record<Block, string> = {
  general: 'Đại cương',
  core: 'Cơ sở ngành',
  major: 'Chuyên ngành',
};

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
  let order = 0;
  return (
    <div className={styles.frame}>
      <div className={styles.frameGrid}>
        {FRAME.map((column) => (
          <div key={column.semester} className={styles.semester}>
            <span className={styles.semesterHead}>{column.semester}</span>
            {column.courses.map((course) => (
              <span
                key={course.name}
                className={styles.course}
                style={delay(0.05 + order++ * 0.05)}
              >
                <i className={styles[course.block]} />
                {course.name}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        {(Object.keys(BLOCK_LABEL) as Block[]).map((block) => (
          <span key={block}>
            <i className={styles[block]} />
            {BLOCK_LABEL[block]}
          </span>
        ))}
        <span className={styles.credits}>
          <span className={styles.creditsBar}>
            <span className={styles.creditsFill} />
          </span>
          <b>150 tín chỉ</b>
        </span>
      </div>
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
            <span className={styles.flowDot} style={delay(0.15 + index * 0.3)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
            <b>{node.step}</b>
            <span>{node.role}</span>
          </div>
        ))}
      </div>
      <div className={styles.flowDone} style={delay(1.25)}>
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
          style={delay(index * 0.12)}
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
                style={delay(0.45 + order++ * 0.1)}
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
  { title: 'Khung chương trình theo học kỳ', render: FrameScene },
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
