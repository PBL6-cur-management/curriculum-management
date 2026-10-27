import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { App } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ImportBatch } from './api/imports';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
export function batch(patch: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: 'b1',
    importType: 'CURRICULUM',
    fileName: 'Khung.xlsx',
    performedBy: { id: 'u1', fullName: 'Người nhập' },
    program: { id: 'p1', programCode: 'CT01', programName: 'Chương trình thử' },
    versionId: 'v1',
    totalRows: 2,
    successRows: 2,
    errorRows: 0,
    status: 'DRY_RUN',
    recordedAt: '2026-10-26T02:00:00Z',
    finishedAt: '2026-10-26T02:00:01Z',
    report: { formatErrors: [], issues: [] },
    canCommit: true,
    fileAvailable: true,
    ...patch,
  };
}
export function renderImport(
  element: ReactNode,
  path = '/imports',
  route = '/imports',
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: route, element }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider client={client}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>,
  );
  return { router, client };
}
