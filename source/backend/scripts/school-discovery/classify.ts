// Step 2 of the school DB discovery: classify every catalogued table offline (no server access).
// Reads <MIRROR_ROOT>/catalog/*/*.json, writes <MIRROR_ROOT>/catalog/classified.json.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIRROR_ROOT } from './connection.js';

interface CatalogColumn {
  name: string;
  type: string;
}
interface CatalogObject {
  name: string;
  type: string;
  rows: number | null;
  totalKb: number | null;
  modifyDate: string;
  columns: CatalogColumn[];
  indexes: { isPrimaryKey: boolean; columns: string }[];
}

// Ordered: first match wins. Patterns run against the lower-cased table name.
const DOMAINS: [string, RegExp][] = [
  ['outcome-syllabus', /cdr|chuandaura|plo|clo|decuong|giaotrinh|muctieu/],
  [
    'program-curriculum',
    /nganh|khungct|khungtc|kehoach|chuyennganh|hpthieu|nhomnganh/,
  ],
  ['course', /hocphan|hocphandk|hocphanpt|congthucdiem|hocphangv/],
  [
    'course-section',
    /lophp|lop_hp|coursesection|sinhvien_lophocphan|studentincourse|klgd|baogiang|phanconggv/,
  ],
  ['registration', /dkyhoc|^dk_|dkhp|dangky|ksoat|chuanbidk/],
  [
    'result-progress',
    /diem|hocvu|chungchi|totnghiep|doantotnghiep|soluubang|xettotnghiep|canhbao|klht/,
  ],
  [
    'student',
    /hososv|dssv|nhanthan|sinhvien|^tmlop|lopsinhhoat|lichsinhhoat|renluyen|^rl|bhyt|baohiem|covid|vacxin/,
  ],
  ['lecturer-org', /hosogv|giaovien|donvi|cvht|^gv|nghibu|luong|dangvien/],
  ['exam-room', /thi|phonghoc|giangduong|khaothi|lichtrinh|tkb/],
  [
    'finance',
    /hocphi|thuchi|kh?tc|mgiam|mien|bank|nganhang|thanhtoan|tien|hocbong/,
  ],
  ['survey', /danhgia|kscb|^dg|form|cauhoi|phanhoi|gopy/],
  [
    'portal-system',
    /menu|config|sys|login|his_|notes|news|thongbao|report|images|denghi|vanban|email|page|quyen|nhatky/,
  ],
];

const COPY_PATTERN =
  /(_luu|luu_|_temp|temp\d*$|_tem\d*$|_xoa|xoa$|_old|_bk|_cu$|_ser$|_\d{4,}|\d{6,}|_$|zzz|zzxx|_desk|_phuchoi|_truoc|_bef|_his$|\$$|^a_|^aa$|^table_\d)/i;

const KEYWORDS =
  /cdr|chuandaura|plo|clo|decuong|muctieu|chuyennganh|huong|tuchon|nhomtc|tuongduong|thaythe|songhanh|tienquyet|hoctruoc|quyetdinh|soqd/i;

function fingerprint(columns: CatalogColumn[]): string {
  const signature = columns
    .map((c) => `${c.name.toLowerCase()}:${c.type}`)
    .sort()
    .join(',');
  return createHash('sha1').update(signature).digest('hex').slice(0, 12);
}

function main() {
  const catalogDir = join(MIRROR_ROOT, 'catalog');
  const seen = new Set<string>();
  const tables: Record<string, unknown>[] = [];
  const keywordHits: Record<string, string>[] = [];
  for (const account of readdirSync(catalogDir, { withFileTypes: true })) {
    if (!account.isDirectory()) continue;
    for (const file of readdirSync(join(catalogDir, account.name))) {
      const database = file.replace(/\.json$/, '');
      if (seen.has(database)) continue; // same DB seen by both accounts
      seen.add(database);
      const catalog = JSON.parse(
        readFileSync(join(catalogDir, account.name, file), 'utf8'),
      ) as { objects: CatalogObject[] };
      for (const object of catalog.objects) {
        if (object.type !== 'U' && object.type !== 'V') continue;
        const lower = object.name.toLowerCase();
        const domain =
          DOMAINS.find(([, re]) => re.test(lower))?.[0] ?? 'unknown';
        const pk = object.indexes.find((i) => i.isPrimaryKey)?.columns ?? null;
        tables.push({
          database,
          name: object.name,
          kind: object.type === 'U' ? 'table' : 'view',
          domain,
          isCopy: COPY_PATTERN.test(object.name),
          rows: object.rows,
          mb:
            object.totalKb === null
              ? null
              : Math.round(object.totalKb / 102.4) / 10,
          modifyDate: String(object.modifyDate).slice(0, 10),
          columnCount: object.columns.length,
          primaryKey: pk,
          fingerprint: fingerprint(object.columns),
        });
        if (KEYWORDS.test(object.name))
          keywordHits.push({ database, table: object.name, column: '*' });
        for (const column of object.columns)
          if (KEYWORDS.test(column.name))
            keywordHits.push({
              database,
              table: object.name,
              column: column.name,
            });
      }
    }
  }
  const byFingerprint = new Map<string, string[]>();
  for (const t of tables) {
    const key = t.fingerprint as string;
    byFingerprint.set(key, [
      ...(byFingerprint.get(key) ?? []),
      `${t.database as string}.${t.name as string}`,
    ]);
  }
  const duplicates = [...byFingerprint.values()].filter(
    (list) => list.length > 1,
  );
  writeFileSync(
    join(catalogDir, 'classified.json'),
    JSON.stringify({ tables, duplicates, keywordHits }, null, 2),
  );
  console.log(
    `${tables.length} objects, ${duplicates.length} duplicate groups, ${keywordHits.length} keyword hits`,
  );
}

main();
