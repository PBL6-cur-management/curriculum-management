import { readFileSync } from 'node:fs';
import { createClient, type Named, REPO, refOf } from './taiga-client.js';

// Re-plans the Taiga backlog on the 15/06/2026 → 15/12/2026 timeline: 13 two-week sprints, each epic owned
// by one member (the story and its four phase tasks), statuses as of TODAY.
//   pnpm exec tsx scripts/taiga/reschedule-backlog.ts --dry-run   prints the plan and the diff, writes nothing
//   pnpm exec tsx scripts/taiga/reschedule-backlog.ts --apply     PATCHes only what differs; re-run → 0 changes
// Items are matched by their `ref:<code>` tag (see push-backlog.ts). Sprints are matched by their SP code;
// sprints outside the plan are emptied first and then deleted.

const APPLY = process.argv.includes('--apply');
if (!APPLY && !process.argv.includes('--dry-run'))
  throw new Error('Pass --dry-run or --apply');

// ---------- the plan ----------

const TODAY = '2026-10-31';
type Member = 'hieu' | 'kien' | 'tien';
const USERNAMES: Record<Member, string> = {
  hieu: 'ens-hieu-nguyen',
  kien: '4ut15t1ck',
  tien: 'vantien8105',
};

interface SprintPlan {
  code: string;
  title: string;
  start: string;
  finish: string;
  epics: number[];
}
// SP-13 runs one extra day so the project ends on 15/12.
const SPRINTS: SprintPlan[] = [
  {
    code: 'SP-01',
    title: 'Nền tảng, tài khoản và quyền',
    start: '2026-06-15',
    finish: '2026-06-28',
    epics: [1, 2],
  },
  {
    code: 'SP-02',
    title: 'Tổ chức, học phần và quan hệ học phần',
    start: '2026-06-29',
    finish: '2026-07-12',
    epics: [3, 4, 5],
  },
  {
    code: 'SP-03',
    title: 'Chương trình đào tạo và khung chương trình',
    start: '2026-07-13',
    finish: '2026-07-26',
    epics: [6, 7],
  },
  {
    code: 'SP-04',
    title: 'Kiểm tra nhất quán, nhập xuất Excel',
    start: '2026-07-27',
    finish: '2026-08-09',
    epics: [8, 9],
  },
  {
    code: 'SP-05',
    title: 'Đề cương, chuẩn đầu ra, công thức điểm',
    start: '2026-08-10',
    finish: '2026-08-23',
    epics: [10, 11, 12],
  },
  {
    code: 'SP-06',
    title: 'Đề xuất thay đổi và phê duyệt ba cấp',
    start: '2026-08-24',
    finish: '2026-09-06',
    epics: [13, 14],
  },
  {
    code: 'SP-07',
    title: 'Ban hành, so sánh phiên bản, gán khóa',
    start: '2026-09-07',
    finish: '2026-09-20',
    epics: [15, 16],
  },
  {
    code: 'SP-08',
    title: 'Sinh viên, điều kiện đăng ký, xét tốt nghiệp',
    start: '2026-09-21',
    finish: '2026-10-04',
    epics: [17, 18, 19],
  },
  {
    code: 'SP-09',
    title: 'Cổng sinh viên, API dDUT, đồng bộ DB Trường',
    start: '2026-10-05',
    finish: '2026-10-18',
    epics: [20, 21, 22],
  },
  {
    code: 'SP-10',
    title: 'Báo cáo, xuất bản, tiện ích duyệt, giao diện và dữ liệu thật',
    start: '2026-10-19',
    finish: '2026-11-01',
    epics: [23, 24, 25],
  },
  {
    code: 'SP-11',
    title: 'Rà nghiệp vụ module chính, sao lưu, triển khai',
    start: '2026-11-02',
    finish: '2026-11-15',
    epics: [],
  },
  {
    code: 'SP-12',
    title: 'Kiểm thử theo vai trò và nghiệm thu từng bậc',
    start: '2026-11-16',
    finish: '2026-11-29',
    epics: [],
  },
  {
    code: 'SP-13',
    title: 'Ca thủ công, nghiệm thu Khoa, bàn giao',
    start: '2026-11-30',
    finish: '2026-12-15',
    epics: [],
  },
];

// Owner per epic, by area: Tien backend/infrastructure/integration; Hieu programs, courses and approval;
// Kien outcomes, syllabus, students and reports. Tuned so each member's points per sprint stay close.
const EPIC_OWNER: Record<number, Member> = {
  1: 'tien',
  2: 'kien',
  3: 'kien',
  4: 'hieu',
  5: 'tien',
  6: 'hieu',
  7: 'kien',
  8: 'hieu',
  9: 'tien',
  10: 'kien',
  11: 'hieu',
  12: 'kien',
  13: 'hieu',
  14: 'tien',
  15: 'tien',
  16: 'kien',
  17: 'tien',
  18: 'kien',
  19: 'hieu',
  20: 'kien',
  21: 'tien',
  22: 'kien',
  23: 'kien',
  24: 'hieu',
  25: 'tien',
};

// Storyless tasks: sprint, owner, status, and (for new ones) subject.
interface StorylessPlan {
  sprint: string;
  owner: Member;
  status: string;
  subject?: string;
}
const STORYLESS: Record<string, StorylessPlan> = {
  'CV-004': { sprint: 'SP-01', owner: 'tien', status: 'Closed' },
  'CV-053': { sprint: 'SP-12', owner: 'tien', status: 'New' },
  'CV-098': { sprint: 'SP-12', owner: 'hieu', status: 'New' },
  'CV-135': { sprint: 'SP-12', owner: 'kien', status: 'New' },
  'CV-200': { sprint: 'SP-12', owner: 'hieu', status: 'New' },
  'CV-245': { sprint: 'SP-13', owner: 'kien', status: 'New' },
  'CV-277': { sprint: 'SP-13', owner: 'tien', status: 'New' },
  'CV-187': { sprint: 'SP-11', owner: 'tien', status: 'New' },
  'CV-249': { sprint: 'SP-11', owner: 'tien', status: 'New' },
  'CV-250': { sprint: 'SP-11', owner: 'kien', status: 'New' },
  'UI-01': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'UI-02': { sprint: 'SP-10', owner: 'hieu', status: 'Closed' },
  'UI-03': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'UI-04': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'UI-D': { sprint: 'SP-10', owner: 'hieu', status: 'Closed' },
  'UI-E': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'UI-F': { sprint: 'SP-10', owner: 'hieu', status: 'Closed' },
  'UI-G': { sprint: 'SP-10', owner: 'tien', status: 'Closed' },
  'UI-C': { sprint: 'SP-10', owner: 'hieu', status: 'Closed' },
  'UI-H': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'UI-B': { sprint: 'SP-10', owner: 'tien', status: 'Closed' },
  'DATA-01': { sprint: 'SP-10', owner: 'tien', status: 'Closed' },
  'DATA-02': { sprint: 'SP-10', owner: 'tien', status: 'Closed' },
  'DATA-03': { sprint: 'SP-10', owner: 'kien', status: 'Closed' },
  'DATA-04': { sprint: 'SP-10', owner: 'hieu', status: 'Closed' },
  'DEV-01': {
    sprint: 'SP-10',
    owner: 'tien',
    status: 'Closed',
    subject:
      'DEV-01 — Dựng hạ tầng bằng Docker một lệnh cho thành viên mới (pnpm dev:setup)',
  },
  'DEV-02': {
    sprint: 'SP-10',
    owner: 'hieu',
    status: 'Closed',
    subject: 'DEV-02 — Dời timeline Taiga 15/06–15/12, phân công theo mảng',
  },
  'REV-01': {
    sprint: 'SP-11',
    owner: 'hieu',
    status: 'In progress',
    subject:
      'REV-01 — Rà nghiệp vụ theo SRS: chương trình đào tạo và khung chương trình',
  },
  'REV-02': {
    sprint: 'SP-11',
    owner: 'kien',
    status: 'In progress',
    subject: 'REV-02 — Rà nghiệp vụ theo SRS: học phần, đề cương, chuẩn đầu ra',
  },
  'REV-03': {
    sprint: 'SP-11',
    owner: 'hieu',
    status: 'In progress',
    subject:
      'REV-03 — Rà nghiệp vụ theo SRS: đề xuất, hồ sơ căn cứ, duyệt ba cấp, ban hành',
  },
  'F26-01': {
    sprint: 'SP-11',
    owner: 'tien',
    status: 'New',
    subject: 'F26-01 — Sao lưu hằng ngày và diễn tập phục hồi (F-26)',
  },
  'F27-01': {
    sprint: 'SP-11',
    owner: 'tien',
    status: 'New',
    subject:
      'F27-01 — Triển khai Docker Compose + Caddy, thử tải, theo dõi (F-27)',
  },
  'E2E-01': {
    sprint: 'SP-12',
    owner: 'kien',
    status: 'New',
    subject:
      'E2E-01 — Đi luồng theo vai trò R1..R6: CTĐT, học phần, duyệt ba cấp',
  },
  'E2E-02': {
    sprint: 'SP-12',
    owner: 'tien',
    status: 'New',
    subject:
      'E2E-02 — Kích hoạt phiên bản PENDING→ACTIVE bằng worker thật, ủy quyền và nhắc hạn',
  },
  'MAN-01': {
    sprint: 'SP-13',
    owner: 'hieu',
    status: 'New',
    subject: 'MAN-01 — Chạy ca kiểm thử thủ công còn nợ, ghi kết quả',
  },
  'ACC-01': {
    sprint: 'SP-13',
    owner: 'kien',
    status: 'New',
    subject: 'ACC-01 — Nghiệm thu với Khoa, chốt đầu vào C1..C10',
  },
  'HND-01': {
    sprint: 'SP-13',
    owner: 'tien',
    status: 'New',
    subject: 'HND-01 — Đồng bộ tài liệu, bàn giao, hướng dẫn vận hành',
  },
};
const STORYLESS_DESCRIPTION =
  'Việc kỹ thuật ngoài user story. Xem docs/progress/progress_log.md và docs/implement-report/.';

// Every epic on the plan has code merged on main; manual test cases are still outstanding, so stories are
// "Ready for test", analysis/design/development tasks closed and the self-test task in progress.
const STORY_STATUS = 'Ready for test';
const PHASE_STATUS: Record<string, string> = {
  AR: 'Closed',
  SD: 'Closed',
  DEV: 'Closed',
  ST: 'In progress',
};

// ---------- docs/planning: story → epic ----------

const userStories = readFileSync(
  new URL('docs/planning/user-stories.md', REPO),
  'utf8',
).replace(/\r\n/g, '\n');
const epicOfStory = new Map<string, number>();
for (const block of userStories.split(/\n(?=### US-\d{3} — )/).slice(1)) {
  const code = /^### (US-\d{3})/.exec(block)?.[1];
  const epic = /\*\*Epic:\*\* EP-(\d\d)/.exec(block)?.[1];
  if (code && epic) epicOfStory.set(code, Number(epic));
}
const sprintOfEpic = new Map<number, string>();
for (const sprint of SPRINTS)
  for (const epic of sprint.epics) sprintOfEpic.set(epic, sprint.code);
for (let epic = 1; epic <= 25; epic++)
  if (!sprintOfEpic.has(epic) || !EPIC_OWNER[epic])
    throw new Error(`EP-${epic} has no sprint or owner`);

// ---------- Taiga state ----------

const { taiga, login } = createClient();
await login();

interface Project {
  id: number;
  members: { id: number; username: string; full_name_display: string }[];
  us_statuses: Named[];
  task_statuses: Named[];
}
interface Milestone extends Named {
  estimated_start: string;
  estimated_finish: string;
  closed: boolean;
}
interface Item {
  id: number;
  ref: number;
  version: number;
  subject: string;
  tags: [string, string | null][];
  status: number;
  milestone: number | null;
  assigned_to: number | null;
  user_story?: number | null;
  total_points?: number | null;
}

const project = await taiga<Project>(
  'GET',
  `/projects/by_slug?slug=${encodeURIComponent((await import('./taiga-client.js')).credentials().slug)}`,
);
const memberId = {} as Record<Member, number>;
for (const [member, username] of Object.entries(USERNAMES) as [
  Member,
  string,
][]) {
  const found = project.members.find((m) => m.username === username);
  if (!found) throw new Error(`Member ${username} is not in the project`);
  memberId[member] = found.id;
}
const memberName = new Map(
  project.members.map((m) => [m.id, m.full_name_display]),
);
const statusId = (list: Named[], name: string) => {
  const found = list.find((s) => s.name === name);
  if (!found) throw new Error(`Taiga status "${name}" is missing`);
  return found.id;
};

const [milestones, stories, tasks] = await Promise.all([
  taiga<Milestone[]>('GET', `/milestones?project=${project.id}`),
  taiga<Item[]>('GET', `/userstories?project=${project.id}`),
  taiga<Item[]>('GET', `/tasks?project=${project.id}`),
]);
const codeOf = (name: string) => name.split(' ')[0];

// ---------- diff ----------

interface Change {
  kind: string;
  label: string;
  run: () => Promise<unknown>;
}
const changes: Change[] = [];
const sprintId = new Map<string, number>();

for (const sprint of SPRINTS) {
  const name = `${sprint.code} — ${sprint.title}`;
  const closed = sprint.finish < TODAY;
  const existing = milestones.find((m) => codeOf(m.name) === sprint.code);
  if (existing) {
    sprintId.set(sprint.code, existing.id);
    const patch: Record<string, unknown> = {};
    if (existing.name !== name) patch.name = name;
    if (existing.estimated_start !== sprint.start)
      patch.estimated_start = sprint.start;
    if (existing.estimated_finish !== sprint.finish)
      patch.estimated_finish = sprint.finish;
    if (existing.closed !== closed) patch.closed = closed;
    if (Object.keys(patch).length)
      changes.push({
        kind: 'sprint',
        label: `${sprint.code}: ${Object.keys(patch).join(', ')}`,
        run: () => taiga('PATCH', `/milestones/${existing.id}`, patch),
      });
  } else {
    changes.push({
      kind: 'sprint',
      label: `${sprint.code}: create`,
      run: async () => {
        const made = await taiga<{ id: number }>('POST', '/milestones', {
          project: project.id,
          name,
          estimated_start: sprint.start,
          estimated_finish: sprint.finish,
          closed,
        });
        sprintId.set(sprint.code, made.id);
      },
    });
  }
}
// Sprint ids for new sprints exist only after their create ran, so item patches resolve them lazily.
const sprintFor = (code: string) => {
  const id = sprintId.get(code);
  if (id === undefined) throw new Error(`Sprint ${code} has no id yet`);
  return id;
};
const plannedCodes = new Set(SPRINTS.map((s) => s.code));
const obsolete = milestones.filter((m) => !plannedCodes.has(codeOf(m.name)));

const storyOwner = new Map<number, Member>();
const storySprint = new Map<number, string>();
const load = new Map<string, number>(); // `${sprint}|${member}` → points
for (const story of stories) {
  const code = refOf(story);
  const epic = code ? epicOfStory.get(code) : undefined;
  if (!code || !epic) throw new Error(`Story ${story.subject} has no epic`);
  const owner = EPIC_OWNER[epic];
  const sprint = sprintOfEpic.get(epic)!;
  storyOwner.set(story.id, owner);
  storySprint.set(story.id, sprint);
  const key = `${sprint}|${owner}`;
  load.set(key, (load.get(key) ?? 0) + (story.total_points ?? 0));
  const status = statusId(project.us_statuses, STORY_STATUS);
  const patch: Record<string, unknown> = {};
  if (story.assigned_to !== memberId[owner])
    patch.assigned_to = memberId[owner];
  if (story.status !== status) patch.status = status;
  const currentSprint = milestones.find((m) => m.id === story.milestone);
  if (!currentSprint || codeOf(currentSprint.name) !== sprint)
    patch.milestone = sprint;
  if (Object.keys(patch).length)
    changes.push({
      kind: 'story',
      label: `${code}: ${Object.keys(patch).join(', ')}`,
      run: () =>
        taiga('PATCH', `/userstories/${story.id}`, {
          ...patch,
          ...(patch.milestone ? { milestone: sprintFor(sprint) } : {}),
          version: story.version,
        }),
    });
}

const seenStoryless = new Set<string>();
for (const task of tasks) {
  const code = refOf(task);
  if (!code) continue;
  let owner: Member;
  let sprint: string;
  let status: string;
  if (task.user_story) {
    owner = storyOwner.get(task.user_story)!;
    sprint = storySprint.get(task.user_story)!;
    status = PHASE_STATUS[code.split('-').at(-1)!] ?? 'New';
  } else {
    const plan = STORYLESS[code];
    if (!plan) throw new Error(`Storyless task ${code} is not in the plan`);
    seenStoryless.add(code);
    ({ owner, sprint, status } = plan);
  }
  const statusValue = statusId(project.task_statuses, status);
  const patch: Record<string, unknown> = {};
  if (task.assigned_to !== memberId[owner]) patch.assigned_to = memberId[owner];
  if (task.status !== statusValue) patch.status = statusValue;
  const currentSprint = milestones.find((m) => m.id === task.milestone);
  if (!currentSprint || codeOf(currentSprint.name) !== sprint)
    patch.milestone = sprint;
  if (Object.keys(patch).length)
    changes.push({
      kind: 'task',
      label: `${code}: ${Object.keys(patch).join(', ')}`,
      run: () =>
        taiga('PATCH', `/tasks/${task.id}`, {
          ...patch,
          ...(patch.milestone ? { milestone: sprintFor(sprint) } : {}),
          version: task.version,
        }),
    });
}
for (const [code, plan] of Object.entries(STORYLESS)) {
  if (seenStoryless.has(code)) continue;
  if (!plan.subject) throw new Error(`New task ${code} needs a subject`);
  changes.push({
    kind: 'task',
    label: `${code}: create`,
    run: () =>
      taiga('POST', '/tasks', {
        project: project.id,
        subject: plan.subject,
        description: STORYLESS_DESCRIPTION,
        status: statusId(project.task_statuses, plan.status),
        milestone: sprintFor(plan.sprint),
        assigned_to: memberId[plan.owner],
        tags: [`ref:${code}`, 'Dev'],
      }),
  });
}
for (const sprint of obsolete)
  changes.push({
    kind: 'sprint',
    label: `${codeOf(sprint.name)}: delete (emptied above)`,
    run: () => taiga('DELETE', `/milestones/${sprint.id}`),
  });

// ---------- report ----------

console.log(`Project ${project.id}; today ${TODAY}`);
console.log('\nSprints:');
for (const sprint of SPRINTS)
  console.log(
    `  ${sprint.code} ${sprint.start} → ${sprint.finish}${sprint.finish < TODAY ? ' (closed)' : ''} — ${sprint.title}`,
  );
console.log('\nStory points per sprint and member:');
const members = Object.keys(USERNAMES) as Member[];
console.log(
  `| Sprint | ${members.map((m) => memberName.get(memberId[m])).join(' | ')} |`,
);
console.log(`|---|${members.map(() => '---').join('|')}|`);
for (const sprint of SPRINTS.filter((s) => s.epics.length))
  console.log(
    `| ${sprint.code} | ${members.map((m) => load.get(`${sprint.code}|${m}`) ?? 0).join(' | ')} |`,
  );
const totals = members.map((m) =>
  [...load.entries()]
    .filter(([key]) => key.endsWith(`|${m}`))
    .reduce((sum, [, v]) => sum + v, 0),
);
console.log(`| Tổng | ${totals.join(' | ')} |`);
const kinds = ['sprint', 'story', 'task'];
console.log(
  `\nChanges: ${kinds.map((k) => `${k} ${changes.filter((c) => c.kind === k).length}`).join(', ')}`,
);
for (const change of changes.filter((c) => c.kind === 'sprint'))
  console.log(`  ${change.label}`);

if (!APPLY) {
  console.log('\nDry run: nothing written.');
  process.exit(0);
}

// Sprints first (new ids), then items, then deleting the emptied sprints.
const order = (c: Change) =>
  c.kind === 'sprint' && c.label.includes('delete')
    ? 2
    : c.kind === 'sprint'
      ? 0
      : 1;
let done = 0;
for (const change of [...changes].sort((a, b) => order(a) - order(b))) {
  await change.run();
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${changes.length}`);
}
console.log(`\nApplied: ${done} changes.`);
