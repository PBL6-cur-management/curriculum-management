import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppLogger } from './app-logger.js';

export const UNMATCHED_ROUTE = 'unmatched';

// A matched template, or the fixed label. Nest answers unknown paths through a wildcard catch-all (`/api*path`),
// so a wildcard template counts as unmatched too.
function routeLabel(baseUrl: string, route: unknown): string {
  if (typeof route !== 'string' || route.includes('*')) return UNMATCHED_ROUTE;
  return `${baseUrl}${route}`;
}

// One record per request: method, matched route template, status, duration, a server-made ID. Never the query,
// body, headers, cookies or session; an incoming request-ID header is ignored.
export function createHttpLogger(logger: AppLogger): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const started = performance.now();
    const requestId = randomUUID();
    let done = false;
    const record = (event: 'http.completed' | 'http.aborted') => {
      if (done) return;
      done = true;
      const route = (request.route as { path?: unknown } | undefined)?.path;
      logger.http({
        event,
        requestId,
        method: request.method,
        route: routeLabel(request.baseUrl, route),
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      });
    };
    response.once('finish', () => record('http.completed'));
    response.once('close', () => {
      if (!response.writableFinished) record('http.aborted');
    });
    next();
  };
}
