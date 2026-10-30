import { randomUUID } from 'node:crypto';
import {
  createParamDecorator,
  Injectable,
  Logger,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, throwError, type Observable } from 'rxjs';
import { AppException } from '../exception/app.exception.js';
import { toErrorBody } from '../filter/all-exceptions.filter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  INTEGRATION,
  type IntegrationResource,
} from './integration.constants.js';
import { INTEGRATION_ERRORS } from './integration.errors.js';
import { hashIntegrationKey } from './integration-key.js';

const RESOURCE_KEY = 'integrationResource';
export const IntegrationResourceOf = (resource: IntegrationResource) =>
  SetMetadata(RESOURCE_KEY, resource);

interface IntegrationRequest extends Request {
  integrationClientId?: string;
}

export const IntegrationClientId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const id = context
      .switchToHttp()
      .getRequest<IntegrationRequest>().integrationClientId;
    if (!id) throw new AppException(INTEGRATION_ERRORS.KEY_INVALID);
    return id;
  },
);

function studentCodeOf(request: Request): string | null {
  const value = request.params?.mssv ?? request.query?.mssv;
  return typeof value === 'string' && value.length <= INTEGRATION.CODE_MAX
    ? value
    : null;
}

// Authenticates the partner key, spends one unit of its per-minute quota, and records every call.
// A successful body is released only after its call record is committed (durability before disclosure).
@Injectable()
export class IntegrationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IntegrationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const started = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<IntegrationRequest>();
    const response = http.getResponse<Response>();
    const resource = this.reflector.get<IntegrationResource>(
      RESOURCE_KEY,
      context.getHandler(),
    );
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    const call = {
      requestId,
      resource,
      studentCode: studentCodeOf(request),
      started,
      clientId: null as string | null,
    };
    try {
      const client = await this.authenticate(request);
      // A locked key is still attributed to its client, so a refused call stays accountable.
      call.clientId = client?.id ?? null;
      if (!client || client.status !== 'ACTIVE')
        throw new AppException(INTEGRATION_ERRORS.KEY_INVALID);
      await this.admit(client.id, response);
      request.integrationClientId = client.id;
    } catch (error) {
      await this.recordFailure(call, error, request);
      throw error;
    }
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.record(call, response.statusCode, null);
        return body;
      }),
      catchError((error: unknown) =>
        from(this.recordFailure(call, error, request)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  private async authenticate(request: Request) {
    const header = request.headers[INTEGRATION.HEADER];
    const key = Array.isArray(header) ? undefined : header;
    if (!key || !key.startsWith(INTEGRATION.KEY_PREFIX) || key.length > 200)
      return null;
    return this.prisma.integrationClient.findUnique({
      where: { keyHash: hashIntegrationKey(key) },
      select: { id: true, status: true },
    });
  }

  // One atomic upsert per call: concurrent processes share the counter and none can overshoot the limit.
  private async admit(clientId: string, response: Response): Promise<void> {
    const windowMs =
      INTEGRATION.WINDOW_SECONDS * INTEGRATION.MILLISECONDS_PER_SECOND;
    const now = Date.now();
    const windowStart = new Date(now - (now % windowMs));
    const admitted = await this.prisma.$queryRaw<{ used: number }[]>`
      INSERT INTO "IntegrationRateWindow" ("clientId", "windowStart", "used")
      SELECT ${clientId}, ${windowStart}, 1
      FROM "IntegrationClient" c WHERE c.id = ${clientId} AND c."rateLimit" >= 1
      ON CONFLICT ("clientId", "windowStart") DO UPDATE
        SET "used" = "IntegrationRateWindow"."used" + 1
        WHERE "IntegrationRateWindow"."used" <
          (SELECT "rateLimit" FROM "IntegrationClient" WHERE id = ${clientId})
      RETURNING "used"`;
    if (admitted.length) return;
    response.setHeader(
      'Retry-After',
      String(
        Math.max(
          1,
          Math.ceil(
            (windowStart.getTime() + windowMs - now) /
              INTEGRATION.MILLISECONDS_PER_SECOND,
          ),
        ),
      ),
    );
    throw new AppException(INTEGRATION_ERRORS.RATE_LIMITED);
  }

  private record(
    call: {
      requestId: string;
      resource: IntegrationResource;
      studentCode: string | null;
      started: number;
      clientId: string | null;
    },
    httpStatus: number,
    errorCode: string | null,
  ) {
    return this.prisma.integrationCallLog.create({
      data: {
        requestId: call.requestId,
        clientId: call.clientId,
        resource: call.resource,
        studentCode: call.studentCode,
        httpStatus,
        errorCode,
        durationMs: Math.max(0, Date.now() - call.started),
      },
    });
  }

  // A failed call is still recorded; if that record cannot be written, the original error is what the caller sees.
  private async recordFailure(
    call: Parameters<IntegrationInterceptor['record']>[0],
    error: unknown,
    request: Request,
  ): Promise<void> {
    const body = toErrorBody(error, request.originalUrl);
    try {
      await this.record(call, body.statusCode, body.code);
    } catch (logError) {
      this.logger.error(logError);
    }
  }
}
