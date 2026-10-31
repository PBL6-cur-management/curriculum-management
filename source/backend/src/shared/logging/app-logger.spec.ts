import { createAppLogger, safeError } from './app-logger.js';

function capture(level?: string, enabled?: boolean) {
  const lines: string[] = [];
  const logger = createAppLogger({
    level,
    enabled,
    destination: { write: (line: string) => lines.push(line) },
  });
  const records = () =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, lines, records };
}

describe('createAppLogger', () => {
  it('writes one JSON object per line with the pino level numbers and the service name', () => {
    const { logger, lines, records } = capture('trace');
    logger.verbose('v');
    logger.debug('d');
    logger.log('l');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');
    expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
    expect(records().map((r) => r.level)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(records().map((r) => r.msg)).toEqual(['v', 'd', 'l', 'w', 'e', 'f']);
    for (const record of records()) {
      expect(record.service).toBe('ctdt-backend');
      expect(typeof record.time).toBe('number');
      expect(record.pid).toBe(process.pid);
    }
  });

  it('drops records below the configured level', () => {
    const { logger, records } = capture('warn');
    logger.log('hidden');
    logger.debug('hidden');
    logger.warn('shown');
    expect(records().map((r) => r.msg)).toEqual(['shown']);
  });

  it('falls back to info for an unknown level and writes nothing when silent or disabled', () => {
    const unknown = capture('loud');
    unknown.logger.debug('hidden');
    unknown.logger.log('shown');
    expect(unknown.records()).toHaveLength(1);

    const silent = capture('silent');
    silent.logger.fatal('x');
    expect(silent.lines).toHaveLength(0);

    const disabled = capture('trace', false);
    disabled.logger.error('x');
    expect(disabled.lines).toHaveLength(0);
  });

  it('keeps the last string argument as context, matching Nest message/stack/context calls', () => {
    const { logger, records } = capture();
    logger.log('started', 'Bootstrap');
    logger.error('boom', 'stack line', 'Worker');
    expect(records()[0]).toMatchObject({
      msg: 'started',
      context: 'Bootstrap',
    });
    expect(records()[1]).toMatchObject({ msg: 'boom', context: 'Worker' });
  });

  it('turns an Error into its type and safe code, never its message or stack', () => {
    const { logger, lines, records } = capture();
    const error = Object.assign(
      new Error('connect postgres://admin:hunter2@db/prod failed'),
      { code: 'ECONNREFUSED' },
    );
    logger.error(error, 'Bootstrap');
    expect(records()[0]).toMatchObject({
      errorType: 'Error',
      errorCode: 'ECONNREFUSED',
      context: 'Bootstrap',
    });
    expect(lines.join('')).not.toContain('hunter2');
    expect(lines.join('')).not.toContain('postgres://');
  });

  it('never serialises an object message', () => {
    const { logger, lines } = capture();
    logger.log({ password: 'hunter2' });
    expect(lines.join('')).not.toContain('hunter2');
  });

  it('writes HTTP completions and structured events as given', () => {
    const { logger, records } = capture();
    logger.http({
      event: 'http.completed',
      requestId: 'r1',
      method: 'GET',
      route: '/api/health',
      statusCode: 200,
      durationMs: 3,
    });
    logger.event('fatal', 'bootstrap.invalid_environment', {
      properties: ['DATABASE_URL'],
    });
    expect(records()[0]).toMatchObject({
      level: 30,
      event: 'http.completed',
      route: '/api/health',
      statusCode: 200,
    });
    expect(records()[1]).toMatchObject({
      level: 60,
      event: 'bootstrap.invalid_environment',
      properties: ['DATABASE_URL'],
    });
  });
});

describe('safeError', () => {
  it('keeps only a code that looks like a code', () => {
    expect(
      safeError(Object.assign(new TypeError('x'), { code: 'P2002' })),
    ).toEqual({ errorType: 'TypeError', errorCode: 'P2002' });
    expect(
      safeError(Object.assign(new Error('x'), { code: 'select * from users' })),
    ).toEqual({ errorType: 'Error' });
    expect(safeError('plain string')).toEqual({ errorType: 'string' });
  });
});
