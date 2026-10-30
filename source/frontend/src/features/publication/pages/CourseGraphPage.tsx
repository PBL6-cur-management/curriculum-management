import {
  Alert,
  Card,
  Descriptions,
  Flex,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { lazy, Suspense, useMemo, useState } from 'react';
import { generatePath, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  BackLink,
  EmptyState,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { GraphNode } from '../api/publication';
import { PdfExportButton } from '../components/PdfExportButton';
import {
  dependencyChain,
  layoutCourseGraph,
  RELATION_LABELS,
} from '../graph/courseGraphLayout';
import { useCourseGraph } from '../hooks/usePublication';

const CourseGraphCanvas = lazy(() =>
  import('../components/CourseGraphCanvas').then((module) => ({
    default: module.CourseGraphCanvas,
  })),
);

const nodeLabel = (node: GraphNode) =>
  `${node.courseCode} — ${node.courseName}${node.external ? ' (ngoài khung)' : ''}`;

function courseTags(
  ids: Set<string>,
  byId: Map<string, GraphNode>,
  color: string,
) {
  const nodes = [...ids]
    .map((id) => byId.get(id)!)
    .sort(
      (a, b) =>
        (a.semester ?? 0) - (b.semester ?? 0) ||
        a.courseCode.localeCompare(b.courseCode),
    );
  return nodes.length ? (
    <Space size={[4, 4]} wrap>
      {nodes.map((node) => (
        <Tag key={node.id} color={color}>
          {node.semester ? `HK${node.semester} · ` : ''}
          {node.courseCode} {node.courseName}
        </Tag>
      ))}
    </Space>
  ) : (
    <Typography.Text type="secondary">Không có</Typography.Text>
  );
}

// MH-20 — US-110: the frame by semester with its requisite edges; choosing a course lights up what it needs
// and what needs it. The list under the picture carries the same facts for keyboard and screen-reader use.
export default function CourseGraphPage() {
  const { programId = '', versionId = '' } = useParams();
  const graph = useCourseGraph(programId, versionId);
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(
    () => (graph.data ? layoutCourseGraph(graph.data) : null),
    [graph.data],
  );
  const chain = useMemo(
    () =>
      graph.data && selected
        ? dependencyChain(graph.data.edges, selected)
        : null,
    [graph.data, selected],
  );
  const byId = useMemo(
    () => new Map((graph.data?.nodes ?? []).map((node) => [node.id, node])),
    [graph.data],
  );

  if (graph.isPending) return <PageSkeleton />;
  if (!graph.data || !layout)
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(graph.error, 'Không đọc được đồ thị học phần.')}
      />
    );
  const { version } = graph.data;
  const external = graph.data.nodes.filter((node) => node.external).length;

  return (
    <Flex vertical gap="middle">
      <BackLink
        to={generatePath(ROUTES.versionDetail, { programId, versionId })}
      >
        Phiên bản {versionLabel(version)}
      </BackLink>
      <PageHeader
        title="Đồ thị học phần"
        subtitle={`${version.programCode} — ${version.programName} · phiên bản ${versionLabel(version)}`}
        actions={
          <PdfExportButton programId={programId} versionId={versionId} />
        }
      />
      {external ? (
        <Alert
          type="warning"
          showIcon
          title={`${external} học phần điều kiện nằm ngoài khung chương trình`}
          description="Chúng được vẽ ở cột “Ngoài khung” để không mất quan hệ phụ thuộc."
        />
      ) : null}
      <Card size="small">
        <Flex vertical gap="small">
          <Space size="middle" wrap>
            <Typography.Text type="secondary">
              Mũi tên: học trước/tiên quyết. Nét đứt không mũi tên: song hành.
            </Typography.Text>
            <Tag color="green">Cần học trước</Tag>
            <Tag color="orange">Phụ thuộc vào học phần đã chọn</Tag>
          </Space>
          {graph.data.nodes.length ? (
            <Suspense fallback={<div style={{ height: layout.height }} />}>
              <CourseGraphCanvas
                nodes={layout.nodes}
                edges={graph.data.edges}
                columns={layout.columns}
                width={layout.width}
                height={layout.height}
                selected={selected}
                chain={chain}
                onSelect={setSelected}
              />
            </Suspense>
          ) : (
            <EmptyState description="Khung chương trình chưa có học phần" />
          )}
        </Flex>
      </Card>
      <Card size="small" title="Phụ thuộc của một học phần">
        <Flex vertical gap="middle">
          <Select
            aria-label="Chọn học phần"
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder="Chọn học phần (hoặc bấm vào đồ thị)"
            style={{ maxWidth: 480 }}
            value={selected ?? undefined}
            onChange={(next: string | undefined) => setSelected(next ?? null)}
            options={graph.data.nodes.map((node) => ({
              value: node.id,
              label: nodeLabel(node),
            }))}
          />
          {selected && chain ? (
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                {
                  key: 'ancestors',
                  label: 'Cần học trước',
                  children: courseTags(chain.ancestors, byId, 'green'),
                },
                {
                  key: 'descendants',
                  label: 'Phụ thuộc vào học phần này',
                  children: courseTags(chain.descendants, byId, 'orange'),
                },
                {
                  key: 'corequisites',
                  label: 'Song hành',
                  children: courseTags(chain.corequisites, byId, 'blue'),
                },
              ]}
            />
          ) : null}
          <Typography.Text type="secondary">
            {graph.data.edges.length} quan hệ:{' '}
            {(['PRIOR', 'PREREQUISITE', 'COREQUISITE'] as const)
              .map(
                (type) =>
                  `${RELATION_LABELS[type]} ${graph.data.edges.filter((edge) => edge.relationType === type).length}`,
              )
              .join(' · ')}
          </Typography.Text>
        </Flex>
      </Card>
    </Flex>
  );
}
