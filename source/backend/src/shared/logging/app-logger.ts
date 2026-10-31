import type { LoggerService } from '@nestjs/common';
// No import from env.validation: this module loads before reflect-metadata in main.ts and in specs, and the Env
// class would then lose the design types its numeric variables need.
import { LOG_LEVELS } from './log-levels.js';

// F-27 BE-02 without pino (decided 2026-10-31): one JSON object per line on stdout, Docker rotates the file.
// Same level names and numbers as pino, so a later switch to pino keeps the records readable.
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity,
};

export const SERVICE_NAME = 'ctdt-backend';

export interface HttpCompletion {
  event: 'http.completed' | 'http.aborted';
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

export interface LogDestination {
  write(line: string): unknown;
}

export interface AppLogger extends LoggerService {
  debug(message: unknown, ...rest: unknown[]): void;
  verbose(message: unknown, ...rest: unknown[]): void;
  fatal(message: unknown, ...rest: unknown[]): void;
  http(record: HttpCompletion): void;
  event(level: LogLevel, event: string, fields: Record<string, unknown>): void;
}

export interface AppLoggerOptions {
  level?: string;
  // Tests only: a disabled logger writes nothing.
  enabled?: boolean;
  destination?: LogDestination;
}

// An error becomes its type and a safe code, never its message or stack: those may carry SQL, URLs or values.
export function safeError(error: unknown): {
  errorType: string;
  errorCode?: string;
} {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      errorType: error.name,
      ...(typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code)
        ? { errorCode: code }
        : {}),
    };
  }
  return { errorType: typeof error };
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value ?? '');
}

class JsonLogger implements AppLogger {
  private readonly threshold: number;

  constructor(
    level: LogLevel,
    private readonly enabled: boolean,
    private readonly destination: LogDestination,
  ) {
    this.threshold = LEVEL_VALUES[level];
  }

  log(message: unknown, ...rest: unknown[]) {
    this.write('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]) {
    this.write('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]) {
    this.write('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]) {
    this.write('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]) {
    this.write('trace', message, rest);
  }
  fatal(message: unknown, ...rest: unknown[]) {
    this.write('fatal', message, rest);
  }

  http(record: HttpCompletion) {
    this.emit('info', { ...record });
  }

  event(level: LogLevel, event: string, fields: Record<string, unknown>) {
    this.emit(level, { event, ...fields });
  }

  // Nest calls (message, context) or, for errors, (message, stack, context): the last string is the context.
  private write(level: LogLevel, message: unknown, rest: unknown[]) {
    if (!this.accepts(level)) return;
    const strings = rest.filter(
      (item): item is string => typeof item === 'string',
    );
    const context =
      strings.length > 0 ? strings[strings.length - 1] : undefined;
    const record: Record<string, unknown> = context ? { context } : {};
    if (message instanceof Error) Object.assign(record, safeError(message));
    else if (typeof message === 'string') record.msg = message;
    else if (message && typeof message === 'object') record.msg = '[object]';
    else record.msg = String(message);
    this.emit(level, record);
  }

  private accepts(level: LogLevel) {
    return this.enabled && LEVEL_VALUES[level] >= this.threshold;
  }

  private emit(level: LogLevel, fields: Record<string, unknown>) {
    if (!this.accepts(level)) return;
    this.destination.write(
      `${JSON.stringify({
        level: LEVEL_VALUES[level],
        time: Date.now(),
        pid: process.pid,
        service: SERVICE_NAME,
        ...fields,
      })}\n`,
    );
  }
}

// An unknown raw level falls back to info here; Env validation still rejects it once the app module loads.
export function createAppLogger(options: AppLoggerOptions = {}): AppLogger {
  return new JsonLogger(
    isLogLevel(options.level) ? options.level : 'info',
    options.enabled ?? true,
    options.destination ?? process.stdout,
  );
}
