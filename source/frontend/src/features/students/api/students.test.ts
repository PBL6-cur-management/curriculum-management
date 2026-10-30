import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAppliedVersion,
  fetchStudent,
  fetchStudentResults,
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
});
