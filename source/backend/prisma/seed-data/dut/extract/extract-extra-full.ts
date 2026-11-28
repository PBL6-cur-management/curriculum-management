import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Prisma,
  StudentStatus,
} from '../../../../src/generated/prisma/client.js';
import { readMirrorCsv, type MirrorRow as RawRow } from '../../../demo-mirror.js';
import {
  admissionTermFromStudentCode,
  cohortFromLegacyCode,
  estimateSemesterStart,
  LEGACY_FLAG_ON,
  LEGACY_TERM_SUFFIX,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import type { DutResult } from '../people-data.js';
import type { ExtraFacultiesFile } from './extract-extra.js';
import { EXTRA_FACULTY_CODES } from './extra-program-map.js';
import {
  DEFAULT_MIRROR_ROOT,
  MIRROR_TABLES,
  readMirrorTable,
} from './mirror-tables.js';

export interface ExtraSubjectGroupDef {
  groupCode: string;
  groupName: string;
  facultyUnitCode: string;
}

export interface ExtraAssessmentComponentDef {
  componentCode: string;
  componentName: string;
  weight: string;
}

export interface ExtraWeeklyContentDef {
  weekLabel: string;
  content: string;
  teachingActivities: string | null;
}

export interface ExtraCourseMetadata {
  courseCode: string;
  ownerGroupCode: string | null;
  description: string | null;
  englishName: string | null;
  objectives: string | null;
  references: string | null;
  theoryCredits: number;
  practiceCredits: number;
  formula: ExtraAssessmentComponentDef[] | null;
  weeklyContents: ExtraWeeklyContentDef[];
}

export interface ExtraPloTemplate {
  ploCode: string;
  description: string;
  englishDescription: string;
  competencyGroup: string;
}

export interface ExtraSyllabiOutcomesFile {
  subjectGroups: ExtraSubjectGroupDef[];
  ploTemplates: Record<string, ExtraPloTemplate[]>;
  courses: Record<string, ExtraCourseMetadata>;
}

export interface ExtraStudentRecord {
  studentCode: string;
  fullName: string;
  cohortCode: string;
  admissionTermCode: string;
  frameCode: string;
  programCode: string;
  status: StudentStatus;
  email: string | null;
}

export interface ExtraLecturerRecord {
  staffCode: string;
  fullName: string;
  email: string | null;
  unitCode: string;
  facultyUnitCode: string;
  suggestedGroupCode: string;
  archived: boolean;
}

export interface ExtraTermInfo {
  semesterCode: string;
  academicYear: string;
  termInYear: number;
  startDate: string;
  startDateEstimated: boolean;
}

export interface ExtraPeopleFile {
  openTermCode: string;
  terms: ExtraTermInfo[];
  lecturers: ExtraLecturerRecord[];
  students: ExtraStudentRecord[];
}

export const EXTRA_SUBJECT_GROUPS: readonly ExtraSubjectGroupDef[] = [
  {
    groupCode: 'DTVT-DT',
    groupName: 'Nhóm chuyên môn Kỹ thuật Điện tử',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
  },
  {
    groupCode: 'DTVT-VT',
    groupName: 'Nhóm chuyên môn Kỹ thuật Viễn thông',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
  },
  {
    groupCode: 'DTVT-KTMT',
    groupName: 'Nhóm chuyên môn Kỹ thuật Máy tính & Hệ thống nhúng',
    facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
  },
  {
    groupCode: 'KTR-TK',
    groupName: 'Nhóm chuyên môn Thiết kế Kiến trúc',
    facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
  },
  {
    groupCode: 'KTR-QH',
    groupName: 'Nhóm chuyên môn Quy hoạch & Cảnh quan Đô thị',
    facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
  },
] as const;

const DTVT_KTMT_PATTERN =
  /máy tính|nhúng|vi điều khiển|vi xử lý|fpga|\bsoc\b|\bhdl\b|verilog|vhdl|vlsi|vi mạch|\bic\b|\biot\b|hệ điều hành|lập trình|mạng máy tính|trí tuệ nhân tạo|học máy|robot|\barm\b|\bplc\b|scada|kiến trúc máy tính|cấu trúc máy tính|phần mềm|dữ liệu|ktmt|kỹ thuật số/i;

const DTVT_VT_PATTERN =
  /viễn thông|truyền thông|thông tin|anten|siêu cao tần|sóng|vô tuyến|quang|di động|\b5g\b|\b4g\b|\brf\b|viba|chuyển mạch|xử lý tín hiệu|truyền dẫn|điều chế|mã hóa|radar|vệ tinh|mạng truyền/i;

const KTR_QH_PATTERN =
  /quy hoạch|đô thị|cảnh quan|hạ tầng|giao thông|môi trường đô thị|bền vững|không gian công cộng|địa hình|sinh thái|di sản|bảo tồn/i;

const DTVT_LEGACY_UNITS = new Set(['106', '122', '123']);
const KTR_LEGACY_UNITS = new Set(['121']);
const EXTRA_LECTURER_UNITS = new Set(['106', '121', '122', '123']);
const ARCHIVED_UNIT_CODE = '990';
const STUDENT_CODE_PATTERN = /^[A-Za-z0-9_-]{5,20}$/;
const NINE_DIGIT_STUDENT = /^\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMPONENT_NAMES: Record<string, string> = {
  CK: 'Thi cuối kỳ',
  GK: 'Kiểm tra giữa kỳ',
  BT: 'Bài tập',
  TN: 'Thí nghiệm',
  QT: 'Quá trình',
  TH: 'Thực hành',
  CC: 'Chuyên cần',
  HD: 'Hoạt động trên lớp',
  VI: 'Vấn đáp',
  DA: 'Đồ án',
  DO: 'Đồ án',
  BC: 'Báo cáo',
  BV: 'Bảo vệ',
  VD: 'Vấn đáp',
  KT: 'Kiểm tra',
  TT: 'Thực tập',
  LN: 'Làm nhóm',
  LT: 'Lý thuyết',
  RD: 'Rèn luyện',
  DG: 'Đánh giá',
};

export function classifyCourseSubjectGroup(
  courseCode: string,
  courseName: string,
  ownerUnitCode: string,
): string | null {
  const prefix = courseCode.slice(0, 3);
  const isDtvt =
    ownerUnitCode === EXTRA_FACULTY_CODES.DTVT || DTVT_LEGACY_UNITS.has(prefix);
  if (isDtvt) {
    if (DTVT_KTMT_PATTERN.test(courseName)) return 'DTVT-KTMT';
    if (DTVT_VT_PATTERN.test(courseName)) return 'DTVT-VT';
    return 'DTVT-DT';
  }
  const isKtr =
    ownerUnitCode === EXTRA_FACULTY_CODES.KTR || KTR_LEGACY_UNITS.has(prefix);
  if (isKtr) {
    if (KTR_QH_PATTERN.test(courseName)) return 'KTR-QH';
    return 'KTR-TK';
  }
  return null;
}

export function parseGradeFormula(
  expression: string | null,
): ExtraAssessmentComponentDef[] | null {
  if (!expression) return null;
  const terms = [...expression.matchAll(/\[(\w+)\]\s*\*\s*([0-9.]+)/g)];
  if (terms.length === 0) return null;
  const merged = new Map<string, Prisma.Decimal>();
  for (const [, rawCode, factor] of terms) {
    const code = rawCode.trim().toUpperCase();
    if (!code || !/^\d+(?:\.\d+)?$/.test(factor)) return null;
    const weight = new Prisma.Decimal(factor).times(100);
    merged.set(code, (merged.get(code) ?? new Prisma.Decimal(0)).plus(weight));
  }
  const components: ExtraAssessmentComponentDef[] = [...merged].map(
    ([code, weight]) => ({
      componentCode: code,
      componentName: COMPONENT_NAMES[code] ?? `Thành phần ${code}`,
      weight: weight.toDecimalPlaces(2).toString(),
    }),
  );
  const total = components.reduce(
    (sum, item) => sum.plus(new Prisma.Decimal(item.weight)),
    new Prisma.Decimal(0),
  );
  const allPositive = components.every((item) =>
    new Prisma.Decimal(item.weight).gt(0),
  );
  return total.eq(100) && allPositive ? components : null;
}

export function isValidLegacyTermCode(code: string): boolean {
  return /^\d{4}$/.test(code) && LEGACY_TERM_SUFFIX[code.slice(2)] !== undefined;
}

export function resolveStudentAdmissionTerm(
  idCodeVao: string,
  studentCode: string,
  frameStartSemesterCode: string | null,
): string {
  if (isValidLegacyTermCode(idCodeVao)) return idCodeVao;
  if (NINE_DIGIT_STUDENT.test(studentCode)) {
    const inferred = admissionTermFromStudentCode(studentCode);
    if (isValidLegacyTermCode(inferred)) return inferred;
  }
  if (frameStartSemesterCode && isValidLegacyTermCode(frameStartSemesterCode)) {
    return frameStartSemesterCode;
  }
  return '2010';
}

export function mapLecturerFacultyUnit(
  khoaPc: string,
  maBp: string,
): string | null {
  if (khoaPc === '121' || maBp === '121') return EXTRA_FACULTY_CODES.KTR;
  if (DTVT_LEGACY_UNITS.has(khoaPc) || DTVT_LEGACY_UNITS.has(maBp)) {
    return EXTRA_FACULTY_CODES.DTVT;
  }
  return null;
}

export const PLO_TEMPLATES: Record<string, ExtraPloTemplate[]> = {
  '7520207': [
    {
      ploCode: 'PLO1',
      description:
        'Áp dụng kiến thức toán học, khoa học tự nhiên và kỹ thuật cơ sở để phân tích các bài toán trong lĩnh vực Điện tử - Viễn thông.',
      englishDescription:
        'Apply mathematics, natural sciences, and core engineering knowledge to analyze Electronics and Telecommunications problems.',
      competencyGroup: 'Kiến thức nền tảng',
    },
    {
      ploCode: 'PLO2',
      description:
        'Phân tích, thiết kế và mô phỏng các mạch điện tử tương tự, mạch số, hệ thống xử lý tín hiệu và vi mạch tích hợp.',
      englishDescription:
        'Analyze, design, and simulate analog/digital circuits, signal processing systems, and integrated circuits.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO3',
      description:
        'Thiết kế, triển khai và tối ưu hóa hệ thống truyền thông, mạng viễn thông vô tuyến, quang và truyền dẫn dữ liệu.',
      englishDescription:
        'Design, deploy, and optimize wireless, optical, and data telecommunications networks and systems.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO4',
      description:
        'Thiết kế và thực hiện thí nghiệm, đo lường mạch và hệ thống điện tử - viễn thông, phân tích và diễn giải số liệu thực nghiệm.',
      englishDescription:
        'Design and conduct experiments, measure electronic and telecom systems, and analyze experimental data.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO5',
      description:
        'Sử dụng thành thạo các công cụ EDA, phần mềm mô phỏng, thiết bị đo kiểm hiện đại và ngôn ngữ lập trình nhúng.',
      englishDescription:
        'Proficiently use modern EDA tools, simulation software, test instrumentation, and embedded programming languages.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO6',
      description:
        'Làm việc hiệu quả trong nhóm đa ngành, giao tiếp kỹ thuật rõ ràng bằng tiếng Việt và tiếng Anh chuyên ngành.',
      englishDescription:
        'Work effectively in multidisciplinary teams and communicate technical concepts clearly in Vietnamese and English.',
      competencyGroup: 'Kỹ năng mềm',
    },
    {
      ploCode: 'PLO7',
      description:
        'Đánh giá tác động của giải pháp kỹ thuật điện tử - viễn thông đối với xã hội, môi trường, an toàn và phát triển bền vững.',
      englishDescription:
        'Evaluate societal, environmental, safety, and sustainability impacts of electronics and telecom engineering solutions.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Tuân thủ đạo đức nghề nghiệp, có năng lực tự học suốt đời và thích ứng với sự phát triển nhanh của công nghệ.',
      englishDescription:
        'Uphold professional ethics, engage in lifelong learning, and adapt to rapidly evolving technologies.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '7480106': [
    {
      ploCode: 'PLO1',
      description:
        'Vận dụng kiến thức toán học, khoa học cơ bản và kỹ thuật máy tính để giải quyết các bài toán kỹ thuật phức tạp.',
      englishDescription:
        'Apply mathematics, basic sciences, and computer engineering fundamentals to solve complex engineering problems.',
      competencyGroup: 'Kiến thức nền tảng',
    },
    {
      ploCode: 'PLO2',
      description:
        'Phân tích và thiết kế kiến trúc máy tính, hệ thống số, vi xử lý, FPGA và các hệ thống trên chip (SoC).',
      englishDescription:
        'Analyze and design computer architecture, digital systems, microprocessors, FPGAs, and Systems-on-Chip (SoC).',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO3',
      description:
        'Phát triển phần mềm hệ thống, phần mềm nhúng thời gian thực và các ứng dụng IoT tích hợp phần cứng - phần mềm.',
      englishDescription:
        'Develop system software, real-time embedded firmware, and hardware-software co-designed IoT applications.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO4',
      description:
        'Tích hợp mạng máy tính, cảm biến, trí tuệ nhân tạo biên (Edge AI) và đảm bảo an toàn cho hệ thống nhúng.',
      englishDescription:
        'Integrate computer networks, sensors, Edge AI, and security mechanisms into embedded computing systems.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO5',
      description:
        'Kiểm thử, gỡ lỗi, đo lường hiệu năng và tối ưu hóa năng lượng cho hệ thống phần cứng và phần mềm nhúng.',
      englishDescription:
        'Test, debug, benchmark performance, and optimize power consumption of hardware and embedded software systems.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO6',
      description:
        'Phối hợp làm việc nhóm hiệu quả, quản lý dự án kỹ thuật và trình bày tài liệu kỹ thuật bằng tiếng Việt và tiếng Anh.',
      englishDescription:
        'Collaborate effectively in teams, manage engineering projects, and present technical documentation in Vietnamese and English.',
      competencyGroup: 'Kỹ năng mềm',
    },
    {
      ploCode: 'PLO7',
      description:
        'Nhận thức trách nhiệm nghề nghiệp, tiêu chuẩn công nghiệp, sở hữu trí tuệ và tác động xã hội của công nghệ máy tính.',
      englishDescription:
        'Demonstrate professional responsibility, adherence to industry standards, intellectual property awareness, and social impact assessment.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Chủ động tự nghiên cứu, cập nhật công nghệ bán dẫn, hệ thống máy tính thế hệ mới và học tập suốt đời.',
      englishDescription:
        'Pursue independent research, keep pace with emerging semiconductor and computing technologies, and practice lifelong learning.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '7580101': [
    {
      ploCode: 'PLO1',
      description:
        'Vận dụng kiến thức khoa học cơ bản, lịch sử, văn hóa, nghệ thuật và lý thuyết kiến trúc vào thực tiễn sáng tác.',
      englishDescription:
        'Apply foundational sciences, history, culture, arts, and architectural theory to design practice.',
      competencyGroup: 'Kiến thức nền tảng',
    },
    {
      ploCode: 'PLO2',
      description:
        'Tổ chức không gian và thiết kế công trình kiến trúc đáp ứng công năng, thẩm mỹ, khí hậu nhiệt đới và bản sắc địa phương.',
      englishDescription:
        'Organize spaces and design architectural works meeting functional, aesthetic, tropical climate, and local identity requirements.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO3',
      description:
        'Tích hợp giải pháp kết cấu, cấu tạo kiến trúc, vật liệu xây dựng và hệ thống kỹ thuật công trình vào đồ án thiết kế.',
      englishDescription:
        'Integrate structural systems, building construction details, materials, and MEP building services into architectural designs.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO4',
      description:
        'Phân tích bối cảnh đô thị, thiết kế quy hoạch, cảnh quan và đề xuất giải pháp kiến trúc xanh, phát triển bền vững.',
      englishDescription:
        'Analyze urban context, design urban planning and landscape solutions, and promote green sustainable architecture.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO5',
      description:
        'Sử dụng thành thạo các công cụ diễn họa, mô hình hóa thông tin công trình (BIM), CAD và kỹ thuật trình bày đồ án.',
      englishDescription:
        'Proficiently use architectural visualization, BIM, CAD tools, and design presentation techniques.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO6',
      description:
        'Giao tiếp, phản biện, bảo vệ phương án thiết kế và phối hợp hiệu quả trong nhóm thiết kế đa ngành.',
      englishDescription:
        'Communicate, critique, defend design proposals, and collaborate effectively in multidisciplinary design teams.',
      competencyGroup: 'Kỹ năng mềm',
    },
    {
      ploCode: 'PLO7',
      description:
        'Tuân thủ quy chuẩn, tiêu chuẩn xây dựng, pháp luật quy hoạch, an toàn phòng cháy chữa cháy và bảo tồn di sản.',
      englishDescription:
        'Comply with building codes, planning regulations, fire safety standards, and heritage conservation principles.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Thể hiện đạo đức nghề nghiệp kiến trúc sư, tư duy sáng tạo độc lập và tinh thần học tập suốt đời.',
      englishDescription:
        'Demonstrate architectural professional ethics, independent creative thinking, and commitment to lifelong learning.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '7480201': [
    {
      ploCode: 'PLO1',
      description:
        'Vận dụng kiến thức toán học, khoa học cơ bản và nền tảng máy tính để giải quyết các bài toán Công nghệ Thông tin.',
      englishDescription:
        'Apply mathematics, basic sciences, and computing fundamentals to solve Information Technology problems.',
      competencyGroup: 'Kiến thức nền tảng',
    },
    {
      ploCode: 'PLO2',
      description:
        'Phân tích yêu cầu, thiết kế kiến trúc và phát triển các hệ thống phần mềm, hệ thống thông tin đạt chuẩn chất lượng.',
      englishDescription:
        'Analyze requirements, architect, and develop high-quality software and information systems.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO3',
      description:
        'Thiết kế, triển khai và vận hành hạ tầng mạng, điện toán đám mây và các giải pháp an toàn, bảo mật thông tin.',
      englishDescription:
        'Design, deploy, and operate network infrastructure, cloud computing, and information security solutions.',
      competencyGroup: 'Kiến thức chuyên môn',
    },
    {
      ploCode: 'PLO4',
      description:
        'Ứng dụng khoa học dữ liệu, trí tuệ nhân tạo và thuật toán hiện đại để khai thác tri thức và tự động hóa quy trình.',
      englishDescription:
        'Apply data science, artificial intelligence, and modern algorithms for knowledge discovery and process automation.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO5',
      description:
        'Sử dụng thành thạo công cụ phát triển, kiểm thử tự động, quản lý cấu hình và quy trình DevOps hiện đại.',
      englishDescription:
        'Proficiently use modern development tools, automated testing, configuration management, and DevOps practices.',
      competencyGroup: 'Kỹ năng chuyên môn',
    },
    {
      ploCode: 'PLO6',
      description:
        'Làm việc nhóm linh hoạt, quản lý dự án phần mềm và giao tiếp chuyên môn hiệu quả bằng tiếng Việt và tiếng Anh.',
      englishDescription:
        'Work effectively in agile teams, manage software projects, and communicate professionally in Vietnamese and English.',
      competencyGroup: 'Kỹ năng mềm',
    },
    {
      ploCode: 'PLO7',
      description:
        'Đánh giá rủi ro an toàn thông tin, quyền riêng tư dữ liệu và tác động kinh tế - xã hội của giải pháp số.',
      englishDescription:
        'Assess cybersecurity risks, data privacy, and socio-economic impacts of digital solutions.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Tuân thủ đạo đức nghề nghiệp CNTT, có năng lực tự nghiên cứu và học tập suốt đời trong kỷ nguyên số.',
      englishDescription:
        'Uphold IT professional ethics, conduct independent research, and pursue lifelong learning in the digital era.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '8480101': [
    {
      ploCode: 'PLO1',
      description:
        'Làm chủ kiến thức chuyên sâu và cập nhật về lý thuyết tính toán, thuật toán nâng cao và Khoa học máy tính hiện đại.',
      englishDescription:
        'Master advanced and up-to-date knowledge in computation theory, advanced algorithms, and modern Computer Science.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO2',
      description:
        'Nghiên cứu và đề xuất mô hình, phương pháp mới trong trí tuệ nhân tạo, học sâu, xử lý dữ liệu lớn và thị giác máy tính.',
      englishDescription:
        'Research and propose novel models and methods in AI, deep learning, big data analytics, and computer vision.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO3',
      description:
        'Thiết kế kiến trúc hệ thống phần mềm và hệ thống phân tán quy mô lớn với yêu cầu cao về độ tin cậy và bảo mật.',
      englishDescription:
        'Architect large-scale software and distributed systems with rigorous reliability and security requirements.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO4',
      description:
        'Thiết kế thực nghiệm khoa học, đánh giá định lượng và thẩm định kết quả nghiên cứu theo chuẩn quốc tế.',
      englishDescription:
        'Design rigorous scientific experiments, perform quantitative evaluations, and validate findings against international benchmarks.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO5',
      description:
        'Tổng hợp tài liệu khoa học, viết bài báo khoa học và trình bày kết quả nghiên cứu bằng tiếng Anh học thuật.',
      englishDescription:
        'Synthesize scientific literature, author research papers, and present findings in academic English.',
      competencyGroup: 'Kỹ năng học thuật',
    },
    {
      ploCode: 'PLO6',
      description:
        'Lãnh đạo nhóm nghiên cứu hoặc nhóm phát triển công nghệ, phản biện khoa học và chuyển giao tri thức.',
      englishDescription:
        'Lead research or engineering teams, conduct peer critique, and transfer technological knowledge.',
      competencyGroup: 'Kỹ năng mềm & Lãnh đạo',
    },
    {
      ploCode: 'PLO7',
      description:
        'Tuân thủ liêm chính học thuật, đạo đức nghiên cứu và đánh giá tác động xã hội của công nghệ AI và dữ liệu.',
      englishDescription:
        'Uphold academic integrity, research ethics, and evaluate societal impacts of AI and data technologies.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Tự định hướng nghiên cứu độc lập ở bậc tiến sĩ hoặc dẫn dắt đổi mới sáng tạo công nghệ trong doanh nghiệp.',
      englishDescription:
        'Pursue independent doctoral-level research or lead technological innovation in industry.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '8520203': [
    {
      ploCode: 'PLO1',
      description:
        'Làm chủ kiến thức chuyên sâu về lý thuyết mạch, thiết kế vi mạch bán dẫn, xử lý tín hiệu số và hệ thống điện tử hiện đại.',
      englishDescription:
        'Master advanced knowledge in circuit theory, VLSI/IC design, digital signal processing, and modern electronic systems.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO2',
      description:
        'Nghiên cứu, mô hình hóa và tối ưu hóa hệ thống điện tử thông minh, hệ thống nhúng công suất thấp và truyền thông thế hệ mới.',
      englishDescription:
        'Research, model, and optimize intelligent electronic systems, low-power embedded architectures, and next-generation communications.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO3',
      description:
        'Triển khai quy trình thiết kế, mô phỏng, kiểm chứng phần cứng và đo kiểm thực nghiệm đạt tiêu chuẩn công nghiệp.',
      englishDescription:
        'Execute hardware design, simulation, verification, and experimental characterization to industrial standards.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO4',
      description:
        'Phân tích dữ liệu thực nghiệm chuyên sâu và đề xuất giải pháp kỹ thuật sáng tạo cho bài toán thực tiễn phức tạp.',
      englishDescription:
        'Analyze complex experimental datasets and propose innovative engineering solutions to challenging real-world problems.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO5',
      description:
        'Công bố kết quả nghiên cứu, viết báo cáo khoa học và trao đổi học thuật quốc tế bằng tiếng Anh chuyên ngành.',
      englishDescription:
        'Publish research outcomes, write technical reports, and engage in international academic discourse in English.',
      competencyGroup: 'Kỹ năng học thuật',
    },
    {
      ploCode: 'PLO6',
      description:
        'Điều phối nhóm nghiên cứu - phát triển (R&D), quản trị dự án công nghệ cao và hợp tác doanh nghiệp.',
      englishDescription:
        'Coordinate R&D teams, manage high-tech projects, and collaborate with industry partners.',
      competencyGroup: 'Kỹ năng mềm & Lãnh đạo',
    },
    {
      ploCode: 'PLO7',
      description:
        'Tuân thủ liêm chính khoa học, tiêu chuẩn an toàn điện tử - viễn thông và trách nhiệm bảo vệ môi trường.',
      englishDescription:
        'Uphold scientific integrity, electronics safety standards, and environmental stewardship.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Có năng lực tự nghiên cứu độc lập, tiếp tục đào tạo trình độ tiến sĩ hoặc giữ vai trò chuyên gia kỹ thuật cao cấp.',
      englishDescription:
        'Demonstrate independent research capability for doctoral studies or senior technical specialist roles.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
  '8580101': [
    {
      ploCode: 'PLO1',
      description:
        'Làm chủ lý luận kiến trúc đương đại, phương pháp luận nghiên cứu kiến trúc và phát triển đô thị bền vững.',
      englishDescription:
        'Master contemporary architectural theory, architectural research methodology, and sustainable urban development.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO2',
      description:
        'Nghiên cứu và sáng tác giải pháp kiến trúc - đô thị thích ứng biến đổi khí hậu, bảo tồn di sản và bản sắc văn hóa.',
      englishDescription:
        'Research and create architectural and urban solutions resilient to climate change while preserving heritage and cultural identity.',
      competencyGroup: 'Kiến thức chuyên sâu',
    },
    {
      ploCode: 'PLO3',
      description:
        'Ứng dụng công nghệ thiết kế tham số, mô phỏng hiệu năng năng lượng công trình và quản lý dự án BIM nâng cao.',
      englishDescription:
        'Apply parametric design, building energy performance simulation, and advanced BIM project management.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO4',
      description:
        'Đánh giá phê bình công trình kiến trúc, chính sách quy hoạch và đề xuất khuyến nghị thực tiễn có cơ sở khoa học.',
      englishDescription:
        'Critically evaluate architectural works and urban policies to formulate evidence-based recommendations.',
      competencyGroup: 'Kỹ năng nghiên cứu & Thiết kế',
    },
    {
      ploCode: 'PLO5',
      description:
        'Viết luận văn, bài báo khoa học và trình bày phản biện chuyên môn bằng tiếng Việt và tiếng Anh học thuật.',
      englishDescription:
        'Author theses and scholarly articles and present professional critiques in Vietnamese and academic English.',
      competencyGroup: 'Kỹ năng học thuật',
    },
    {
      ploCode: 'PLO6',
      description:
        'Chủ trì nhóm thiết kế - nghiên cứu đa ngành, tư vấn chuyên gia và điều phối các bên liên quan trong dự án đô thị.',
      englishDescription:
        'Lead multidisciplinary design-research teams, provide expert consultancy, and coordinate urban project stakeholders.',
      competencyGroup: 'Kỹ năng mềm & Lãnh đạo',
    },
    {
      ploCode: 'PLO7',
      description:
        'Tuân thủ đạo đức hành nghề, liêm chính học thuật, pháp luật quy hoạch xây dựng và trách nhiệm cộng đồng.',
      englishDescription:
        'Uphold professional ethics, academic integrity, urban planning law, and community responsibility.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
    {
      ploCode: 'PLO8',
      description:
        'Tự chủ định hướng nghiên cứu ở bậc tiến sĩ hoặc dẫn dắt đổi mới sáng tạo trong thực hành kiến trúc đương đại.',
      englishDescription:
        'Pursue autonomous doctoral research or lead creative innovation in contemporary architectural practice.',
      competencyGroup: 'Năng lực tự chủ & Trách nhiệm',
    },
  ],
};

const filled = (value: string | undefined): string | null =>
  value !== undefined && value !== '' && value !== 'NULL' ? value : null;

export function deriveGradeFromScore10(
  score10Raw: string | null | undefined,
): { score4: string; letterGrade: string } | null {
  if (!score10Raw) return null;
  const score = Number(score10Raw);
  if (!Number.isFinite(score) || score < 0 || score > 10) return null;
  if (score >= 8.5) return { score4: '4.0', letterGrade: 'A' };
  if (score >= 8.0) return { score4: '3.5', letterGrade: 'B+' };
  if (score >= 7.0) return { score4: '3.0', letterGrade: 'B' };
  if (score >= 6.5) return { score4: '2.5', letterGrade: 'C+' };
  if (score >= 5.5) return { score4: '2.0', letterGrade: 'C' };
  if (score >= 5.0) return { score4: '1.5', letterGrade: 'D+' };
  if (score >= 4.0) return { score4: '1.0', letterGrade: 'D' };
  return { score4: '0.0', letterGrade: 'F' };
}

function resolveMirrorDir(cliArg?: string): string {
  return resolve(
    cliArg ??
      process.env.DUT_MIRROR_DIR ??
      process.env.DUT_MIRROR_ROOT ??
      DEFAULT_MIRROR_ROOT,
  );
}

async function main() {
  const mirrorDir = resolveMirrorDir(process.argv[2]);
  const extraFacultiesUrl = new URL(
    '../data/extra-faculties.json',
    import.meta.url,
  );
  const extraData = JSON.parse(
    readFileSync(extraFacultiesUrl, 'utf8'),
  ) as ExtraFacultiesFile;

  // 1. Collect all frames and course codes from extra-faculties.json
  const frameToProgram = new Map<
    string,
    { programCode: string; startSemesterCode: string | null }
  >();
  for (const program of extraData.programs) {
    for (const version of program.versions) {
      frameToProgram.set(version.frameCode, {
        programCode: program.programCode,
        startSemesterCode: version.startSemesterCode,
      });
    }
  }
  const frameCodes = new Set(frameToProgram.keys());

  const courseOwnerUnit = new Map<string, string>();
  const courseNameByCode = new Map<string, string>();
  for (const course of extraData.catalog.courses) {
    courseOwnerUnit.set(course.courseCode, course.ownerUnitCode);
    courseNameByCode.set(course.courseCode, course.courseName);
  }
  const allCourseCodes = new Set<string>(courseOwnerUnit.keys());
  for (const item of extraData.trackShowcase.commonItems) {
    allCourseCodes.add(item.courseCode);
  }
  for (const track of extraData.trackShowcase.tracks) {
    for (const item of track.items) {
      allCourseCodes.add(item.courseCode);
    }
  }

  console.log(
    `Extracting extra full data from ${mirrorDir} for ${frameCodes.size} frames and ${allCourseCodes.size} courses...`,
  );

  // 2. Read mirror tables in parallel
  const [
    teacherCourses,
    proxCourses,
    formulas,
    weeklyRows,
    teachingRows1,
    teachingRows2,
    studentsTable,
    standingTable,
    resultsTable,
    summaryResultsRows,
    exemptionsTable,
    lecturersTable,
    termsTable,
  ] = await Promise.all([
    readMirrorCsv(mirrorDir, 'DATA_GVien1', 'tmHocPhan'),
    readMirrorCsv(mirrorDir, 'tmProxDUT', 'tmHocPhan'),
    readMirrorCsv(mirrorDir, 'DHBK_CDS', 'congthucdiem'),
    readMirrorCsv(mirrorDir, 'DATA_GVien1', 'tmHocPhanLT'),
    readMirrorCsv(mirrorDir, 'DATA_GVien1', 'tmHocphanGV'),
    readMirrorCsv(mirrorDir, 'tmProxDUT', 'tmHocphanGV'),
    readMirrorTable(mirrorDir, MIRROR_TABLES.STUDENTS),
    readMirrorTable(mirrorDir, MIRROR_TABLES.ACADEMIC_STANDING),
    readMirrorTable(mirrorDir, MIRROR_TABLES.RESULTS),
    readMirrorCsv(mirrorDir, 'tmProxDUT', 'tmDiemTK'),
    readMirrorTable(mirrorDir, MIRROR_TABLES.EXEMPTIONS),
    readMirrorTable(mirrorDir, MIRROR_TABLES.LECTURERS),
    readMirrorTable(mirrorDir, MIRROR_TABLES.TERMS),
  ]);

  // 3. Extract syllabus metadata + subject-group mapping for all courses
  const teacherByCourse = new Map<string, RawRow>(
    teacherCourses.map((row) => [row.MaHP, row]),
  );
  const proxByCourse = new Map<string, RawRow>(
    proxCourses.map((row) => [row.MaHP, row]),
  );
  const formulaByCode = new Map<string, string>(
    formulas.map((row) => [row.Macongthuc, row.VarString3]),
  );
  const weeksByCourse = new Map<string, RawRow[]>();
  for (const row of weeklyRows) {
    if (!allCourseCodes.has(row.MaHP) || !filled(row.NoiDung)) continue;
    const list = weeksByCourse.get(row.MaHP) ?? [];
    list.push(row);
    weeksByCourse.set(row.MaHP, list);
  }

  const coursesMeta: Record<string, ExtraCourseMetadata> = {};
  let realDescriptions = 0;
  let realObjectives = 0;
  let realFormulas = 0;
  let realWeeklyCourses = 0;
  let groupedCourses = 0;

  for (const courseCode of [...allCourseCodes].sort()) {
    const t = teacherByCourse.get(courseCode);
    const p = proxByCourse.get(courseCode);
    const pick = (col: string) => filled(t?.[col]) ?? filled(p?.[col]);

    const courseName =
      courseNameByCode.get(courseCode) ?? pick('TenHP') ?? courseCode;
    const ownerUnitCode = courseOwnerUnit.get(courseCode) ?? '';
    const ownerGroupCode = classifyCourseSubjectGroup(
      courseCode,
      courseName,
      ownerUnitCode,
    );
    if (ownerGroupCode) groupedCourses++;

    const description = pick('Mota');
    const objectives = pick('ChuanKT');
    const references = pick('TaiLieuTK') ?? pick('GiaoTrinh');
    const englishName = pick('TenHP1');
    const theoryCredits = Number(pick('LyThuyet') ?? 0) || 0;
    const practiceCredits =
      Number(pick('ThucHanh') ?? pick('ThucTap') ?? 0) || 0;
    const formula = parseGradeFormula(
      filled(formulaByCode.get(pick('MaCongThuc') ?? '')) ?? null,
    );
    const rawWeeks = (weeksByCourse.get(courseCode) ?? []).sort(
      (a, b) => Number(a.Tuan) - Number(b.Tuan) || Number(a.ID) - Number(b.ID),
    );
    const weeklyContents: ExtraWeeklyContentDef[] = rawWeeks.map((row) => ({
      weekLabel: row.Tuan || '1',
      content: row.NoiDung,
      teachingActivities:
        [
          Number(row.LT) > 0 ? `${row.LT} tiết lý thuyết` : null,
          Number(row.BT) > 0 ? `${row.BT} tiết bài tập` : null,
          Number(row.TH) > 0 ? `${row.TH} tiết thực hành` : null,
        ]
          .filter((part): part is string => part !== null)
          .join(', ') || null,
    }));

    if (description) realDescriptions++;
    if (objectives) realObjectives++;
    if (formula) realFormulas++;
    if (weeklyContents.length > 0) realWeeklyCourses++;

    coursesMeta[courseCode] = {
      courseCode,
      ownerGroupCode,
      description,
      englishName,
      objectives,
      references,
      theoryCredits,
      practiceCredits,
      formula,
      weeklyContents,
    };
  }

  const syllabiOutcomesOutput: ExtraSyllabiOutcomesFile = {
    subjectGroups: [...EXTRA_SUBJECT_GROUPS],
    ploTemplates: PLO_TEMPLATES,
    courses: coursesMeta,
  };

  // 4. Extract students for the 116 extra frames
  const studentMap = new Map<string, ExtraStudentRecord>();
  for (const row of studentsTable.rows) {
    if (!STUDENT_CODE_PATTERN.test(row.MaHS)) continue;
    const frameMeta = frameToProgram.get(row.MaNganh);
    if (!frameMeta) continue;
    const admissionTermCode = resolveStudentAdmissionTerm(
      row.IDCodeVao,
      row.MaHS,
      frameMeta.startSemesterCode,
    );
    const { cohortCode } = cohortFromLegacyCode(admissionTermCode);
    studentMap.set(row.MaHS, {
      studentCode: row.MaHS,
      fullName: row.Hoten || row.MaHS,
      cohortCode,
      admissionTermCode,
      frameCode: row.MaNganh,
      programCode: frameMeta.programCode,
      status: StudentStatus.STUDYING,
      email: null,
    });
  }

  // Apply latest academic standing (tmHocvu)
  const latestStanding = new Map<
    string,
    (typeof standingTable.rows)[number]
  >();
  for (const row of standingTable.rows) {
    if (!studentMap.has(row.MaHS)) continue;
    const prev = latestStanding.get(row.MaHS);
    if (!prev || Number(row.IDCode) > Number(prev.IDCode)) {
      latestStanding.set(row.MaHS, row);
    }
  }
  for (const [studentCode, standing] of latestStanding) {
    const student = studentMap.get(studentCode)!;
    if (standing.Thoihoc === LEGACY_FLAG_ON) {
      student.status = StudentStatus.WITHDRAWN;
    } else if (standing.ngunghoc === LEGACY_FLAG_ON) {
      student.status = StudentStatus.ON_LEAVE;
    }
  }

  // 5. Extract academic results & exemptions for those students
  const bestResults = new Map<string, DutResult>();
  for (const row of resultsTable.rows) {
    if (!studentMap.has(row.MaHS) || !isValidLegacyTermCode(row.IDCode)) {
      continue;
    }
    const candidate: DutResult = {
      studentCode: row.MaHS,
      courseCode: row.MaHP,
      termCode: row.IDCode,
      score10: row.Diem || null,
      score4: row.Diem4 || null,
      letterGrade: row.DiemC || null,
      exempt: false,
    };
    const key = `${candidate.studentCode}:${candidate.courseCode}:${candidate.termCode}`;
    const prev = bestResults.get(key);
    if (!prev || Number(candidate.score4 ?? -1) > Number(prev.score4 ?? -1)) {
      bestResults.set(key, candidate);
    }
  }
  // Supplement from tmDiemTK (holds full historical grades for ETE/KTMT/Kiến trúc where tmDiemkyhoc only has CNTT/Grad)
  let summaryAdded = 0;
  for (const row of summaryResultsRows) {
    const studentCode = row.MaHS;
    const courseCode = row.MaHP;
    const termCode = row.IDCode;
    if (
      !studentCode ||
      !courseCode ||
      !studentMap.has(studentCode) ||
      !isValidLegacyTermCode(termCode)
    ) {
      continue;
    }
    const key = `${studentCode}:${courseCode}:${termCode}`;
    if (bestResults.has(key)) continue;
    const score10 = filled(row.Diem);
    const derived = deriveGradeFromScore10(score10);
    const score4 = filled(row.Diem4) ?? derived?.score4 ?? null;
    const letterGrade = filled(row.DiemC) ?? derived?.letterGrade ?? null;
    if (!score10 && !letterGrade) continue;
    bestResults.set(key, {
      studentCode,
      courseCode,
      termCode,
      score10,
      score4,
      letterGrade,
      exempt: false,
    });
    summaryAdded++;
  }
  let exemptionsKept = 0;
  for (const row of exemptionsTable.rows) {
    if (!studentMap.has(row.MaHS) || !isValidLegacyTermCode(row.IDCode)) {
      continue;
    }
    const key = `${row.MaHS}:${row.MaHP}:${row.IDCode}`;
    if (bestResults.has(key)) continue;
    bestResults.set(key, {
      studentCode: row.MaHS,
      courseCode: row.MaHP,
      termCode: row.IDCode,
      score10: row.Diem || null,
      score4: row.Diem4 || null,
      letterGrade: row.DiemC || null,
      exempt: true,
    });
    exemptionsKept++;
  }
  const results = [...bestResults.values()];

  // 6. Build term catalog for all admission + result terms
  const officialTermStart = new Map<string, string>();
  for (const row of termsTable.rows) {
    if (isValidLegacyTermCode(row.IDCode) && row.NgayDau) {
      officialTermStart.set(row.IDCode, row.NgayDau.slice(0, 10));
    }
  }
  const referencedTermCodes = new Set<string>();
  for (const student of studentMap.values()) {
    referencedTermCodes.add(student.admissionTermCode);
  }
  const resultTermCodes: string[] = [];
  for (const res of results) {
    referencedTermCodes.add(res.termCode);
    resultTermCodes.push(res.termCode);
  }
  resultTermCodes.sort();
  const openTermCode = resultTermCodes.at(-1) ?? '2520';
  referencedTermCodes.add(openTermCode);

  const terms: ExtraTermInfo[] = [...referencedTermCodes]
    .sort()
    .map((code) => {
      const parsed = semesterFromLegacyCode(code);
      const official = officialTermStart.get(code);
      return {
        semesterCode: parsed.semesterCode,
        academicYear: parsed.academicYear,
        termInYear: parsed.termInYear,
        startDate: official ?? estimateSemesterStart(code),
        startDateEstimated: !official,
      };
    });

  // 7. Extract lecturers for units 106, 121, 122, 123
  const groupCountsByLecturer = new Map<string, Map<string, number>>();
  for (const row of [...teachingRows1, ...teachingRows2]) {
    const staffCode = row.MaHS;
    const courseCode = row.MaHP;
    if (!staffCode || !courseCode) continue;
    const groupCode = coursesMeta[courseCode]?.ownerGroupCode;
    if (!groupCode) continue;
    const counts =
      groupCountsByLecturer.get(staffCode) ?? new Map<string, number>();
    counts.set(groupCode, (counts.get(groupCode) ?? 0) + 1);
    groupCountsByLecturer.set(staffCode, counts);
  }

  const groupFacultyByCode = new Map(
    EXTRA_SUBJECT_GROUPS.map((g) => [g.groupCode, g.facultyUnitCode]),
  );

  const lecturers: ExtraLecturerRecord[] = [];
  const seenStaffCodes = new Set<string>();
  for (const row of lecturersTable.rows) {
    if (!row.MaHS || seenStaffCodes.has(row.MaHS)) continue;
    if (
      !EXTRA_LECTURER_UNITS.has(row.KhoaPC) &&
      !EXTRA_LECTURER_UNITS.has(row.MaBP)
    ) {
      continue;
    }
    const facultyUnitCode = mapLecturerFacultyUnit(row.KhoaPC, row.MaBP);
    if (!facultyUnitCode) continue;
    seenStaffCodes.add(row.MaHS);

    const taughtGroups = groupCountsByLecturer.get(row.MaHS);
    let suggestedGroupCode =
      facultyUnitCode === EXTRA_FACULTY_CODES.KTR ? 'KTR-TK' : 'DTVT-DT';
    if (taughtGroups) {
      const matchingFacultyGroups = [...taughtGroups.entries()]
        .filter(([code]) => groupFacultyByCode.get(code) === facultyUnitCode)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      if (matchingFacultyGroups.length > 0) {
        suggestedGroupCode = matchingFacultyGroups[0][0];
      }
    }

    lecturers.push({
      staffCode: row.MaHS,
      fullName: row.Hoten || row.MaHS,
      email: EMAIL_PATTERN.test(row.Email) ? row.Email.toLowerCase() : null,
      unitCode: row.MaBP || row.KhoaPC,
      facultyUnitCode,
      suggestedGroupCode,
      archived: row.MaBP === ARCHIVED_UNIT_CODE,
    });
  }
  lecturers.sort((a, b) => a.staffCode.localeCompare(b.staffCode));

  const students = [...studentMap.values()].sort((a, b) =>
    a.studentCode.localeCompare(b.studentCode),
  );

  const peopleOutput: ExtraPeopleFile = {
    openTermCode,
    terms,
    lecturers,
    students,
  };

  // 8. Write outputs
  const syllabiOutPath = fileURLToPath(
    new URL('../data/extra-syllabi-outcomes.json', import.meta.url),
  );
  const privateDir = fileURLToPath(
    new URL('../data/private', import.meta.url),
  );
  if (!existsSync(privateDir)) {
    mkdirSync(privateDir, { recursive: true });
  }
  const peopleOutPath = resolve(privateDir, 'extra-people.json');
  const resultsOutPath = resolve(privateDir, 'extra-results.jsonl');

  mkdirSync(dirname(syllabiOutPath), { recursive: true });
  writeFileSync(
    syllabiOutPath,
    `${JSON.stringify(syllabiOutcomesOutput, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    peopleOutPath,
    `${JSON.stringify(peopleOutput, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    resultsOutPath,
    results.map((r) => JSON.stringify(r)).join('\n') + (results.length ? '\n' : ''),
    'utf8',
  );

  console.log('=== Extra Full Extraction Complete ===');
  console.log(`Non-PII file: ${syllabiOutPath}`);
  console.log(
    `  Courses indexed: ${allCourseCodes.size} (grouped=${groupedCourses}, realDesc=${realDescriptions}, realObj=${realObjectives}, realFormula=${realFormulas}, realWeeks=${realWeeklyCourses})`,
  );
  console.log(
    `  Subject groups: ${EXTRA_SUBJECT_GROUPS.length}, PLO templates: ${Object.keys(PLO_TEMPLATES).length}`,
  );
  console.log(`PII files (gitignored): ${peopleOutPath}, ${resultsOutPath}`);
  console.log(
    `  Students: ${students.length}, Results: ${results.length} (from tmDiemTK=${summaryAdded}, exemptions=${exemptionsKept}), Lecturers: ${lecturers.length}, Terms: ${terms.length} (openTerm=${openTermCode})`,
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
