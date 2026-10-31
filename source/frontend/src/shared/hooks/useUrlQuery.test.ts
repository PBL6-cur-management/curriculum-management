import { describe, expect, it } from 'vitest';
import { decodeQuery, encodeQuery } from './useUrlQuery';

interface ListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  q?: string;
}
const DEFAULTS: ListQuery = {
  page: 1,
  pageSize: 20,
  status: 'ACTIVE',
};
const KINDS = { page: 'number', pageSize: 'number' } as const;

describe('useUrlQuery encoding', () => {
  it('keeps defaults out of the URL', () => {
    expect(encodeQuery(DEFAULTS, DEFAULTS).toString()).toBe('');
  });

  it('round-trips numbers, strings, booleans and lists', () => {
    const query = {
      ...DEFAULTS,
      page: 3,
      q: '1024034',
      mine: true,
      status: 'INACTIVE',
      tags: ['A', 'B'],
    };
    const params = encodeQuery(query, DEFAULTS);
    expect(
      decodeQuery(params, DEFAULTS, {
        ...KINDS,
        mine: 'boolean',
        tags: 'list',
      } as never),
    ).toEqual(query);
  });

  it('keeps a search that looks like a number as text', () => {
    const params = encodeQuery({ ...DEFAULTS, q: '1024034' }, DEFAULTS);
    expect(decodeQuery(params, DEFAULTS, KINDS)).toMatchObject({
      q: '1024034',
    });
  });

  it('remembers a cleared filter that has a default', () => {
    const params = encodeQuery({ ...DEFAULTS, status: undefined }, DEFAULTS);
    expect(params.toString()).toBe('status=');
    expect(decodeQuery(params, DEFAULTS, KINDS).status).toBeUndefined();
  });
});
