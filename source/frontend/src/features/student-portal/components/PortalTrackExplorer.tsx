import { Flex, Segmented, Tag, Tooltip, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { palette, radius } from '../../../shared/design-system/tokens';
import type { PortalTrack } from '../api/portal';

export type TrackScope = 'ALL' | 'COMMON' | string;
export type TrackFilterMode = 'WITH_COMMON' | 'TRACK_ONLY';

export interface PortalTrackExplorerProps {
  programName: string;
  versionNumber: string | null;
  decisionNumber: string | null;
  totalCredits: string;
  compulsoryCredits?: string;
  electiveCredits?: string;
  passedCredits: string;
  tracks: PortalTrack[];
  enrolledTrackId: string | null;
  allCourseCount: number;
  commonCourseCount: number;
  selectedScope: TrackScope;
  onSelectScope: (scope: TrackScope) => void;
  trackFilterMode: TrackFilterMode;
  onChangeTrackFilterMode: (mode: TrackFilterMode) => void;
}

const TABULAR_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

function pillStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    padding: '4px 12px',
    borderRadius: radius.lg,
    border: `1px solid ${active ? palette.brand : palette.slate300}`,
    backgroundColor: active ? palette.brandSoft : palette.white,
    color: active ? palette.brandStrong : palette.slate700,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    lineHeight: 1.4,
    cursor: 'pointer',
    transition:
      'background-color 160ms cubic-bezier(0.4, 0, 0.2, 1), border-color 160ms cubic-bezier(0.4, 0, 0.2, 1), color 160ms cubic-bezier(0.4, 0, 0.2, 1)',
    ...TABULAR_STYLE,
  };
}

function KpiItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'pass' | 'brand';
}) {
  const valueColor =
    accent === 'pass'
      ? palette.passStrong
      : accent === 'brand'
        ? palette.brandStrong
        : palette.slate800;
  return (
    <Flex vertical gap={2} style={{ minWidth: 0 }}>
      <Typography.Text
        style={{ fontSize: 12, color: palette.slate500, lineHeight: 1.4 }}
      >
        {label}
      </Typography.Text>
      <Typography.Text
        strong
        style={{
          fontSize: 15,
          color: valueColor,
          lineHeight: 1.4,
          ...TABULAR_STYLE,
        }}
      >
        {value}
      </Typography.Text>
    </Flex>
  );
}

export function PortalTrackExplorer({
  programName,
  versionNumber,
  decisionNumber,
  totalCredits,
  compulsoryCredits,
  electiveCredits,
  passedCredits,
  tracks,
  enrolledTrackId,
  allCourseCount,
  commonCourseCount,
  selectedScope,
  onSelectScope,
  trackFilterMode,
  onChangeTrackFilterMode,
}: PortalTrackExplorerProps) {
  const selectedTrack =
    selectedScope !== 'ALL' && selectedScope !== 'COMMON'
      ? (tracks.find((t) => t.id === selectedScope) ?? null)
      : null;

  return (
    <section
      aria-label="Tổng quan chương trình gốc"
      style={{
        backgroundColor: palette.white,
        border: `1px solid ${palette.slate200}`,
        borderRadius: radius.xl,
        padding: '16px 20px',
      }}
    >
      <Flex vertical gap={14}>
        {/* Compact Chương trình gốc header */}
        <Flex justify="space-between" align="start" wrap="wrap" gap={12}>
          <Flex vertical gap={4} style={{ minWidth: 0 }}>
            <Flex align="center" wrap="wrap" gap={8}>
              <Typography.Title
                level={4}
                style={{ margin: 0, color: palette.slate800 }}
              >
                {programName}
              </Typography.Title>
              <Tag
                style={{
                  margin: 0,
                  backgroundColor: palette.brandSoft,
                  color: palette.brandStrong,
                  border: 'none',
                  fontWeight: 500,
                }}
              >
                Phiên bản {versionNumber ?? '—'}
              </Tag>
              {decisionNumber && (
                <Tag
                  style={{
                    margin: 0,
                    backgroundColor: palette.slate100,
                    color: palette.slate700,
                    border: 'none',
                  }}
                >
                  QĐ {decisionNumber}
                </Tag>
              )}
              <Tag
                style={{
                  margin: 0,
                  backgroundColor: palette.slate100,
                  color: palette.slate700,
                  border: `1px solid ${palette.slate200}`,
                  ...TABULAR_STYLE,
                }}
              >
                {tracks.length > 0
                  ? `${tracks.length} định hướng / chuyên ngành`
                  : 'Khung chung'}
              </Tag>
            </Flex>
          </Flex>
        </Flex>

        {/* Credit KPIs strip */}
        <Flex
          wrap="wrap"
          gap={24}
          style={{
            paddingTop: 12,
            borderTop: `1px solid ${palette.slate200}`,
          }}
        >
          <KpiItem label="Tổng tín chỉ" value={`${totalCredits} TC`} />
          {compulsoryCredits !== undefined && (
            <KpiItem label="Bắt buộc" value={`${compulsoryCredits} TC`} />
          )}
          {electiveCredits !== undefined && (
            <KpiItem label="Tự chọn" value={`${electiveCredits} TC`} />
          )}
          <KpiItem
            label="Tiến độ tích lũy"
            value={`Đã đạt ${passedCredits} / ${totalCredits} TC`}
            accent={Number(passedCredits) > 0 ? 'pass' : undefined}
          />
        </Flex>

        {/* Interactive Track / Orientation Explorer Strip */}
        {tracks.length > 0 && (
          <Flex
            vertical
            gap={10}
            style={{
              paddingTop: 12,
              borderTop: `1px solid ${palette.slate200}`,
            }}
          >
            <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
              <Typography.Text
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: palette.slate500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                Khám phá chương trình gốc &amp; định hướng
              </Typography.Text>
            </Flex>

            <Flex
              wrap="wrap"
              gap={8}
              role="group"
              aria-label="Chọn phạm vi định hướng"
            >
              <button
                type="button"
                aria-pressed={selectedScope === 'ALL'}
                onClick={() => onSelectScope('ALL')}
                style={pillStyle(selectedScope === 'ALL')}
              >
                <span>Toàn bộ CTĐT gốc</span>
                <span
                  style={{
                    fontSize: 12,
                    color:
                      selectedScope === 'ALL'
                        ? palette.brandStrong
                        : palette.slate500,
                  }}
                >
                  {allCourseCount} HP
                </span>
              </button>

              <button
                type="button"
                aria-pressed={selectedScope === 'COMMON'}
                onClick={() => onSelectScope('COMMON')}
                style={pillStyle(selectedScope === 'COMMON')}
              >
                <span>Khung chung</span>
                <span
                  style={{
                    fontSize: 12,
                    color:
                      selectedScope === 'COMMON'
                        ? palette.brandStrong
                        : palette.slate500,
                  }}
                >
                  {commonCourseCount} HP
                </span>
              </button>

              {tracks.map((track) => {
                const isActive = selectedScope === track.id;
                const isEnrolled = track.id === enrolledTrackId;
                const tooltipTitle = (
                  <div>
                    <div style={{ fontWeight: 600 }}>{track.trackName}</div>
                    {track.englishName && (
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {track.englishName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      Bắt buộc {track.compulsoryCredits} TC · Tự chọn{' '}
                      {track.electiveCredits} TC
                    </div>
                    {isEnrolled && (
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        Định hướng của bạn
                      </div>
                    )}
                  </div>
                );
                return (
                  <Tooltip key={track.id} title={tooltipTitle}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onSelectScope(track.id)}
                      style={pillStyle(isActive)}
                    >
                      {isEnrolled && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: palette.pass,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span>{track.trackCode}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: isActive
                            ? palette.brandStrong
                            : palette.slate500,
                        }}
                      >
                        · {track.itemCount} HP
                      </span>
                      {isEnrolled && (
                        <span
                          style={{
                            fontSize: 11,
                            color: palette.passStrong,
                            fontWeight: 500,
                          }}
                        >
                          (Định hướng của bạn)
                        </span>
                      )}
                    </button>
                  </Tooltip>
                );
              })}
            </Flex>

            {selectedTrack && (
              <Flex
                justify="space-between"
                align="center"
                wrap="wrap"
                gap={12}
                style={{
                  backgroundColor: palette.brandSoft,
                  border: `1px solid ${palette.slate200}`,
                  borderRadius: radius.lg,
                  padding: '10px 14px',
                }}
              >
                <Flex vertical gap={2} style={{ minWidth: 0 }}>
                  <Flex align="center" wrap="wrap" gap={8}>
                    <Typography.Text
                      strong
                      style={{ color: palette.brandStrong, fontSize: 14 }}
                    >
                      {selectedTrack.trackCode} — {selectedTrack.trackName}
                    </Typography.Text>
                    {selectedTrack.id === enrolledTrackId && (
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
                  <Typography.Text
                    style={{
                      fontSize: 12,
                      color: palette.slate600,
                      ...TABULAR_STYLE,
                    }}
                  >
                    Bắt buộc {selectedTrack.compulsoryCredits} TC · Tự chọn{' '}
                    {selectedTrack.electiveCredits} TC ·{' '}
                    {selectedTrack.itemCount} học phần
                    {selectedTrack.description
                      ? ` · ${selectedTrack.description}`
                      : ''}
                  </Typography.Text>
                </Flex>

                <Segmented
                  size="small"
                  value={trackFilterMode}
                  onChange={(value) =>
                    onChangeTrackFilterMode(value as TrackFilterMode)
                  }
                  options={[
                    {
                      label: 'Khung chung + Định hướng này',
                      value: 'WITH_COMMON',
                    },
                    {
                      label: 'Chỉ học phần của định hướng',
                      value: 'TRACK_ONLY',
                    },
                  ]}
                />
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </section>
  );
}
