import { describe, expect, it } from 'vitest';
import { OrgUnitType } from '../../../../src/generated/prisma/client.js';
import {
  extractCatalog,
  standardizeLegacyUnitName,
} from './extract-catalog.js';

describe('standardizeLegacyUnitName', () => {
  it('expands legacy K. and P. prefixes and collapses extra whitespace', () => {
    expect(standardizeLegacyUnitName('K. Cơ khí')).toBe('Khoa Cơ khí');
    expect(standardizeLegacyUnitName('K.Điện tử   và TTNT')).toBe(
      'Khoa Điện tử và TTNT',
    );
    expect(standardizeLegacyUnitName('P. Đào tạo và BĐCL')).toBe(
      'Phòng Đào tạo và BĐCL',
    );
    expect(standardizeLegacyUnitName('  Trường ĐH Ngoại ngữ  ')).toBe(
      'Trường ĐH Ngoại ngữ',
    );
  });
});

describe('extractCatalog units', () => {
  it('expands legacy unit names and flags MaBP 198 as external', () => {
    const catalog = extractCatalog({
      courses: [
        {
          MaHP: '1010001',
          TenHP: 'Cơ lý thuyết',
          TenHP1: '',
          SoTC: '3',
          LyThuyet: '3',
          ThucTap: '0',
          DoAn: '0',
          LoaiHP: '0',
          KhoaPC: '101',
          DATN: '0',
        },
        {
          MaHP: '1150001',
          TenHP: 'Giáo dục quốc phòng',
          TenHP1: '',
          SoTC: '3',
          LyThuyet: '3',
          ThucTap: '0',
          DoAn: '0',
          LoaiHP: '1',
          KhoaPC: '115',
          DATN: '0',
        },
        {
          MaHP: '1980001',
          TenHP: 'Tiếng Anh 1',
          TenHP1: 'English 1',
          SoTC: '3',
          LyThuyet: '3',
          ThucTap: '0',
          DoAn: '0',
          LoaiHP: '0',
          KhoaPC: '501',
          DATN: '0',
        },
      ],
      units: [
        { MaDV: '101', MaBP: '101', TenDV: 'K. Cơ khí' },
        { MaDV: '115', MaBP: '100', TenDV: 'P. Đào tạo' },
        { MaDV: '501', MaBP: '198', TenDV: 'Trường ĐH Ngoại ngữ - ĐHĐN' },
      ],
      terms: [],
      usedCourseCodes: new Set(['1010001', '1150001', '1980001']),
      termCodes: new Set(),
      cohortTermCodes: new Set(),
    });

    expect(catalog.units).toEqual([
      {
        unitCode: 'DUT-101',
        unitName: 'Khoa Cơ khí',
        unitType: OrgUnitType.FACULTY,
        isExternal: false,
      },
      {
        unitCode: 'DUT-115',
        unitName: 'Phòng Đào tạo',
        unitType: OrgUnitType.OFFICE,
        isExternal: false,
      },
      {
        unitCode: 'DUT-501',
        unitName: 'Trường ĐH Ngoại ngữ - ĐHĐN',
        unitType: OrgUnitType.FACULTY,
        isExternal: true,
      },
    ]);
  });
});
