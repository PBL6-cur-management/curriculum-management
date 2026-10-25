import { DegreeLevel } from '../../../../src/generated/prisma/client.js';
export const LEGACY_MAJOR_HEADER = '1024';
export const LEGACY_FRAME_PREFIX = '1024';
export interface DutProgramDefinition {
  programCode: string;
  degreeLevel: DegreeLevel;
  frames: readonly string[];
}
export const DUT_PROGRAMS: readonly DutProgramDefinition[] = [
  {
    programCode: 'CNTT-CN-DT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024007'],
  },
  {
    programCode: 'CNTT-CN-NHAT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024009'],
  },
  {
    programCode: 'CNTT-CN-KHDL',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024008'],
  },
  {
    programCode: 'CNTT-CN-CNPM',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024010', '1024023', '1024034'],
  },
  {
    programCode: 'CNTT-CN-ATTT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024011', '1024024', '1024035'],
  },
  {
    programCode: 'CNTT-CN-HTTT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024012', '1024025', '1024036'],
  },
  {
    programCode: 'CNTT-CN-KTMT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024013', '1024026', '1024037'],
  },
  {
    programCode: 'CNTT-CN-CLC-CNPM',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024014'],
  },
  {
    programCode: 'CNTT-CN-CLC-ATTT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024015'],
  },
  {
    programCode: 'CNTT-CN-CLC-HTTT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024016'],
  },
  {
    programCode: 'CNTT-CN-CLC-KTMT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024017'],
  },
  {
    programCode: 'CNTT-KS-DT',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024001', '1024004', '1024020', '1024031'],
  },
  {
    programCode: 'CNTT-KS-KHDL',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024002', '1024005', '1024021', '1024032'],
  },
  {
    programCode: 'CNTT-KS-NHAT',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024003', '1024006', '1024022', '1024033'],
  },
  {
    programCode: 'CNTT-KS-CNPM',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024018', '1024027', '1024038'],
  },
  {
    programCode: 'CNTT-KS-ATTT',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024028', '1024039'],
  },
  {
    programCode: 'CNTT-KS-HTTT',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024029', '1024040'],
  },
  {
    programCode: 'CNTT-KS-KTMT',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024030', '1024041'],
  },
  {
    programCode: 'CNTT-KS-CLC-CNPM',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024019'],
  },
  {
    programCode: 'CNTT-K26-CNTT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024042'],
  },
  {
    programCode: 'CNTT-K26-NHAT',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024043'],
  },
  {
    programCode: 'CNTT-K26-KHDL',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024044'],
  },
  {
    programCode: 'CNTT-K26-ATKGS',
    degreeLevel: DegreeLevel.BACHELOR,
    frames: ['1024045'],
  },
  {
    programCode: 'CNTT-K26-KSTN',
    degreeLevel: DegreeLevel.ENGINEER,
    frames: ['1024046'],
  },
];
