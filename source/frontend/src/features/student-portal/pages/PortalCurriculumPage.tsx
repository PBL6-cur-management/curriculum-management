import {
  Alert,
  Button,
  Collapse,
  Empty,
  Flex,
  Input,
  List,
  Segmented,
  Select,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { generatePath, Link, useLocation } from 'react-router';
import { ROUTES } from '../../../routes';
import { StatusTag } from '../../../shared/design-system';
import { palette, radius } from '../../../shared/design-system/tokens';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  PortalContext,
  PortalCourse,
  PortalCourseState,
} from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import {
  PortalTrackExplorer,
  type TrackFilterMode,
  type TrackScope,
} from '../components/PortalTrackExplorer';
import {
  COURSE_STATE_COLORS,
  COURSE_STATE_LABELS,
} from '../constants/portalLabels';
import { usePortalCurriculum, usePortalPlos } from '../hooks/usePortal';

type ViewMode = 'SEMESTER' | 'STRUCTURE';
type StatusFilter = 'ALL' | 'PASSED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_TAKEN';

interface CourseWithTerm extends PortalCourse {
  plannedSemester: number;
}

const TABULAR_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Đã đạt', value: 'PASSED' },
  { label: 'Đang học', value: 'IN_PROGRESS' },
  { label: 'Chưa đạt', value: 'FAILED' },
  { label: 'Chưa học', value: 'NOT_TAKEN' },
];

function isCoursePassed(state: PortalCourseState): boolean {
  return state === 'PASSED' || state === 'PASSED_EQUIVALENT';
}

function formatCredits(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

function sumCredits(courses: readonly PortalCourse[]): string {
  const total = courses.reduce((acc, c) => acc + (Number(c.credits) || 0), 0);
  return formatCredits(total);
}

function sumCompulsoryCredits(courses: readonly PortalCourse[]): string {
  const total = courses.reduce(
    (acc, c) => acc + (c.isElective ? 0 : Number(c.credits) || 0),
    0,
  );
  return formatCredits(total);
}

function matchesStatus(
  state: PortalCourseState,
  filter: StatusFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'PASSED') return isCoursePassed(state);
  return state === filter;
}

interface CourseRowProps {
  course: PortalCourse;
  search: string;
  showTrackBadge: boolean;
  plannedSemester?: number;
}

function CourseRow({
  course,
  search,
  showTrackBadge,
  plannedSemester,
}: CourseRowProps) {
  const mark = [
    course.score10,
    course.score4 && `${course.score4}/4`,
    course.letterGrade,
  ]
    .filter(Boolean)
    .join(' · ');
  const title = `${course.courseCode} — ${course.courseName}`;
  return (
    <List.Item style={{ padding: '10px 14px' }}>
      <Flex vertical gap={4} style={{ width: '100%', minWidth: 0 }}>
        <Flex justify="space-between" gap="small" align="start" wrap="wrap">
          <Flex align="center" gap={8} wrap="wrap" style={{ minWidth: 0 }}>
            {course.hasSyllabus ? (
              <Link
                to={{
                  pathname: generatePath(ROUTES.studentSyllabus, {
                    itemId: course.itemId,
                  }),
                  search,
                }}
                style={{ fontWeight: 500 }}
              >
                {title}
              </Link>
            ) : (
              <Typography.Text style={{ color: palette.slate800 }}>
                {title}
              </Typography.Text>
            )}
            {showTrackBadge && (
              <Tag
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: '18px',
                  border: 'none',
                  backgroundColor: course.trackCode
                    ? palette.brandSoft
                    : palette.slate100,
                  color: course.trackCode
                    ? palette.brandStrong
                    : palette.slate600,
                }}
              >
                {course.trackCode ?? 'Khung chung'}
              </Tag>
            )}
          </Flex>
          <StatusTag
            status={course.state}
            labelMap={COURSE_STATE_LABELS}
            colorMap={COURSE_STATE_COLORS}
          />
        </Flex>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 13, ...TABULAR_STYLE }}
        >
          {plannedSemester !== undefined && `HK ${plannedSemester} · `}
          {course.credits} TC
          {course.isElective &&
            ` · Tự chọn${course.groupName ? ` (${course.groupName})` : ''}`}
          {mark && ` · Điểm ${mark}`}
          {course.attemptCount > 1 && ` · ${course.attemptCount} lần học`}
        </Typography.Text>
      </Flex>
    </List.Item>
  );
}

interface ProgressPillProps {
  passed: number;
  total: number;
}

function ProgressPill({ passed, total }: ProgressPillProps) {
  const allDone = total > 0 && passed === total;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: radius.sm,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: allDone
          ? palette.passSoft
          : passed > 0
            ? palette.brandSoft
            : palette.slate100,
        color: allDone
          ? palette.passStrong
          : passed > 0
            ? palette.brandStrong
            : palette.slate600,
        ...TABULAR_STYLE,
      }}
    >
      Đã đạt {passed}/{total} HP
    </span>
  );
}

interface CurriculumProps {
  context: PortalContext;
  search: string;
}

function Curriculum({ context, search }: CurriculumProps) {
  const curriculum = usePortalCurriculum(context);
  const plos = usePortalPlos(context);

  const contextKey = `${context.programId}:${context.semesterId}`;
  const [scopeOverride, setScopeOverride] = useState<{
    contextKey: string;
    scope: TrackScope;
  } | null>(null);
  const [trackFilterMode, setTrackFilterMode] =
    useState<TrackFilterMode>('WITH_COMMON');
  const [viewMode, setViewMode] = useState<ViewMode>('SEMESTER');
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const data = curriculum.data;
  const tracks = useMemo(() => data?.tracks ?? [], [data?.tracks]);
  const enrolledTrackId = data?.enrolledTrackId ?? null;

  const defaultScope: TrackScope =
    enrolledTrackId && tracks.some((t) => t.id === enrolledTrackId)
      ? enrolledTrackId
      : 'ALL';
  const selectedScope =
    scopeOverride && scopeOverride.contextKey === contextKey
      ? scopeOverride.scope
      : defaultScope;

  const allCourses: CourseWithTerm[] = useMemo(() => {
    if (!data) return [];
    return data.terms.flatMap((term) =>
      term.courses.map((course) => ({
        ...course,
        plannedSemester: term.plannedSemester,
      })),
    );
  }, [data]);

  const commonCourseCount = useMemo(
    () => allCourses.filter((c) => !c.trackId).length,
    [allCourses],
  );

  const passedCredits = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const c of allCourses) {
      if (!isCoursePassed(c.state)) continue;
      if (seen.has(c.courseId)) continue;
      seen.add(c.courseId);
      total += Number(c.credits) || 0;
    }
    return formatCredits(total);
  }, [allCourses]);

  const filteredCourses = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return allCourses.filter((course) => {
      if (selectedScope === 'COMMON') {
        if (course.trackId) return false;
      } else if (selectedScope !== 'ALL') {
        if (trackFilterMode === 'TRACK_ONLY') {
          if (course.trackId !== selectedScope) return false;
        } else {
          if (course.trackId && course.trackId !== selectedScope) return false;
        }
      }
      if (!matchesStatus(course.state, statusFilter)) return false;
      if (needle) {
        const matchCode = course.courseCode.toLowerCase().includes(needle);
        const matchName = course.courseName.toLowerCase().includes(needle);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [allCourses, selectedScope, trackFilterMode, statusFilter, queryText]);

  const filteredTerms = useMemo(() => {
    const grouped = new Map<number, CourseWithTerm[]>();
    for (const course of filteredCourses) {
      const list = grouped.get(course.plannedSemester);
      if (list) list.push(course);
      else grouped.set(course.plannedSemester, [course]);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([plannedSemester, courses]) => ({
        plannedSemester,
        courses,
        compulsoryCredits: sumCompulsoryCredits(courses),
        totalCredits: sumCredits(courses),
        passedCount: courses.filter((c) => isCoursePassed(c.state)).length,
      }));
  }, [filteredCourses]);

  const structureGroups = useMemo(() => {
    const groups: {
      key: string;
      title: string;
      subtitle?: string;
      isEnrolled?: boolean;
      courses: CourseWithTerm[];
    }[] = [];

    const commonCourses = filteredCourses.filter((c) => !c.trackId);
    if (commonCourses.length > 0) {
      groups.push({
        key: 'COMMON',
        title: 'Khung kiến thức chung',
        courses: commonCourses,
      });
    }

    const trackById = new Map<string, CourseWithTerm[]>();
    for (const c of filteredCourses) {
      if (!c.trackId) continue;
      const list = trackById.get(c.trackId);
      if (list) list.push(c);
      else trackById.set(c.trackId, [c]);
    }

    for (const track of tracks) {
      const courses = trackById.get(track.id);
      if (!courses || courses.length === 0) continue;
      groups.push({
        key: track.id,
        title: `${track.trackCode} — ${track.trackName}`,
        subtitle: track.englishName ?? undefined,
        isEnrolled: track.id === enrolledTrackId,
        courses,
      });
    }

    return groups;
  }, [filteredCourses, tracks, enrolledTrackId]);

  if (curriculum.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (curriculum.isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(curriculum.error, 'Không tải được chương trình.')}
      />
    );
  }

  const hasResults = allCourses.some((c) => c.attemptCount > 0);
  const showTrackBadge =
    viewMode === 'SEMESTER' && tracks.length > 0 && selectedScope === 'ALL';
  const hasActiveFilter =
    queryText.trim().length > 0 || statusFilter !== 'ALL';

  function handleSelectScope(scope: TrackScope) {
    setScopeOverride({ contextKey, scope });
  }

  function handleResetFilters() {
    setQueryText('');
    setStatusFilter('ALL');
    setScopeOverride({ contextKey, scope: 'ALL' });
  }

  return (
    <Flex vertical gap={16}>
      <PortalTrackExplorer
        programName={data.programName}
        versionNumber={data.versionNumber}
        decisionNumber={data.decisionNumber}
        totalCredits={data.totalCredits}
        compulsoryCredits={data.compulsoryCredits}
        electiveCredits={data.electiveCredits}
        passedCredits={passedCredits}
        tracks={tracks}
        enrolledTrackId={enrolledTrackId}
        allCourseCount={allCourses.length}
        commonCourseCount={commonCourseCount}
        selectedScope={selectedScope}
        onSelectScope={handleSelectScope}
        trackFilterMode={trackFilterMode}
        onChangeTrackFilterMode={setTrackFilterMode}
      />

      {!hasResults && (
        <Alert type="info" showIcon title="Chưa có dữ liệu kết quả học tập." />
      )}

      {/* Single tidy View Mode Switcher + Filter Toolbar */}
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={12}
        style={{
          backgroundColor: palette.white,
          border: `1px solid ${palette.slate200}`,
          borderRadius: radius.xl,
          padding: '10px 14px',
        }}
      >
        <Segmented
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          options={[
            { label: 'Theo học kỳ', value: 'SEMESTER' },
            { label: 'Theo cấu trúc CTĐT', value: 'STRUCTURE' },
          ]}
        />

        <Flex align="center" wrap="wrap" gap={8}>
          <Input.Search
            allowClear
            placeholder="Tìm mã hoặc tên học phần"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            style={{ width: 240, maxWidth: '100%' }}
          />
          <Select
            aria-label="Lọc theo trạng thái học phần"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            style={{ width: 170 }}
          />
        </Flex>
      </Flex>

      {/* Curriculum content */}
      {filteredCourses.length === 0 ? (
        <div
          style={{
            backgroundColor: palette.white,
            border: `1px solid ${palette.slate200}`,
            borderRadius: radius.xl,
            padding: '32px 16px',
          }}
        >
          <Empty description="Không tìm thấy học phần phù hợp với bộ lọc.">
            {(hasActiveFilter || selectedScope !== 'ALL') && (
              <Button onClick={handleResetFilters}>Xem toàn bộ CTĐT gốc</Button>
            )}
          </Empty>
        </div>
      ) : viewMode === 'SEMESTER' ? (
        <Collapse
          key={`sem-${contextKey}-${selectedScope}-${trackFilterMode}`}
          defaultActiveKey={filteredTerms.map((t) => String(t.plannedSemester))}
          items={filteredTerms.map((term) => ({
            key: String(term.plannedSemester),
            label: (
              <Flex
                justify="space-between"
                align="center"
                wrap="wrap"
                gap={8}
                style={{ width: '100%' }}
              >
                <Typography.Text strong style={{ color: palette.slate800 }}>
                  Học kỳ {term.plannedSemester}
                </Typography.Text>
                <Flex align="center" gap={10} wrap="wrap">
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 13, ...TABULAR_STYLE }}
                  >
                    {term.courses.length} HP · {term.compulsoryCredits} TC bắt
                    buộc
                  </Typography.Text>
                  <ProgressPill
                    passed={term.passedCount}
                    total={term.courses.length}
                  />
                </Flex>
              </Flex>
            ),
            children: (
              <List
                size="small"
                dataSource={term.courses}
                renderItem={(course) => (
                  <CourseRow
                    course={course}
                    search={search}
                    showTrackBadge={showTrackBadge}
                  />
                )}
              />
            ),
          }))}
        />
      ) : (
        <Collapse
          key={`struct-${contextKey}-${selectedScope}-${trackFilterMode}`}
          defaultActiveKey={structureGroups.map((g) => g.key)}
          items={structureGroups.map((group) => {
            const passed = group.courses.filter((c) =>
              isCoursePassed(c.state),
            ).length;
            const totalCredits = sumCredits(group.courses);
            return {
              key: group.key,
              label: (
                <Flex
                  justify="space-between"
                  align="center"
                  wrap="wrap"
                  gap={8}
                  style={{ width: '100%' }}
                >
                  <Flex align="center" gap={8} wrap="wrap">
                    <Typography.Text strong style={{ color: palette.slate800 }}>
                      {group.title}
                    </Typography.Text>
                    {group.isEnrolled && (
                      <Tag
                        style={{
                          margin: 0,
                          backgroundColor: palette.passSoft,
                          color: palette.passStrong,
                          border: 'none',
                          fontSize: 12,
                        }}
                      >
                        Định hướng của bạn
                      </Tag>
                    )}
                  </Flex>
                  <Flex align="center" gap={10} wrap="wrap">
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 13, ...TABULAR_STYLE }}
                    >
                      {group.courses.length} học phần · {totalCredits} TC
                    </Typography.Text>
                    <ProgressPill passed={passed} total={group.courses.length} />
                  </Flex>
                </Flex>
              ),
              children: (
                <List
                  size="small"
                  dataSource={group.courses}
                  renderItem={(course) => (
                    <CourseRow
                      course={course}
                      search={search}
                      showTrackBadge={false}
                      plannedSemester={course.plannedSemester}
                    />
                  )}
                />
              ),
            };
          })}
        />
      )}

      {/* PLO section */}
      <section
        aria-label="Chuẩn đầu ra chương trình"
        style={{
          backgroundColor: palette.white,
          border: `1px solid ${palette.slate200}`,
          borderRadius: radius.xl,
          padding: '16px 20px',
        }}
      >
        <Typography.Title
          level={5}
          style={{ marginTop: 0, marginBottom: 12, color: palette.slate800 }}
        >
          Chuẩn đầu ra chương trình (PLO)
        </Typography.Title>
        {plos.isPending ? (
          <Skeleton active />
        ) : (
          <List
            size="small"
            bordered
            locale={{ emptyText: 'Chương trình chưa khai báo chuẩn đầu ra.' }}
            dataSource={plos.data ?? []}
            renderItem={(plo) => (
              <List.Item>
                <Flex gap="small" align="start">
                  <Tag>{plo.ploCode}</Tag>
                  <span>{plo.description}</span>
                </Flex>
              </List.Item>
            )}
          />
        )}
      </section>
    </Flex>
  );
}

// MH-56: the frozen curriculum of my applied version, never the newest one.
export function PortalCurriculumPage() {
  const { search } = useLocation();
  return (
    <PortalContextGate>
      {(context) => <Curriculum context={context} search={search} />}
    </PortalContextGate>
  );
}
