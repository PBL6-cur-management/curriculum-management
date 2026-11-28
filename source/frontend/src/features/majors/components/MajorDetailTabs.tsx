import { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Empty,
  Flex,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { withQuery } from '../../../shared/api/client';
import { ProgramStatusTag } from '../../programs/components/ProgramStatusTag';
import type {
  MajorOverview,
  MajorOverviewCohortBreakdown,
  MajorOverviewCourse,
  MajorOverviewProgram,
  MajorOverviewSubjectGroup,
} from '../api/majors';
import {
  MAJOR_COURSE_TYPE_LABELS,
  MAJOR_PROGRAM_DEGREE_LABELS,
  SUBJECT_GROUP_STATUS_COLORS,
  SUBJECT_GROUP_STATUS_LABELS,
} from '../constants/majorLabels';

type ProgramFilterStatus = 'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE';

interface MajorDetailTabsProps {
  overview: MajorOverview;
}

const PROGRAM_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang đào tạo' },
  { value: 'DRAFT', label: 'Đang soạn thảo' },
  { value: 'INACTIVE', label: 'Ngừng sử dụng' },
];

export function MajorDetailTabs({ overview }: MajorDetailTabsProps) {
  const { major, programs, courses, subjectGroups, cohortBreakdown } = overview;

  const [programSearch, setProgramSearch] = useState('');
  const [programStatusFilter, setProgramStatusFilter] =
    useState<ProgramFilterStatus>('ALL');

  const [courseSearch, setCourseSearch] = useState('');
  const [onlyUnpublishedSyllabus, setOnlyUnpublishedSyllabus] = useState(false);

  const filteredPrograms = useMemo(() => {
    const keyword = programSearch.trim().toLowerCase();
    return programs.filter((p) => {
      if (programStatusFilter === 'ACTIVE') {
        if (!(p.status === 'ACTIVE' && p.hasReleasedVersion)) return false;
      } else if (programStatusFilter === 'DRAFT') {
        if (!(p.status === 'ACTIVE' && !p.hasReleasedVersion)) return false;
      } else if (programStatusFilter === 'INACTIVE') {
        if (p.status !== 'INACTIVE') return false;
      }

      if (!keyword) return true;
      return (
        p.programCode.toLowerCase().includes(keyword) ||
        p.programName.toLowerCase().includes(keyword)
      );
    });
  }, [programs, programSearch, programStatusFilter]);

  const filteredCourses = useMemo(() => {
    const keyword = courseSearch.trim().toLowerCase();
    return courses.filter((c) => {
      if (onlyUnpublishedSyllabus && c.hasPublishedSyllabus) return false;
      if (!keyword) return true;
      return (
        c.courseCode.toLowerCase().includes(keyword) ||
        c.courseName.toLowerCase().includes(keyword)
      );
    });
  }, [courses, courseSearch, onlyUnpublishedSyllabus]);

  const programsWithVersion = useMemo(
    () => programs.filter((p) => Boolean(p.latestVersionId)),
    [programs],
  );

  const buildProgramShortcutItems = (
    p: MajorOverviewProgram,
  ): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    if (p.latestVersionId) {
      const versionParams = {
        programId: p.id,
        versionId: p.latestVersionId,
      };
      items.push(
        {
          key: 'curriculum',
          label: (
            <Link to={generatePath(ROUTES.curriculum, versionParams)}>
              Khung CT
            </Link>
          ),
        },
        {
          key: 'plos',
          label: (
            <Link to={generatePath(ROUTES.plos, versionParams)}>PLO</Link>
          ),
        },
        {
          key: 'coursePloMatrix',
          label: (
            <Link to={generatePath(ROUTES.coursePloMatrix, versionParams)}>
              Ma trận HP–PLO
            </Link>
          ),
        },
        {
          key: 'courseGraph',
          label: (
            <Link to={generatePath(ROUTES.courseGraph, versionParams)}>
              Sơ đồ tiên quyết
            </Link>
          ),
        },
        {
          key: 'health',
          label: (
            <Link to={generatePath(ROUTES.programHealth, versionParams)}>
              Sức khỏe CT
            </Link>
          ),
        },
        { type: 'divider' },
      );
    }
    items.push({
      key: 'versions',
      label: (
        <Link to={generatePath(ROUTES.versionHistory, { programId: p.id })}>
          Lịch sử PB
        </Link>
      ),
    });
    return items;
  };

  const programColumns: ColumnsType<MajorOverviewProgram> = [
    {
      title: 'Mã CTĐT',
      dataIndex: 'programCode',
      key: 'programCode',
      width: 120,
      render: (code: string, row) => (
        <Link to={generatePath(ROUTES.programDetail, { programId: row.id })}>
          <Typography.Text strong>{code}</Typography.Text>
        </Link>
      ),
    },
    {
      title: 'Tên chương trình',
      key: 'programName',
      render: (_, row) => (
        <Flex vertical gap={2}>
          <Link to={generatePath(ROUTES.programDetail, { programId: row.id })}>
            {row.programName}
          </Link>
          {row.trackCount > 0 && (
            <Space size={4}>
              <Tag color="geekblue">{row.trackCount} chuyên ngành</Tag>
            </Space>
          )}
        </Flex>
      ),
    },
    {
      title: 'Bậc',
      dataIndex: 'degreeLevel',
      key: 'degreeLevel',
      width: 95,
      render: (val: MajorOverviewProgram['degreeLevel']) => (
        <Tag>{MAJOR_PROGRAM_DEGREE_LABELS[val] ?? val}</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 135,
      render: (_, row) => (
        <ProgramStatusTag
          status={row.status}
          hasReleasedVersion={row.hasReleasedVersion}
        />
      ),
    },
    {
      title: 'Phiên bản mới nhất',
      key: 'latestVersion',
      width: 145,
      render: (_, row) =>
        row.latestVersionNumber ? (
          <Space size={4} wrap>
            <Tag color="blue">v{row.latestVersionNumber}</Tag>
            {row.totalCredits !== null && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.totalCredits} TC
              </Typography.Text>
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary">Chưa có</Typography.Text>
        ),
    },
    {
      title: 'PLO / HP',
      key: 'ploCourse',
      width: 105,
      align: 'right',
      render: (_, row) => (
        <Typography.Text>
          {row.ploCount} / {row.courseCount}
        </Typography.Text>
      ),
    },
    {
      title: 'Sinh viên',
      key: 'studentCount',
      width: 95,
      align: 'right',
      render: (_, row) => (
        <Link to={withQuery(ROUTES.students, { programId: row.id })}>
          {row.studentCount.toLocaleString('vi-VN')}
        </Link>
      ),
    },
    {
      title: 'Khóa áp dụng',
      key: 'cohorts',
      width: 140,
      render: (_, row) =>
        row.cohorts.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {row.cohorts.map((code) => (
              <Tag key={code}>K{code}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Giám đốc CTĐT',
      key: 'directors',
      width: 170,
      render: (_, row) =>
        row.directors.length > 0 ? (
          <Flex vertical gap={2}>
            {row.directors.map((d) => (
              <Typography.Text key={d.id} style={{ fontSize: 13 }}>
                {d.fullName}
              </Typography.Text>
            ))}
          </Flex>
        ) : (
          <Typography.Text type="secondary">Chưa gán</Typography.Text>
        ),
    },
    {
      title: 'Truy cập nhanh',
      key: 'quickAccess',
      width: 185,
      render: (_, row) => (
        <Space size="small">
          <Link to={generatePath(ROUTES.programDetail, { programId: row.id })}>
            <Button size="small">Tổng quan</Button>
          </Link>
          <Dropdown
            menu={{ items: buildProgramShortcutItems(row) }}
            trigger={['click']}
          >
            <Button size="small">
              Lối tắt <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const courseColumns: ColumnsType<MajorOverviewCourse> = [
    {
      title: 'Mã HP',
      dataIndex: 'courseCode',
      key: 'courseCode',
      width: 120,
      render: (code: string, row) => (
        <Link to={generatePath(ROUTES.courseDetail, { courseId: row.id })}>
          <Typography.Text strong>{code}</Typography.Text>
        </Link>
      ),
    },
    {
      title: 'Tên học phần',
      key: 'courseName',
      render: (_, row) => (
        <Link to={generatePath(ROUTES.courseDetail, { courseId: row.id })}>
          {row.courseName}
        </Link>
      ),
    },
    {
      title: 'Số TC',
      dataIndex: 'credits',
      key: 'credits',
      width: 80,
      align: 'right',
    },
    {
      title: 'Loại HP',
      dataIndex: 'courseType',
      key: 'courseType',
      width: 130,
      render: (val: MajorOverviewCourse['courseType']) => (
        <Tag>{MAJOR_COURSE_TYPE_LABELS[val] ?? val}</Tag>
      ),
    },
    {
      title: 'Nhóm chuyên môn',
      key: 'ownerGroup',
      render: (_, row) =>
        row.ownerGroup ? (
          <Link
            to={generatePath(ROUTES.subjectGroupDetail, {
              groupId: row.ownerGroup.id,
            })}
          >
            {row.ownerGroup.groupName}
          </Link>
        ) : (
          <Typography.Text type="secondary">Chưa gán</Typography.Text>
        ),
    },
    {
      title: 'Số CTĐT sử dụng',
      dataIndex: 'programCount',
      key: 'programCount',
      width: 135,
      align: 'right',
    },
    {
      title: 'Đề cương',
      dataIndex: 'hasPublishedSyllabus',
      key: 'hasPublishedSyllabus',
      width: 125,
      render: (published: boolean) => (
        <Tag color={published ? 'green' : 'gold'}>
          {published ? 'Đã ban hành' : 'Bản nháp'}
        </Tag>
      ),
    },
    {
      title: 'Truy cập nhanh',
      key: 'actions',
      width: 185,
      render: (_, row) => (
        <Space size="small">
          <Link to={generatePath(ROUTES.courseDetail, { courseId: row.id })}>
            <Button size="small">Chi tiết HP</Button>
          </Link>
          <Link to={generatePath(ROUTES.syllabus, { courseId: row.id })}>
            <Button size="small" type="text">
              Đề cương
            </Button>
          </Link>
        </Space>
      ),
    },
  ];

  const cohortColumns: ColumnsType<MajorOverviewCohortBreakdown> = [
    {
      title: 'Khóa',
      dataIndex: 'cohortCode',
      key: 'cohortCode',
      width: 110,
      render: (code: string) => <Tag color="blue">K{code}</Tag>,
    },
    {
      title: 'Chương trình đào tạo',
      key: 'program',
      render: (_, row) => (
        <Flex vertical>
          <Link
            to={generatePath(ROUTES.programDetail, {
              programId: row.programId,
            })}
          >
            <Typography.Text strong>{row.programCode}</Typography.Text> —{' '}
            {row.programName}
          </Link>
        </Flex>
      ),
    },
    {
      title: 'Số sinh viên',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 140,
      align: 'right',
      render: (count: number) => count.toLocaleString('vi-VN'),
    },
    {
      title: 'Truy cập nhanh',
      key: 'actions',
      width: 240,
      render: (_, row) => (
        <Space size="small">
          <Link to={withQuery(ROUTES.students, { programId: row.programId })}>
            <Button size="small">Danh sách SV</Button>
          </Link>
          <Link to={ROUTES.graduation}>
            <Button size="small" type="text">
              Xét tốt nghiệp
            </Button>
          </Link>
        </Space>
      ),
    },
  ];

  const subjectGroupColumns: ColumnsType<MajorOverviewSubjectGroup> = [
    {
      title: 'Mã nhóm',
      dataIndex: 'groupCode',
      key: 'groupCode',
      width: 140,
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Tên nhóm chuyên môn',
      key: 'groupName',
      render: (_, row) => (
        <Link
          to={generatePath(ROUTES.subjectGroupDetail, { groupId: row.id })}
        >
          {row.groupName}
        </Link>
      ),
    },
    {
      title: 'Giảng viên',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 120,
      align: 'right',
    },
    {
      title: 'Học phần phụ trách',
      dataIndex: 'courseCount',
      key: 'courseCount',
      width: 155,
      align: 'right',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: MajorOverviewSubjectGroup['status']) => (
        <Tag color={SUBJECT_GROUP_STATUS_COLORS[val]}>
          {SUBJECT_GROUP_STATUS_LABELS[val]}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      render: (_, row) => (
        <Link
          to={generatePath(ROUTES.subjectGroupDetail, { groupId: row.id })}
        >
          <Button size="small">Xem chi tiết</Button>
        </Link>
      ),
    },
  ];

  const outcomeColumns: ColumnsType<MajorOverviewProgram> = [
    {
      title: 'CTĐT',
      key: 'program',
      render: (_, row) => (
        <Flex vertical gap={2}>
          <Link to={generatePath(ROUTES.programDetail, { programId: row.id })}>
            <Typography.Text strong>{row.programCode}</Typography.Text> —{' '}
            {row.programName}
          </Link>
          {row.latestVersionNumber && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Phiên bản v{row.latestVersionNumber}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'Số PLO',
      dataIndex: 'ploCount',
      key: 'ploCount',
      width: 95,
      align: 'right',
    },
    {
      title: 'Số HP',
      dataIndex: 'courseCount',
      key: 'courseCount',
      width: 95,
      align: 'right',
    },
    {
      title: 'Truy cập chuẩn đầu ra',
      key: 'outcomeLinks',
      width: 440,
      render: (_, row) => {
        if (!row.latestVersionId) return null;
        const params = {
          programId: row.id,
          versionId: row.latestVersionId,
        };
        return (
          <Space size="small" wrap>
            <Link to={generatePath(ROUTES.plos, params)}>
              <Button size="small">Danh sách PLO</Button>
            </Link>
            <Link to={generatePath(ROUTES.coursePloMatrix, params)}>
              <Button size="small">Ma trận HP–PLO</Button>
            </Link>
            <Link to={generatePath(ROUTES.cloPloMatrix, params)}>
              <Button size="small">Ma trận CLO–PLO</Button>
            </Link>
            <Link to={generatePath(ROUTES.outcomeCoverage, params)}>
              <Button size="small">Độ phủ CĐR</Button>
            </Link>
          </Space>
        );
      },
    },
  ];

  const tabItems = [
    {
      key: 'programs',
      label: `Chương trình đào tạo (${programs.length})`,
      children: (
        <Flex vertical gap="middle">
          <Flex gap="small" wrap align="center">
            <Input.Search
              placeholder="Tìm theo mã hoặc tên CTĐT..."
              allowClear
              style={{ width: 280 }}
              value={programSearch}
              onChange={(e) => setProgramSearch(e.target.value)}
            />
            <Select<ProgramFilterStatus>
              style={{ width: 190 }}
              options={PROGRAM_STATUS_FILTER_OPTIONS}
              value={programStatusFilter}
              onChange={setProgramStatusFilter}
            />
          </Flex>
          <Table<MajorOverviewProgram>
            rowKey="id"
            dataSource={filteredPrograms}
            columns={programColumns}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có chương trình đào tạo phù hợp."
                />
              ),
            }}
          />
        </Flex>
      ),
    },
    {
      key: 'courses',
      label: `Học phần trong ngành (${courses.length})`,
      children: (
        <Flex vertical gap="middle">
          <Flex gap="small" wrap align="center">
            <Input.Search
              placeholder="Tìm theo mã hoặc tên học phần..."
              allowClear
              style={{ width: 280 }}
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
            <Space size="small">
              <Switch
                id="only-unpublished-syllabus-switch"
                checked={onlyUnpublishedSyllabus}
                onChange={setOnlyUnpublishedSyllabus}
              />
              <Typography.Text>Chỉ HP chưa có ĐCCT ban hành</Typography.Text>
            </Space>
          </Flex>
          <Table<MajorOverviewCourse>
            rowKey="id"
            dataSource={filteredCourses}
            columns={courseColumns}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có học phần phù hợp trong ngành này."
                />
              ),
            }}
          />
        </Flex>
      ),
    },
    {
      key: 'students',
      label: `Sinh viên & Khóa tuyển sinh (${cohortBreakdown.length})`,
      children:
        cohortBreakdown.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có dữ liệu sinh viên theo khóa tuyển sinh cho ngành này."
          >
            <Link to={ROUTES.students}>
              <Button type="primary">Mở danh sách sinh viên</Button>
            </Link>
          </Empty>
        ) : (
          <Table<MajorOverviewCohortBreakdown>
            rowKey={(row) => `${row.programId}-${row.cohortId}`}
            dataSource={cohortBreakdown}
            columns={cohortColumns}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
          />
        ),
    },
    {
      key: 'organization',
      label: `Khoa & Nhóm chuyên môn (${subjectGroups.length})`,
      children: (
        <Flex vertical gap="middle">
          <Card size="small" title="Khoa phụ trách">
            {major.faculty ? (
              <Flex justify="space-between" align="center" wrap gap="small">
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="Mã khoa">
                    <Typography.Text code>
                      {major.faculty.unitCode}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tên khoa">
                    <Typography.Text strong>
                      {major.faculty.unitName}
                    </Typography.Text>
                  </Descriptions.Item>
                </Descriptions>
                <Space wrap size="small">
                  <Link
                    to={withQuery(ROUTES.programs, {
                      facultyId: major.faculty.id,
                    })}
                  >
                    <Button size="small">CTĐT thuộc khoa</Button>
                  </Link>
                  <Link to={ROUTES.subjectGroups}>
                    <Button size="small">Nhóm chuyên môn</Button>
                  </Link>
                  <Link to={ROUTES.orgUnits}>
                    <Button size="small">Cơ cấu tổ chức</Button>
                  </Link>
                </Space>
              </Flex>
            ) : (
              <Flex justify="space-between" align="center" wrap gap="small">
                <Typography.Text type="secondary">
                  Ngành chưa gắn khoa phụ trách cụ thể (toàn trường).
                </Typography.Text>
                <Space wrap size="small">
                  <Link to={ROUTES.subjectGroups}>
                    <Button size="small">Nhóm chuyên môn</Button>
                  </Link>
                  <Link to={ROUTES.orgUnits}>
                    <Button size="small">Cơ cấu tổ chức</Button>
                  </Link>
                </Space>
              </Flex>
            )}
          </Card>
          <Table<MajorOverviewSubjectGroup>
            rowKey="id"
            dataSource={subjectGroups}
            columns={subjectGroupColumns}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có nhóm chuyên môn nào phụ trách học phần của ngành này."
                />
              ),
            }}
          />
        </Flex>
      ),
    },
    {
      key: 'outcomes',
      label: 'Chuẩn đầu ra & Báo cáo',
      children: (
        <Flex vertical gap="middle">
          <Table<MajorOverviewProgram>
            rowKey="id"
            dataSource={programsWithVersion}
            columns={outcomeColumns}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có chương trình đào tạo nào có phiên bản để xem chuẩn đầu ra."
                />
              ),
            }}
          />
          <Card size="small" title="Báo cáo & Đối sánh cấp trường">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Flex vertical gap={8}>
                    <Typography.Text strong>
                      So sánh chương trình đào tạo
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Đối chiếu cấu trúc tín chỉ, khối kiến thức và chuẩn đầu ra
                      giữa các CTĐT.
                    </Typography.Text>
                    <Link to={ROUTES.reportComparison}>
                      <Button size="small">Mở báo cáo so sánh</Button>
                    </Link>
                  </Flex>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Flex vertical gap={8}>
                    <Typography.Text strong>Phân bố tín chỉ</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Thống kê tỷ trọng học phần bắt buộc, tự chọn và phân bố
                      theo học kỳ.
                    </Typography.Text>
                    <Link to={ROUTES.reportCredits}>
                      <Button size="small">Xem phân bố tín chỉ</Button>
                    </Link>
                  </Flex>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Flex vertical gap={8}>
                    <Typography.Text strong>Báo cáo kiểm định</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Xuất hồ sơ minh chứng PLO, ma trận HP–PLO và độ phủ chuẩn
                      đầu ra.
                    </Typography.Text>
                    <Link to={ROUTES.reportAccreditation}>
                      <Button size="small">Xuất báo cáo kiểm định</Button>
                    </Link>
                  </Flex>
                </Card>
              </Col>
            </Row>
          </Card>
        </Flex>
      ),
    },
  ];

  return (
    <Card size="small">
      <Tabs defaultActiveKey="programs" items={tabItems} />
    </Card>
  );
}
