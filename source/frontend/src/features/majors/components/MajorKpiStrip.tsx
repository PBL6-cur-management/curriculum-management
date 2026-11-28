import { Card, Col, Flex, Row, Typography } from 'antd';
import type { MajorOverviewStats } from '../api/majors';

interface MajorKpiStripProps {
  stats: MajorOverviewStats;
}

export function MajorKpiStrip({ stats }: MajorKpiStripProps) {
  const programNotes: string[] = [`Tổng ${stats.totalPrograms}`];
  if (stats.draftPrograms > 0) {
    programNotes.push(`${stats.draftPrograms} soạn thảo`);
  }
  if (stats.inactivePrograms > 0) {
    programNotes.push(`${stats.inactivePrograms} ngừng`);
  }

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} sm={12} md={8} flex="1 1 190px">
        <Card size="small" style={{ height: '100%' }}>
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chương trình đào tạo
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {stats.activePrograms} đang đào tạo
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {programNotes.join(' · ')}
            </Typography.Text>
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} flex="1 1 190px">
        <Card size="small" style={{ height: '100%' }}>
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Phiên bản ban hành
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {stats.releasedVersions}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Phiên bản chính thức đang hiệu lực
            </Typography.Text>
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} flex="1 1 190px">
        <Card size="small" style={{ height: '100%' }}>
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Sinh viên theo học
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {stats.totalStudents.toLocaleString('vi-VN')}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tổng sinh viên các CTĐT thuộc ngành
            </Typography.Text>
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} flex="1 1 190px">
        <Card size="small" style={{ height: '100%' }}>
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Học phần & Đề cương
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {stats.totalCourses} HP
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {stats.publishedSyllabi} ĐCCT ban hành
            </Typography.Text>
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} flex="1 1 190px">
        <Card size="small" style={{ height: '100%' }}>
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chuẩn đầu ra & Tổ chuyên môn
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {stats.totalPlos} PLO · {stats.subjectGroupCount} nhóm CM
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Độ phủ CĐR và đơn vị phụ trách
            </Typography.Text>
          </Flex>
        </Card>
      </Col>
    </Row>
  );
}
