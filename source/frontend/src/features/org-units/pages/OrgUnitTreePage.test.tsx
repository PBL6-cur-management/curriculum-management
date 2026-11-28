import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrgUnitTreePage } from './OrgUnitTreePage';
import type { OrgUnit } from '../../../shared/org-units/orgUnits';

afterEach(() => vi.unstubAllGlobals());

describe('OrgUnitTreePage', () => {
  it('renders units, external tags, and filters internal vs external units', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(input).endsWith('/org-units')
              ? [
                  {
                    id: 'u',
                    unitCode: 'UNI',
                    unitName: 'Trường',
                    unitType: 'UNIVERSITY',
                    isExternal: false,
                    parentUnitId: null,
                    status: 'ACTIVE',
                  },
                  {
                    id: 'f',
                    unitCode: 'F',
                    unitName: 'Khoa Toán',
                    unitType: 'FACULTY',
                    isExternal: false,
                    parentUnitId: 'u',
                    status: 'ACTIVE',
                  },
                  {
                    id: 'ext',
                    unitCode: 'GDQP',
                    unitName: 'Trung tâm GDQP&AN ĐHĐN',
                    unitType: 'FACULTY',
                    isExternal: true,
                    parentUnitId: 'u',
                    status: 'ACTIVE',
                  },
                ]
              : [
                  {
                    id: 'g',
                    groupCode: 'G',
                    groupName: 'Đại số',
                    faculty: { id: 'f', unitCode: 'F', unitName: 'Khoa Toán' },
                    status: 'ACTIVE',
                    activeMemberCount: 1,
                    activeCoordinators: [],
                    hasActiveCoordinator: false,
                  },
                ],
          ),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App>
          <MemoryRouter>
            <OrgUnitTreePage />
          </MemoryRouter>
        </App>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Khoa Toán')).toBeInTheDocument();
    expect(await screen.findByText('Đại số')).toBeInTheDocument();
    expect(screen.getByText('Trung tâm GDQP&AN ĐHĐN')).toBeInTheDocument();
    expect(screen.getByText('Đơn vị ngoài trường')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Trung tâm GDQP&AN ĐHĐN'));
    expect(screen.getAllByText('Đơn vị ngoài trường').length).toBeGreaterThan(
      1,
    );

    fireEvent.click(screen.getByText('Nội bộ'));
    expect(screen.getByText('Khoa Toán')).toBeInTheDocument();
    expect(
      screen.queryByText('Trung tâm GDQP&AN ĐHĐN'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ngoài trường'));
    expect(
      screen.getAllByText('Trung tâm GDQP&AN ĐHĐN').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Khoa Toán')).not.toBeInTheDocument();
  });

  it('creates an external faculty and refetches the shared org-unit list', async () => {
    const root: OrgUnit = {
      id: 'u',
      unitCode: 'UNI',
      unitName: 'Trường',
      unitType: 'UNIVERSITY',
      isExternal: false,
      parentUnitId: null,
      status: 'ACTIVE',
    };
    const created: OrgUnit = {
      id: 'f',
      unitCode: 'GDQP',
      unitName: 'Trung tâm GDQP',
      unitType: 'FACULTY',
      isExternal: true,
      parentUnitId: 'u',
      status: 'ACTIVE',
    };
    let units: OrgUnit[] = [root];
    const posts: unknown[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/org-units') && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        units = [...units, created];
        return Promise.resolve(new Response(JSON.stringify(created)));
      }
      if (url.endsWith('/org-units'))
        return Promise.resolve(new Response(JSON.stringify(units)));
      return Promise.resolve(new Response('[]'));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App>
          <MemoryRouter>
            <OrgUnitTreePage />
          </MemoryRouter>
        </App>
      </QueryClientProvider>,
    );
    // unit name and its type tag share the text "Trường"
    expect(await screen.findAllByText('Trường')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đơn vị' }));
    fireEvent.change(screen.getByLabelText('Mã đơn vị'), {
      target: { value: 'GDQP' },
    });
    fireEvent.change(screen.getByLabelText('Tên đơn vị'), {
      target: { value: 'Trung tâm GDQP' },
    });
    fireEvent.click(
      screen.getByLabelText(
        'Đơn vị ngoài trường (ví dụ: Trung tâm GDQP&AN ĐHĐN)',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Trung tâm GDQP')).toBeInTheDocument();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      unitCode: 'GDQP',
      unitName: 'Trung tâm GDQP',
      isExternal: true,
    });
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith('/org-units') && init?.method !== 'POST',
      ).length,
    ).toBeGreaterThan(1);
  });
});
