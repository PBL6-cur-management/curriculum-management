import { describe, expect, it } from 'vitest';
import { DegreeLevel } from '../../../../src/generated/prisma/client.js';
import {
  degreeLevelFor,
  groupFramesIntoPrograms,
  programCodeFor,
  selectFrameScope,
  type FrameMajor,
} from './program-map.js';

const frame = (overrides: Partial<FrameMajor>): FrameMajor => ({
  MaNganh: '1024999',
  TenNganh: 'Công nghệ Thông tin',
  Kyhieu: '7480201',
  SoHK: '8',
  CapDT: 'CD01',
  LoaiCTDT: '',
  KyBDau: '2410',
  ...overrides,
});

describe('programCodeFor', () => {
  // Real frame names from tmNganh; the 1024 codes reproduce the hand-made mapping the Khoa saw before.
  it.each([
    [
      { TenNganh: 'Công nghệ Thông tin K2024 Đặc thù', LoaiCTDT: 'CN' },
      'CNTT-CN-DT',
    ],
    [
      { TenNganh: 'Công nghệ Thông tin K2024 Nhật', LoaiCTDT: 'CN' },
      'CNTT-CN-NHAT',
    ],
    [
      {
        TenNganh: 'Khoa học dữ liệu và Trí tuệ nhân tạo K2024',
        Kyhieu: '7480201B',
        LoaiCTDT: 'CN',
      },
      'CNTT-CN-KHDL',
    ],
    [
      {
        TenNganh: 'Công nghệ Thông tin K2021 Đặc thù_CNPM',
        LoaiCTDT: 'CN',
        KyBDau: '2110',
      },
      'CNTT-CN-CNPM',
    ],
    [
      {
        TenNganh: 'Công nghệ Thông tin K2021CLC Đặc thù_Kỹ sư_CNPM',
        LoaiCTDT: 'KS',
        KyBDau: '2110',
      },
      'CNTT-KS-CLC-CNPM',
    ],
    [
      { TenNganh: 'Công nghệ Thông tin K2022 Đặc thù _ Kỹ sư', LoaiCTDT: 'KS' },
      'CNTT-KS-DT',
    ],
    [
      {
        TenNganh: 'Công nghệ Thông tin K2014_ANTT',
        SoHK: '10',
        KyBDau: '1410',
      },
      'CNTT-KS-CU-ATTT',
    ],
    [
      {
        TenNganh: 'Công nghệ Thông tin K2015CLC- Anh',
        SoHK: '9',
        KyBDau: '1510',
      },
      'CNTT-KS-CU-CLC-ANH',
    ],
    [
      { TenNganh: 'Công nghệ Thông tin K2018CLC Đặc thù_MẠNG', KyBDau: '1810' },
      'CNTT-CN-CU-CLC-MANG',
    ],
    [
      {
        TenNganh: 'An toàn thông tin trên không gian số K2026',
        Kyhieu: '7480201C',
        SoHK: '9',
        KyBDau: '2610',
      },
      'CNTT-KS-K26-ATKGS',
    ],
    [
      {
        TenNganh: 'Kỹ sư tài năng Công nghệ thông tin K2026',
        Kyhieu: '7480201TN',
        SoHK: '9',
        KyBDau: '2610',
      },
      'CNTT-KS-K26-KSTN',
    ],
  ])('maps %j to %s', (overrides, code) => {
    expect(programCodeFor(frame(overrides))).toBe(code);
  });
});

describe('degreeLevelFor', () => {
  it('reads CapDT graduate levels, then LoaiCTDT, then the name, then the semester count', () => {
    expect(degreeLevelFor(frame({ CapDT: 'CD02', SoHK: '4' }))).toBe(
      DegreeLevel.MASTER,
    );
    expect(degreeLevelFor(frame({ CapDT: 'CD03', SoHK: '6' }))).toBe(
      DegreeLevel.DOCTORATE,
    );
    expect(degreeLevelFor(frame({ LoaiCTDT: 'CN', SoHK: '10' }))).toBe(
      DegreeLevel.BACHELOR,
    );
    expect(degreeLevelFor(frame({ LoaiCTDT: 'KS', SoHK: '8' }))).toBe(
      DegreeLevel.ENGINEER,
    );
    expect(degreeLevelFor(frame({ TenNganh: 'CNTT _ Kỹ sư' }))).toBe(
      DegreeLevel.ENGINEER,
    );
    expect(degreeLevelFor(frame({ SoHK: '9' }))).toBe(DegreeLevel.ENGINEER);
    expect(degreeLevelFor(frame({ SoHK: '8' }))).toBe(DegreeLevel.BACHELOR);
  });

  it('builds distinct program codes for master and doctorate frames', () => {
    expect(
      programCodeFor(
        frame({ CapDT: 'CD02', TenNganh: 'Khoa học máy tính', SoHK: '4' }),
      ),
    ).toBe('CNTT-THS');
    expect(
      programCodeFor(
        frame({ CapDT: 'CD03', TenNganh: 'Khoa học máy tính', SoHK: '6' }),
      ),
    ).toBe('CNTT-TS');
  });
});

describe('selectFrameScope', () => {
  it('keeps 1024 frames and older frames with students, and reports graduate frames', () => {
    const scope = selectFrameScope(
      [
        frame({ MaNganh: '1024' }),
        frame({ MaNganh: '1024001' }),
        frame({ MaNganh: '1021013' }),
        frame({ MaNganh: '1021099' }),
        frame({ MaNganh: '1022001', CapDT: 'CD02' }),
        frame({ MaNganh: '1031001' }),
      ],
      new Map([
        ['1021013', 8],
        ['1022001', 17],
        ['1031001', 4],
      ]),
    );
    expect(scope.frameCodes).toEqual(['1021013', '1024001']);
    expect(scope.excluded).toEqual([
      { frameCode: '1022001', level: 'CD02', students: 17 },
    ]);
  });

  it('includes CD02 and CD03 frames when includeGraduate is enabled', () => {
    const scope = selectFrameScope(
      [
        frame({ MaNganh: '1024001', CapDT: 'CD01' }),
        frame({ MaNganh: '1022001', CapDT: 'CD02' }),
        frame({ MaNganh: '1023001', CapDT: 'CD03' }),
      ],
      new Map([
        ['1022001', 17],
        ['1023001', 5],
      ]),
      { includeGraduate: true },
    );
    expect(scope.frameCodes).toEqual(['1022001', '1023001', '1024001']);
    expect(scope.excluded).toEqual([]);
  });
});

describe('groupFramesIntoPrograms', () => {
  it('puts every cohort frame of one program together', () => {
    expect(
      groupFramesIntoPrograms([
        frame({
          MaNganh: '1024034',
          TenNganh: 'CNTT K2023 Đặc thù_CNPM',
          LoaiCTDT: 'CN',
        }),
        frame({
          MaNganh: '1024010',
          TenNganh: 'CNTT K2021 Đặc thù_CNPM',
          LoaiCTDT: 'CN',
        }),
        frame({
          MaNganh: '1024007',
          TenNganh: 'CNTT K2024 Đặc thù',
          LoaiCTDT: 'CN',
        }),
      ]),
    ).toEqual([
      {
        programCode: 'CNTT-CN-CNPM',
        degreeLevel: DegreeLevel.BACHELOR,
        frames: ['1024010', '1024034'],
      },
      {
        programCode: 'CNTT-CN-DT',
        degreeLevel: DegreeLevel.BACHELOR,
        frames: ['1024007'],
      },
    ]);
  });
});
