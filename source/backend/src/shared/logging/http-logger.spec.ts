import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import type { AppLogger, HttpCompletion } from './app-logger.js';
import { createHttpLogger, UNMATCHED_ROUTE } from './http-logger.js';

function setup(route?: string) {
  const records: HttpCompletion[] = [];
  const logger = { http: (record: HttpCompletion) => records.push(record) };
  const request = {
    method: 'POST',
    baseUrl: '',
    route: route ? { path: route } : undefined,
    headers: { 'x-request-id': 'client-chosen', cookie: 'ctdt.sid=secret' },
    query: { token: 'secret' },
    body: { password: 'secret' },
  } as unknown as Request;
  const response = Object.assign(new EventEmitter(), {
    statusCode: 201,
    writableFinished: false,
  }) as unknown as Response & EventEmitter & { writableFinished: boolean };
  const next = vi.fn() as NextFunction;
  createHttpLogger(logger as unknown as AppLogger)(request, response, next);
  return { records, response, next };
}

describe('createHttpLogger', () => {
  it('records one completion with the matched route and a server-made request ID', () => {
    const { records, response, next } = setup('/api/courses/:id');
    expect(next).toHaveBeenCalledOnce();
    response.writableFinished = true;
    response.emit('finish');
    response.emit('close');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: 'http.completed',
      method: 'POST',
      route: '/api/courses/:id',
      statusCode: 201,
    });
    expect(records[0].requestId).not.toBe('client-chosen');
    expect(records[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records an aborted request once, and never also as completed', () => {
    const { records, response } = setup('/api/health');
    response.emit('close');
    response.emit('finish');
    expect(records.map((r) => r.event)).toEqual(['http.aborted']);
  });

  it('uses a fixed label for an unmatched path and never logs headers, query or body', () => {
    const { records, response } = setup();
    response.writableFinished = true;
    response.emit('finish');
    expect(records[0].route).toBe(UNMATCHED_ROUTE);
    expect(JSON.stringify(records)).not.toContain('secret');
    expect(Object.keys(records[0]).sort()).toEqual([
      'durationMs',
      'event',
      'method',
      'requestId',
      'route',
      'statusCode',
    ]);
  });
});
