import { Alert, Card, Form, Select, Skeleton, Typography } from 'antd';
import { useEffect } from 'react';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import { useCohorts } from '../../../shared/releases/useReleaseOptions';
import { useAppliedCohortVersion } from '../hooks/useReleases';
import { ReleaseQueryError } from './VersionComparisonSections';

interface AppliedCohortVersionPanelProps {
  programId: string;
  initialCohortId?: string;
}
export function AppliedCohortVersionPanel({
  programId,
  initialCohortId,
}: AppliedCohortVersionPanelProps) {
  const cohorts = useCohorts();
  const [form] = Form.useForm<{ cohortId: string; semesterId: string }>();
  const cohortId = Form.useWatch('cohortId', form) ?? '';
  const semesterId = Form.useWatch('semesterId', form) ?? '';
  useEffect(() => {
    if (
      initialCohortId &&
      cohorts.data?.some((cohort) => cohort.id === initialCohortId) &&
      !form.getFieldValue('cohortId')
    )
      form.setFieldValue('cohortId', initialCohortId);
  }, [cohorts.data, initialCohortId, form]);
  const result = useAppliedCohortVersion(programId, cohortId, semesterId);
  return (
    <Card title="Tra cứu phiên bản theo học kỳ">
      {cohorts.error && (
        <ReleaseQueryError
          error={cohorts.error}
          retry={() => void cohorts.refetch()}
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="cohortId"
          label="Khóa tra cứu"
          initialValue={
            cohorts.data?.some((cohort) => cohort.id === initialCohortId)
              ? initialCohortId
              : undefined
          }
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={cohorts.isPending}
            placeholder="Chọn khóa"
            options={(cohorts.data ?? []).map((cohort) => ({
              value: cohort.id,
              label: cohort.cohortCode,
            }))}
          />
        </Form.Item>
        <Form.Item name="semesterId" label="Học kỳ tra cứu">
          <SemesterSelect />
        </Form.Item>
      </Form>
      {!cohortId || !semesterId ? (
        <Typography.Text>Chọn khóa và học kỳ để tra cứu.</Typography.Text>
      ) : result.error ? (
        <ReleaseQueryError
          error={result.error}
          retry={() => void result.refetch()}
        />
      ) : result.isPending ? (
        <Skeleton active />
      ) : (
        result.data && (
          <>
            <Typography.Paragraph>
              Học kỳ tra cứu: {result.data.semester.semesterCode}
            </Typography.Paragraph>
            {result.data.assignment ? (
              <Typography.Paragraph>
                Phiên bản{' '}
                <Link
                  to={generatePath(ROUTES.versionDetail, {
                    programId,
                    versionId: result.data.assignment.version.id,
                  })}
                >
                  {result.data.assignment.version.versionNumber}
                </Link>{' '}
                · Từ học kỳ {result.data.assignment.fromSemester.semesterCode}
              </Typography.Paragraph>
            ) : (
              <Alert
                type="info"
                title="Khóa chưa được gán phiên bản trong học kỳ này."
              />
            )}
          </>
        )
      )}
    </Card>
  );
}
