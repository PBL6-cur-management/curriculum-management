import { useMemo, useState } from 'react';
import { Button, Card, Col, Result, Row, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { useOrgUnits } from '../../../shared/org-units/useOrgUnits';
import { useSubjectGroups } from '../../../shared/subject-groups/useSubjectGroups';
import type { OrgUnit } from '../../../shared/org-units/orgUnits';
import { buildOrgTree, type OrgTreeNode } from '../utils/buildOrgTree';
import { UNIT_TYPE_LABELS } from '../constants/orgUnitLabels';
import { OrgUnitDetailPanel } from '../components/OrgUnitDetailPanel';
import { OrgUnitFormModal } from '../components/OrgUnitFormModal';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

type Editor = { mode: 'create' | 'edit'; parent?: OrgUnit; unit?: OrgUnit };
function toDataNode(
  node: OrgTreeNode,
  select: (unit: OrgUnit) => void,
): DataNode {
  if (node.kind === 'group')
    return {
      key: node.key,
      title: (
        <Link
          to={generatePath(ROUTES.subjectGroupDetail, {
            groupId: node.group.id,
          })}
        >
          {node.group.groupName} <Tag>Nhóm chuyên môn</Tag>
        </Link>
      ),
      children: [],
    };
  return {
    key: node.key,
    title: (
      <span onClick={() => select(node.unit)}>
        {node.unit.unitName} <Tag>{UNIT_TYPE_LABELS[node.unit.unitType]}</Tag>
        {node.unit.status === 'INACTIVE' && <Tag>Ngừng hoạt động</Tag>}
      </span>
    ),
    children: node.children.map((child) => toDataNode(child, select)),
  };
}
export function OrgUnitTreePage() {
  const units = useOrgUnits();
  const groups = useSubjectGroups();
  const [selected, setSelected] = useState<OrgUnit | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const tree = useMemo(
    () => buildOrgTree(units.data ?? [], groups.data ?? []),
    [units.data, groups.data],
  );
  // Every node is expanded unless the user collapsed it, so a unit added later
  // under a childless parent is visible at once.
  const expandedKeys = (units.data ?? [])
    .map((unit) => unit.id)
    .filter((key) => !collapsed.has(key));
  if (units.isPending || groups.isPending) return <PageSkeleton />;
  if (units.isError)
    return <Result status="error" title="Không tải được cây đơn vị" />;
  const root = units.data?.find((unit) => unit.unitType === 'UNIVERSITY');
  return (
    <>
      <PageHeader
        title="Đơn vị"
        actions={
          <Button
            type="primary"
            onClick={() => setEditor({ mode: 'create', parent: root })}
          >
            Thêm đơn vị
          </Button>
        }
      />
      <Row gutter={16}>
        <Col span={12}>
          <Card>
            <Tree
              expandedKeys={expandedKeys}
              onExpand={(_keys, info) =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  const key = String(info.node.key);
                  if (info.expanded) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              blockNode
              treeData={tree.map((node) => toDataNode(node, setSelected))}
              onSelect={(_selectedKeys, info) => {
                const found = units.data?.find(
                  (unit) => unit.id === String(info.node.key),
                );
                if (found) setSelected(found);
              }}
            />
          </Card>
        </Col>
        <Col span={12}>
          {selected ? (
            <OrgUnitDetailPanel
              unit={selected}
              onEdit={(unit) => setEditor({ mode: 'edit', unit })}
              onAddChild={(parent) => setEditor({ mode: 'create', parent })}
            />
          ) : (
            <Card>Chọn một đơn vị</Card>
          )}
        </Col>
      </Row>
      <OrgUnitFormModal
        open={editor !== null}
        mode={editor?.mode ?? 'create'}
        parent={editor?.parent}
        unit={editor?.unit}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
