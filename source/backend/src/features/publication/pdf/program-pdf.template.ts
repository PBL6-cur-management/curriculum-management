import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DRAFT_MARK } from '../publication.constants.js';

// Everything the PDF prints, captured when the export is accepted: the worker never reads a moving Draft.
export interface ProgramPdfSnapshot {
  draft: boolean;
  programCode: string;
  programName: string;
  majorCode: string;
  majorName: string;
  degreeLevel: string;
  versionNumber: string | null;
  statusLabel: string;
  decisionNumber: string | null;
  signedDate: string | null;
  effectiveSemester: string | null;
  semesterCount: number;
  totalCredits: string;
  compulsoryCredits: string;
  electiveCredits: string;
  semesters: {
    semester: number;
    credits: string;
    items: {
      courseCode: string;
      courseName: string;
      credits: string;
      elective: boolean;
      groupCode: string | null;
    }[];
  }[];
  electiveGroups: {
    groupCode: string;
    groupName: string;
    minCredits: string | null;
    minCourses: number | null;
  }[];
  plos: { ploCode: string; description: string }[];
  capturedAt: string;
}

const FONT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/fonts',
);
let fontCss: string | null = null;

// Roboto (OFL) from assets/fonts, embedded as data: URLs so the page loads nothing from the network.
function fonts(): string {
  if (fontCss) return fontCss;
  const face = (file: string, range: string) =>
    `@font-face{font-family:'PdfRoboto';font-weight:100 900;src:url(data:font/woff2;base64,${readFileSync(
      path.join(FONT_DIR, file),
    ).toString('base64')}) format('woff2');unicode-range:${range};}`;
  fontCss =
    face(
      'roboto-latin-wght-normal.woff2',
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    ) +
    face(
      'roboto-vietnamese-wght-normal.woff2',
      'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    );
  return fontCss;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]!);

const row = (label: string, value: string | number | null) =>
  `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value ?? 'Chưa có')}</td></tr>`;

// Generic layout (F24-01 A): not the Faculty's official decision template. Every value is escaped text.
export function programPdfHtml(snapshot: ProgramPdfSnapshot): string {
  const semesters = snapshot.semesters
    .map(
      (semester) => `
    <h3>Học kỳ ${semester.semester} <span class="muted">· ${escapeHtml(semester.credits)} tín chỉ</span></h3>
    <table class="grid">
      <thead><tr><th class="n">STT</th><th>Mã HP</th><th>Tên học phần</th><th class="n">TC</th><th>Loại</th></tr></thead>
      <tbody>${semester.items
        .map(
          (item, index) =>
            `<tr><td class="n">${index + 1}</td><td>${escapeHtml(item.courseCode)}</td><td>${escapeHtml(item.courseName)}</td><td class="n">${escapeHtml(item.credits)}</td><td>${item.elective ? `Tự chọn${item.groupCode ? ` (${escapeHtml(item.groupCode)})` : ''}` : 'Bắt buộc'}</td></tr>`,
        )
        .join('')}</tbody>
    </table>`,
    )
    .join('');
  const groups = snapshot.electiveGroups.length
    ? `<h2>Nhóm học phần tự chọn</h2>
    <table class="grid"><thead><tr><th>Mã nhóm</th><th>Tên nhóm</th><th class="n">Tối thiểu TC</th><th class="n">Tối thiểu số HP</th></tr></thead>
    <tbody>${snapshot.electiveGroups
      .map(
        (group) =>
          `<tr><td>${escapeHtml(group.groupCode)}</td><td>${escapeHtml(group.groupName)}</td><td class="n">${escapeHtml(group.minCredits ?? '—')}</td><td class="n">${escapeHtml(group.minCourses ?? '—')}</td></tr>`,
      )
      .join('')}</tbody></table>`
    : '';
  const plos = snapshot.plos.length
    ? `<h2>Chuẩn đầu ra chương trình (PLO)</h2>
    <table class="grid"><thead><tr><th>Mã</th><th>Mô tả</th></tr></thead>
    <tbody>${snapshot.plos.map((plo) => `<tr><td>${escapeHtml(plo.ploCode)}</td><td>${escapeHtml(plo.description)}</td></tr>`).join('')}</tbody></table>`
    : '';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.programCode)}</title>
<style>
${fonts()}
@page { size: A4; margin: 18mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
html { color-scheme: light; background: #ffffff; }
body { background: #ffffff; font-family: 'PdfRoboto', sans-serif; font-size: 10.5pt; color: #0f172a; line-height: 1.45; }
h1 { font-size: 16pt; margin: 0 0 4pt; color: #005b86; }
h2 { font-size: 12.5pt; margin: 16pt 0 6pt; color: #005b86; break-after: avoid; }
h3 { font-size: 11pt; margin: 12pt 0 4pt; break-after: avoid; }
.muted { color: #64748b; font-weight: 400; }
.note { color: #64748b; font-size: 9pt; margin-bottom: 10pt; }
table { width: 100%; border-collapse: collapse; }
table.info th { text-align: left; width: 34%; font-weight: 500; color: #475569; padding: 3pt 6pt 3pt 0; vertical-align: top; }
table.info td { padding: 3pt 0; }
table.grid { font-size: 9.5pt; }
table.grid thead { display: table-header-group; }
table.grid tr { break-inside: avoid; }
table.grid th { background: #f1f5f9; text-align: left; font-weight: 600; }
table.grid th, table.grid td { border: 0.5pt solid #cbd5e1; padding: 3pt 5pt; }
.n { text-align: right; white-space: nowrap; }
.draft { position: fixed; top: 45%; left: 0; right: 0; text-align: center; transform: rotate(-30deg);
  font-size: 72pt; font-weight: 700; color: rgba(239, 68, 68, 0.16); letter-spacing: 6pt; z-index: 10; }
</style></head><body>
${snapshot.draft ? `<div class="draft">${DRAFT_MARK}</div>` : ''}
<h1>Chương trình đào tạo ${escapeHtml(snapshot.programName)}</h1>
<div class="note">Bản in tổng quát từ hệ thống quản lý CTĐT — không phải biểu mẫu quyết định chính thức.${snapshot.draft ? ` ${DRAFT_MARK}: nội dung chưa ban hành.` : ''}</div>
<h2>Thông tin chung</h2>
<table class="info">
${row('Mã chương trình', snapshot.programCode)}
${row('Ngành', `${snapshot.majorCode} — ${snapshot.majorName}`)}
${row('Trình độ', snapshot.degreeLevel)}
${row('Phiên bản', snapshot.versionNumber ?? DRAFT_MARK)}
${row('Trạng thái', snapshot.statusLabel)}
${row('Số quyết định', snapshot.decisionNumber)}
${row('Ngày ký', snapshot.signedDate)}
${row('Học kỳ hiệu lực', snapshot.effectiveSemester)}
${row('Số học kỳ', snapshot.semesterCount)}
${row('Tổng tín chỉ', `${snapshot.totalCredits} (bắt buộc ${snapshot.compulsoryCredits}, tự chọn ${snapshot.electiveCredits})`)}
</table>
<h2>Khung chương trình theo học kỳ</h2>
${semesters}
${groups}
${plos}
<div class="note" style="margin-top:14pt">Dữ liệu chốt lúc ${escapeHtml(snapshot.capturedAt)}.</div>
</body></html>`;
}
