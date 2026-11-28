import { useMemo, useState } from 'react';
import { Button, Card, Col, Flex, Result, Row, Segmented, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { useOrgUnits } from '../../../shared/org-units/useOrgUnits';
import { useSubjectGroups } from '../../../shared/subject-groups/useSubjectGroups';
import type { OrgUnit } from '../../../shared/org-units/orgUnits';
import { buildOrgTree, type OrgTreeNode } from '../utils/buildOrgTree';
import {
  EXTERNAL_UNIT_TAG_LABEL,
  ORG_UNIT_SCOPE_OPTIONS,
  UNIT_TYPE_LABELS,
  type OrgUnitScopeFilter,
} from '../constants/orgUnitLabels';
import { OrgUnitDetailPanel } from '../components/OrgUnitDetailPanel';
import { OrgUnitFormModal } from '../components/OrgUnitFormModal';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

type Editor = { mode: 'create' | 'edit'; parent?: OrgUnit; unit?: OrgUnit };

function filterUnitsByScope(
  allUnits: readonly OrgUnit[],
  scope: OrgUnitScopeFilter,
): OrgUnit[] {
  if (scope === 'ALL') return [...allUnits];
  if (scope === 'INTERNAL')
    return allUnits.filter((unit) => !unit.isExternal);
  const byId = new Map(allUnits.map((unit) => [unit.id, unit]));
  const kept = new Set<string>();
  for (const unit of allUnits) {
    if (!unit.isExternal) continue;
    let current: OrgUnit | undefined = unit;
    while (current && !kept.has(current.id)) {
      kept.add(current.id);
      current = current.parentUnitId ? byId.get(current.parentUnitId) : undefined;
    }
  }
  return allUnits.filter((unit) => kept.has(unit.id));
}

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
        {node.unit.isExternal && (
          <Tag color="orange">{EXTERNAL_UNIT_TAG_LABEL}</Tag>
        )}
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
  const [scope, setScope] = useState<OrgUnitScopeFilter>('ALL');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);

  const visibleUnits = useMemo(
    () => filterUnitsByScope(units.data ?? [], scope),
    [units.data, scope],
  );
  const visibleGroups = useMemo(() => {
    const allGroups = groups.data ?? [];
    if (scope === 'ALL') return allGroups;
    const allowedFaculties = new Set(
      (units.data ?? [])
        .filter((unit) =>
          scope === 'EXTERNAL' ? Boolean(unit.isExternal) : !unit.isExternal,
        )
        .map((unit) => unit.id),
    );
    return allGroups.filter((group) => allowedFaculties.has(group.faculty.id));
  }, [groups.data, units.data, scope]);

  const tree = useMemo(
    () => buildOrgTree(visibleUnits, visibleGroups),
    [visibleUnits, visibleGroups],
  );
  // Every node is expanded unless the user collapsed it, so a unit added later
  // under a childless parent is visible at once.
  const expandedKeys = visibleUnits
    .map((unit) => unit.id)
    .filter((key) => !collapsed.has(key));
  if (units.isPending || groups.isPending) return <PageSkeleton />;
  if (units.isError)
    return <Result status="error" title="Không tải được cây đơn vị" />;
  const root = units.data?.find((unit) => unit.unitType === 'UNIVERSITY');
  const currentSelected = selected
    ? (visibleUnits.find((unit) => unit.id === selected.id) ?? null)
    : null;
  return (
    <>
      <PageHeader
        title="Đơn vị"
        actions={
          <Flex gap="small" align="center" wrap>
            <Segmented<OrgUnitScopeFilter>
              options={ORG_UNIT_SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
            />
            <Button
              type="primary"
              onClick={() => setEditor({ mode: 'create', parent: root })}
            >
              Thêm đơn vị
            </Button>
          </Flex>
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
          {currentSelected ? (
            <OrgUnitDetailPanel
              unit={currentSelected}
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
