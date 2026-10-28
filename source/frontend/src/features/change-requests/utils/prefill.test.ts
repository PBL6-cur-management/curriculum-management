import { describe, expect, it } from 'vitest';
import { readPrefill } from './prefill';

const params = (query: string) => new URLSearchParams(query);

describe('readPrefill', () => {
  it('takes a known type with a target kind it accepts and the target id', () => {
    expect(
      readPrefill(params('type=CURRICULUM&targetType=PROGRAM&targetId=p1')),
    ).toEqual({
      requestType: 'CURRICULUM',
      targetType: 'PROGRAM',
      targetId: 'p1',
    });
  });

  it('falls back to the first target kind and drops the id when the kind does not fit the type', () => {
    expect(
      readPrefill(params('type=CURRICULUM&targetType=COURSE&targetId=c1')),
    ).toEqual({
      requestType: 'CURRICULUM',
      targetType: 'PROGRAM',
    });
  });

  it('reads the grading formula type, and still rejects an unknown or missing one', () => {
    expect(
      readPrefill(params('type=GRADING_FORMULA&targetType=COURSE&targetId=c1')),
    ).toEqual({
      requestType: 'GRADING_FORMULA',
      targetType: 'COURSE',
      targetId: 'c1',
    });
    expect(
      readPrefill(params('type=NOPE&targetType=COURSE&targetId=c1')),
    ).toEqual({});
    expect(readPrefill(params(''))).toEqual({});
    expect(
      readPrefill(params('type=ORGANIZATION&targetType=PROGRAM&targetId=p1')),
    ).toEqual({});
  });
});
