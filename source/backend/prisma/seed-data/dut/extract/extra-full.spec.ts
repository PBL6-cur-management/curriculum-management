import { describe, expect, it } from 'vitest';
import {
  classifyCourseSubjectGroup,
  EXTRA_SUBJECT_GROUPS,
  isValidLegacyTermCode,
  mapLecturerFacultyUnit,
  parseGradeFormula,
  PLO_TEMPLATES,
  resolveStudentAdmissionTerm,
} from './extract-extra-full.js';

describe('extract-extra-full helpers', () => {
  describe('classifyCourseSubjectGroup', () => {
    it('classifies DUT-106 embedded/computer courses into DTVT-KTMT', () => {
      expect(
        classifyCourseSubjectGroup('1061234', 'Hệ thống nhúng và IoT', 'DUT-106'),
      ).toBe('DTVT-KTMT');
      expect(
        classifyCourseSubjectGroup('1065001', 'Thiết kế vi mạch VLSI', 'DUT-106'),
      ).toBe('DTVT-KTMT');
      expect(
        classifyCourseSubjectGroup('1065002', 'Lập trình FPGA', 'DUT-106'),
      ).toBe('DTVT-KTMT');
    });

    it('classifies DUT-106 telecom courses into DTVT-VT', () => {
      expect(
        classifyCourseSubjectGroup('1061010', 'Kỹ thuật Anten và truyền sóng', 'DUT-106'),
      ).toBe('DTVT-VT');
      expect(
        classifyCourseSubjectGroup('1231005', 'Mạng viễn thông 5G', 'DUT-106'),
      ).toBe('DTVT-VT');
    });

    it('defaults other DUT-106 courses to DTVT-DT', () => {
      expect(
        classifyCourseSubjectGroup('1060001', 'Mạch điện tử tương tự', 'DUT-106'),
      ).toBe('DTVT-DT');
      expect(
        classifyCourseSubjectGroup('1060099', 'Đồ án tốt nghiệp', 'DUT-106'),
      ).toBe('DTVT-DT');
    });

    it('classifies DUT-121 urban planning courses into KTR-QH and design courses into KTR-TK', () => {
      expect(
        classifyCourseSubjectGroup('1211020', 'Quy hoạch đô thị và cảnh quan', 'DUT-121'),
      ).toBe('KTR-QH');
      expect(
        classifyCourseSubjectGroup('1211001', 'Đồ án Kiến trúc dân dụng 1', 'DUT-121'),
      ).toBe('KTR-TK');
    });

    it('returns null for non-DTVT and non-KTR courses', () => {
      expect(
        classifyCourseSubjectGroup('1020001', 'Nhập môn Lập trình', 'DUT-102'),
      ).toBeNull();
      expect(
        classifyCourseSubjectGroup('3190101', 'Giải tích 1', 'DUT-319'),
      ).toBeNull();
    });
  });

  describe('parseGradeFormula', () => {
    it('parses valid DUT grade formulas summing to 100%', () => {
      expect(parseGradeFormula('[CC]*0.20+[GK]*0.30+[CK]*0.50')).toEqual([
        { componentCode: 'CC', componentName: 'Chuyên cần', weight: '20' },
        { componentCode: 'GK', componentName: 'Kiểm tra giữa kỳ', weight: '30' },
        { componentCode: 'CK', componentName: 'Thi cuối kỳ', weight: '50' },
      ]);
    });

    it('merges duplicate component codes and normalizes uppercase', () => {
      expect(parseGradeFormula('[gk]*0.15+[GK]*0.15+[ck]*0.70')).toEqual([
        { componentCode: 'GK', componentName: 'Kiểm tra giữa kỳ', weight: '30' },
        { componentCode: 'CK', componentName: 'Thi cuối kỳ', weight: '70' },
      ]);
    });

    it('returns null for invalid totals, zero weights, or empty expressions', () => {
      expect(parseGradeFormula(null)).toBeNull();
      expect(parseGradeFormula('')).toBeNull();
      expect(parseGradeFormula('[GK]*0.30+[CK]*0.50')).toBeNull();
      expect(parseGradeFormula('[GK]*0+[CK]*1.00')).toBeNull();
      expect(parseGradeFormula('not a formula')).toBeNull();
    });
  });

  describe('resolveStudentAdmissionTerm', () => {
    it('prefers valid explicit IDCodeVao', () => {
      expect(resolveStudentAdmissionTerm('2210', '106210001', '2110')).toBe(
        '2210',
      );
    });

    it('infers from 9-digit studentCode when IDCodeVao is empty', () => {
      expect(resolveStudentAdmissionTerm('', '106230042', '2010')).toBe('2310');
    });

    it('falls back to frame startSemesterCode for non-9-digit graduate codes', () => {
      expect(resolveStudentAdmissionTerm('', 'CH2401001', '2410')).toBe('2410');
    });

    it('validates legacy term codes', () => {
      expect(isValidLegacyTermCode('2310')).toBe(true);
      expect(isValidLegacyTermCode('2320')).toBe(true);
      expect(isValidLegacyTermCode('2321')).toBe(true);
      expect(isValidLegacyTermCode('2399')).toBe(false);
      expect(isValidLegacyTermCode('')).toBe(false);
    });
  });

  describe('mapLecturerFacultyUnit', () => {
    it('maps 106/122/123 to DUT-106 and 121 to DUT-121', () => {
      expect(mapLecturerFacultyUnit('106', '106')).toBe('DUT-106');
      expect(mapLecturerFacultyUnit('123', '123')).toBe('DUT-106');
      expect(mapLecturerFacultyUnit('', '122')).toBe('DUT-106');
      expect(mapLecturerFacultyUnit('121', '121')).toBe('DUT-121');
      expect(mapLecturerFacultyUnit('102', '102')).toBeNull();
    });
  });

  describe('static metadata integrity', () => {
    it('defines all 5 extra subject groups with unique codes', () => {
      expect(EXTRA_SUBJECT_GROUPS).toHaveLength(5);
      expect(new Set(EXTRA_SUBJECT_GROUPS.map((g) => g.groupCode)).size).toBe(
        5,
      );
    });

    it('defines PLO1..PLO8 for all 7 required major codes', () => {
      const requiredMajors = [
        '7520207',
        '7480106',
        '7580101',
        '8480101',
        '8520203',
        '8580101',
        '7480201',
      ];
      for (const majorCode of requiredMajors) {
        const template = PLO_TEMPLATES[majorCode];
        expect(template).toBeDefined();
        expect(template).toHaveLength(8);
        expect(template.map((p) => p.ploCode)).toEqual([
          'PLO1',
          'PLO2',
          'PLO3',
          'PLO4',
          'PLO5',
          'PLO6',
          'PLO7',
          'PLO8',
        ]);
        for (const plo of template) {
          expect(plo.description.length).toBeGreaterThan(20);
          expect(plo.englishDescription.length).toBeGreaterThan(20);
          expect(plo.competencyGroup.length).toBeGreaterThan(3);
        }
      }
    });
  });
});
