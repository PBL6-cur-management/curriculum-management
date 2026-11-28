import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bulkTransferStudents,
  fetchAppliedVersion,
  fetchStudent,
  fetchStudentResults,
  fetchVersionTracks,
  setEnrollmentTrack,
} from './students';
import { studentKeys } from '../hooks/useStudents';

afterEach(() => vi.unstubAllGlobals());
describe('student contracts', () => {
  it('encodes identifiers and carries required program and semester context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchAppliedVersion('a/b', { programId: 'p1', semesterId: 's1' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/students/a%2Fb/applied-version?programId=p1&semesterId=s1',
    );
  });
  it('does not invent a program for an unassigned office profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchStudent('st1', { semesterId: 's1' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/students/st1?semesterId=s1');
  });
  it('keys every result filter and page size independently and sends them', async () => {
    const params = {
      semesterId: 's1',
      programId: 'p1',
      resultSemesterId: 's2',
      courseId: 'c1',
      page: 2,
      pageSize: 50,
    };
    for (const change of [
      { programId: 'p2' },
      { semesterId: 's2' },
      { resultSemesterId: 's3' },
      { courseId: 'c2' },
      { page: 3 },
      { pageSize: 20 },
    ])
      expect(studentKeys.results('st1', params)).not.toEqual(
        studentKeys.results('st1', { ...params, ...change }),
      );
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchStudentResults('st1', params);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'resultSemesterId=s2&courseId=c1&page=2&pageSize=50',
    );
  });
  it('sends bulk transfer, track update and version track queries to exact endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('{}')),
    );
    vi.stubGlobal('fetch', fetchMock);
    await bulkTransferStudents({
      studentIds: ['st1'],
      targetVersionId: 'v2',
      trackId: 'tr1',
      fromSemesterId: 's1',
      basisDecision: 'QĐ-01',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/students/enrollments/bulk-transfer',
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    await setEnrollmentTrack('st1', 'en1', {
      trackId: 'tr1',
      expectedEnrollmentUpdatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/students/st1/enrollments/en1/track',
    );
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH');
    await fetchVersionTracks('v/1');
    expect(fetchMock.mock.calls[2][0]).toBe(
      '/api/program-versions/v%2F1/tracks',
    );
  });
});
