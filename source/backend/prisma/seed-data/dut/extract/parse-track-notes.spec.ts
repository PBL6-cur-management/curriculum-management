import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TARGET_PROGRAM_CODES,
  TRACK_DEFINITIONS_BY_PROGRAM,
  getTrackDefinition,
  parseTrackAssignments,
} from './parse-track-notes.js';

interface RawProgramFile {
  programs?: RawProgram[];
}

interface RawProgram {
  programCode: string;
  versions: Array<{
    items: Array<{
      note: string | null;
      isElective: boolean;
    }>;
  }>;
}

describe('parseTrackAssignments', () => {
  describe('CNTT-CN-DT and CNTT-KS-DT', () => {
    it.each(['CNTT-CN-DT', 'CNTT-KS-DT'])(
      'parses every real specialization note for %s',
      (programCode) => {
        expect(
          parseTrackAssignments(programCode, 'Công nghệ PM', true),
        ).toEqual([{ trackCode: 'CNPM', isElective: true }]);
        expect(
          parseTrackAssignments(programCode, 'Công nghệ PM', false),
        ).toEqual([{ trackCode: 'CNPM', isElective: false }]);

        expect(
          parseTrackAssignments(
            programCode,
            'Công nghệ PM, tự chọn HTTT',
            true,
          ),
        ).toEqual([
          { trackCode: 'CNPM', isElective: true },
          { trackCode: 'HTTT', isElective: true },
        ]);
        expect(
          parseTrackAssignments(
            programCode,
            'Công nghệ PM, tự chọn HTTT',
            false,
          ),
        ).toEqual([
          { trackCode: 'CNPM', isElective: false },
          { trackCode: 'HTTT', isElective: true },
        ]);
        expect(
          parseTrackAssignments(
            programCode,
            'Công nghệ PM bắt buộc, tự chọn HTTT',
            true,
          ),
        ).toEqual([
          { trackCode: 'CNPM', isElective: false },
          { trackCode: 'HTTT', isElective: true },
        ]);

        expect(parseTrackAssignments(programCode, 'HTTT', true)).toEqual([
          { trackCode: 'HTTT', isElective: true },
        ]);
        expect(parseTrackAssignments(programCode, 'ATTT', true)).toEqual([
          { trackCode: 'ATTT', isElective: true },
        ]);
        expect(parseTrackAssignments(programCode, 'ATTT,Mạng', true)).toEqual([
          { trackCode: 'ATTT', isElective: true },
          { trackCode: 'MANG', isElective: true },
        ]);
        expect(parseTrackAssignments(programCode, 'ATTT, Mạng', false)).toEqual(
          [
            { trackCode: 'ATTT', isElective: false },
            { trackCode: 'MANG', isElective: false },
          ],
        );
        expect(
          parseTrackAssignments(programCode, 'Mạng, Tự chọn ATTT', true),
        ).toEqual([
          { trackCode: 'MANG', isElective: true },
          { trackCode: 'ATTT', isElective: true },
        ]);
        expect(parseTrackAssignments(programCode, 'Mạng', true)).toEqual([
          { trackCode: 'MANG', isElective: true },
        ]);
        expect(parseTrackAssignments(programCode, 'KTMT', true)).toEqual([
          { trackCode: 'KTMT', isElective: true },
        ]);
      },
    );

    it('handles case, spacing, and alias variations', () => {
      expect(parseTrackAssignments('CNTT-CN-DT', '  cnpm  ', false)).toEqual([
        { trackCode: 'CNPM', isElective: false },
      ]);
      expect(
        parseTrackAssignments('CNTT-KS-DT', 'CNPM, CNPM, HTTT', true),
      ).toEqual([
        { trackCode: 'CNPM', isElective: true },
        { trackCode: 'HTTT', isElective: true },
      ]);
    });

    it('returns empty array for non-track notes', () => {
      const nonTrackNotes = [
        'Chọn 1 trong 3',
        'Chọn 1 trong 4',
        'Chọn 2 trong 5',
        'Chọn 3 trong 6',
        'Chuyển hk 1- hk 2',
        'Chuyển từ 7-8',
        'Chuyển từ kỳ 8-7',
        'x',
        'ko',
        '',
        '   ',
        null,
        undefined,
      ];
      for (const note of nonTrackNotes) {
        expect(parseTrackAssignments('CNTT-CN-DT', note, true)).toEqual([]);
        expect(parseTrackAssignments('CNTT-KS-DT', note, false)).toEqual([]);
      }
    });
  });

  describe('DTVT-KS and DTVT-KS-CLC', () => {
    it.each(['DTVT-KS', 'DTVT-KS-CLC'])(
      'parses every real orientation note for %s',
      (programCode) => {
        expect(
          parseTrackAssignments(programCode, 'Định hướng KTĐT', true),
        ).toEqual([{ trackCode: 'KTDT', isElective: true }]);
        expect(
          parseTrackAssignments(programCode, 'Định hướng KTĐT', false),
        ).toEqual([{ trackCode: 'KTDT', isElective: false }]);
        expect(
          parseTrackAssignments(programCode, 'Định hướng KTĐT,bắt buộc', true),
        ).toEqual([{ trackCode: 'KTDT', isElective: false }]);
        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng KTĐT, chọn 5HP tự chọn',
            false,
          ),
        ).toEqual([{ trackCode: 'KTDT', isElective: true }]);
        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng KTĐT,KTMT chọn 5HP tự chọn',
            true,
          ),
        ).toEqual([
          { trackCode: 'KTDT', isElective: true },
          { trackCode: 'HTMT', isElective: true },
        ]);

        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng KTVT, chọn 5HP tự chọn',
            true,
          ),
        ).toEqual([{ trackCode: 'KTVT', isElective: true }]);
        expect(
          parseTrackAssignments(programCode, 'Định hướng KTV', true),
        ).toEqual([{ trackCode: 'KTVT', isElective: true }]);
        expect(
          parseTrackAssignments(programCode, 'Định hướng KTV, bắt buộc', true),
        ).toEqual([{ trackCode: 'KTVT', isElective: false }]);
        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng KTVT,KTMT, chọn 5HP tự chọn',
            true,
          ),
        ).toEqual([
          { trackCode: 'KTVT', isElective: true },
          { trackCode: 'HTMT', isElective: true },
        ]);

        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng KTMT, chọn 5HP tự chọn',
            true,
          ),
        ).toEqual([{ trackCode: 'HTMT', isElective: true }]);
        expect(
          parseTrackAssignments(
            programCode,
            'Định hướng htMT, chọn 5HP tự chọn',
            true,
          ),
        ).toEqual([{ trackCode: 'HTMT', isElective: true }]);
        expect(
          parseTrackAssignments(programCode, 'Định hướng htMT, BẮT BUỘC', true),
        ).toEqual([{ trackCode: 'HTMT', isElective: false }]);
      },
    );

    it('returns empty array for non-track notes', () => {
      expect(
        parseTrackAssignments('DTVT-KS', 'Chọn 10TC tự chọn', true),
      ).toEqual([]);
      expect(parseTrackAssignments('DTVT-KS', 'Kỳ 6->kỳ 4', false)).toEqual([]);
      expect(
        parseTrackAssignments('DTVT-KS-CLC', 'Chọn 10TC tự chọn', true),
      ).toEqual([]);
    });
  });

  describe('KTMT-KS', () => {
    it('parses every real module note including typos and repeated modules', () => {
      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Kỳ 7 Chọn 7TC tự chọn  và Mođun: Hệ thống nhúng và IoT_chọn 9TC',
          true,
        ),
      ).toEqual([{ trackCode: 'IOT', isElective: true }]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Mođun: Hệ thống nhúng và IoT_chọn 9TC kỳ 8,9',
          false,
        ),
      ).toEqual([{ trackCode: 'IOT', isElective: true }]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Mođung: Trí tuệ nhân tạo_chọn 9TC',
          true,
        ),
      ).toEqual([{ trackCode: 'AI', isElective: true }]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Chọn 7TC tự chọn, Mođung: Trí tuệ nhân tạo_chọn 9TC',
          true,
        ),
      ).toEqual([{ trackCode: 'AI', isElective: true }]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Mođung: Trí tuệ nhân tạo_chọn 9TC,Mođun: Hệ thống nhúng và IoT_chọn 9TC',
          true,
        ),
      ).toEqual([
        { trackCode: 'AI', isElective: true },
        { trackCode: 'IOT', isElective: true },
      ]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Mođung: Trí tuệ nhân tạo_chọn 9TC kỳ 9,Mođun: Hệ thống nhúng và IoT_chọn 9TC kỳ 9',
          true,
        ),
      ).toEqual([
        { trackCode: 'AI', isElective: true },
        { trackCode: 'IOT', isElective: true },
      ]);

      expect(
        parseTrackAssignments(
          'KTMT-KS',
          'Chọn 7TC tự chọn,Mođun: Hệ thống nhúng và IoT_chọn 9TC kỳ 9,Mođung: Trí tuệ nhân tạo_chọn 9TC kỳ 9,Mođun: Hệ thống nhúng và IoT_chọn 9TC kỳ 9',
          true,
        ),
      ).toEqual([
        { trackCode: 'IOT', isElective: true },
        { trackCode: 'AI', isElective: true },
      ]);
    });

    it('returns empty array for non-track notes', () => {
      expect(
        parseTrackAssignments('KTMT-KS', 'Chọn 6TC tự chọn (TC kỳ 6,7)', true),
      ).toEqual([]);
      expect(
        parseTrackAssignments('KTMT-KS', 'Chọn 6TC tự chọn', true),
      ).toEqual([]);
      expect(
        parseTrackAssignments('KTMT-KS', 'Chọn 7TC tự chọn', true),
      ).toEqual([]);
      expect(parseTrackAssignments('KTMT-KS', 'Kỳ 6->kỳ 4', false)).toEqual([]);
    });
  });

  describe('CNTT-THS-NC', () => {
    it('parses every real specialization note', () => {
      expect(
        parseTrackAssignments('CNTT-THS-NC', 'Chuyên đề CNPM', true),
      ).toEqual([{ trackCode: 'CNPM', isElective: true }]);
      expect(
        parseTrackAssignments('CNTT-THS-NC', 'Chuyên đề CNPM', false),
      ).toEqual([{ trackCode: 'CNPM', isElective: false }]);
      expect(parseTrackAssignments('CNTT-THS-NC', 'MATTT', true)).toEqual([
        { trackCode: 'MATTT', isElective: true },
      ]);
      expect(parseTrackAssignments('CNTT-THS-NC', 'KHDL', true)).toEqual([
        { trackCode: 'KHDL', isElective: true },
      ]);
    });

    it('returns empty array for non-track notes', () => {
      expect(
        parseTrackAssignments('CNTT-THS-NC', 'Chọn 1 trong 5', true),
      ).toEqual([]);
      expect(parseTrackAssignments('CNTT-THS-NC', 'học 15/21TC', true)).toEqual(
        [],
      );
    });
  });

  describe('unknown programs and metadata helpers', () => {
    it('returns empty array for non-target programs', () => {
      expect(parseTrackAssignments('UNKNOWN-PROG', 'ATTT', true)).toEqual([]);
      expect(parseTrackAssignments('CNTT-CN-CLC', 'Công nghệ PM', true)).toEqual(
        [],
      );
    });

    it('exposes complete canonical track definitions for all 6 target programs', () => {
      expect(TARGET_PROGRAM_CODES).toHaveLength(6);
      for (const code of TARGET_PROGRAM_CODES) {
        const defs = TRACK_DEFINITIONS_BY_PROGRAM[code];
        expect(defs.length).toBeGreaterThanOrEqual(2);
        for (const def of defs) {
          expect(getTrackDefinition(code, def.trackCode)).toEqual(def);
        }
      }
      expect(getTrackDefinition('UNKNOWN', 'CNPM')).toBeUndefined();
    });
  });

  describe('real DUT JSON datasets coverage', () => {
    it('extracts expected tracks from programs.json and extra-faculties.json without missing any track', () => {
      const programsJson = JSON.parse(
        readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'),
      ) as RawProgram[] | RawProgramFile;
      const extraJson = JSON.parse(
        readFileSync(
          new URL('../data/extra-faculties.json', import.meta.url),
          'utf8',
        ),
      ) as RawProgram[] | RawProgramFile;

      const allPrograms = [
        ...(Array.isArray(programsJson)
          ? programsJson
          : (programsJson.programs ?? [])),
        ...(Array.isArray(extraJson) ? extraJson : (extraJson.programs ?? [])),
      ];

      const expectedTrackCodesByProgram: Record<string, string[]> = {
        'CNTT-CN-DT': ['ATTT', 'CNPM', 'HTTT', 'KTMT', 'MANG'],
        'CNTT-KS-DT': ['ATTT', 'CNPM', 'HTTT', 'KTMT', 'MANG'],
        'DTVT-KS': ['HTMT', 'KTDT', 'KTVT'],
        'DTVT-KS-CLC': ['HTMT', 'KTDT', 'KTVT'],
        'KTMT-KS': ['AI', 'IOT'],
        'CNTT-THS-NC': ['CNPM', 'KHDL', 'MATTT'],
      };

      for (const programCode of TARGET_PROGRAM_CODES) {
        const program = allPrograms.find((p) => p.programCode === programCode);
        expect(program, `Missing ${programCode} in DUT data`).toBeDefined();

        const discoveredTracks = new Set<string>();
        let matchedItems = 0;

        for (const version of program!.versions) {
          for (const item of version.items) {
            const assignments = parseTrackAssignments(
              programCode,
              item.note,
              item.isElective,
            );
            if (assignments.length > 0) {
              matchedItems++;
              for (const assignment of assignments) {
                expect(
                  getTrackDefinition(programCode, assignment.trackCode),
                ).toBeDefined();
                discoveredTracks.add(assignment.trackCode);
              }
            }
          }
        }

        expect(matchedItems).toBeGreaterThan(0);
        expect([...discoveredTracks].sort()).toEqual(
          expectedTrackCodesByProgram[programCode],
        );
      }
    });
  });
});
