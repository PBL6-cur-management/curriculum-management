import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// Pushes the planning backlog (docs/planning) to the team's Taiga project.
//   pnpm exec tsx scripts/taiga/push-backlog.ts --dry-run   counts and the assignee table, writes nothing
//   pnpm exec tsx scripts/taiga/push-backlog.ts --apply     creates what is missing
// Every item carries a `ref:<code>` tag; an item whose tag already exists is skipped, so a second run
// creates nothing. Credentials come from TAIGA_USERNAME / TAIGA_PASSWORD (env), falling back to the
// gitignored .mcp.json at the repo root. Nothing secret is printed.

const REPO = new URL('../../../../', import.meta.url);
const PLANNING = new URL('docs/planning/', REPO);
const APPLY = process.argv.includes('--apply');
if (!APPLY && !process.argv.includes('--dry-run'))
  throw new Error('Pass --dry-run or --apply');

// ---------- configuration ----------

const SPRINT_ONE_START = '2026-07-06';
const SPRINT_DAYS = 14;
const SIZE_POINTS = { S: 1, M: 2, L: 4 } as const; // task-breakdown.md K-3
const TAIGA_POINT_STEPS = [1, 2, 3, 5, 8, 10, 13, 20, 40];
const POINTS_ROLE = 'Back';
const REQUEST_GAP_MS = 120;

// Features with code merged on main. Each still has manual test cases outstanding, so its stories are
// "Ready for test" and its tasks are closed.
const BUILT_FEATURES = new Set(Array.from({ length: 19 }, (_, i) => i + 1));
const NEXT_FEATURES = new Set([20, 21, 22]); // planned and scheduled next

// Who does which kind of task. Assignees are spread evenly inside each group.
const ROLE_BY_TASK_TYPE: Record<string, string> = {
  'Dữ liệu': 'Back',
  'Nghiệp vụ': 'Back',
  'Tích hợp': 'Back',
  'Giao diện': 'Product Owner',
  'Kiểm thử': 'Product Owner',
  'Tài liệu': 'Product Owner',
};
const FALLBACK_ROLE = 'Product Owner';

// Work done outside docs/planning, recorded as two extra epics.
interface ExtraEpic {
  code: string;
  name: string;
  stories: { code: string; name: string; done: boolean }[];
}
const EXTRA_EPICS: ExtraEpic[] = [
  {
    code: 'EP-UI',
    name: 'Cải tổ giao diện theo Impeccable',
    stories: [
      {
        code: 'UI-01',
        name: 'Bộ nhận diện chuandaura, DESIGN.md, PRODUCT.md',
        done: true,
      },
      { code: 'UI-02', name: 'Thiết kế lại ma trận quyền', done: true },
      {
        code: 'UI-03',
        name: 'Menu theo tác vụ, lối tắt trang chủ, tải trước khi rê chuột',
        done: true,
      },
      {
        code: 'UI-04',
        name: 'Khối dựng trang dùng chung (BackLink, FilterBar, SummaryStrip, PageSkeleton)',
        done: true,
      },
      { code: 'UI-D', name: 'Cụm D — màn chương trình đào tạo', done: true },
      { code: 'UI-E', name: 'Cụm E — chuẩn đầu ra và đề cương', done: true },
      { code: 'UI-F', name: 'Cụm F — đề xuất và phê duyệt', done: false },
      { code: 'UI-G', name: 'Cụm G — phiên bản và ban hành', done: false },
      { code: 'UI-C', name: 'Cụm C — học phần', done: false },
      {
        code: 'UI-H',
        name: 'Cụm H — sinh viên, nhập liệu, xét tốt nghiệp',
        done: false,
      },
      { code: 'UI-B', name: 'Cụm B — quản trị', done: false },
    ],
  },
  {
    code: 'EP-DATA',
    name: 'Dữ liệu thật DUT',
    stories: [
      {
        code: 'DATA-01',
        name: 'Nạp danh mục, khung chương trình từ dữ liệu Trường',
        done: true,
      },
      {
        code: 'DATA-02',
        name: 'Nạp giảng viên, sinh viên, ghi danh, kết quả học tập',
        done: true,
      },
      {
        code: 'DATA-03',
        name: 'E2E chạy trên dữ liệu thật với thế giới e2e.* tự dọn',
        done: true,
      },
      { code: 'DATA-04', name: 'Đưa backlog lên Taiga', done: false },
    ],
  },
];
const EXTRA_SPRINT = {
  name: 'SP-UI — Giao diện và dữ liệu thật',
  start: '2026-10-26',
  finish: '2026-11-08',
};

// ---------- parsing docs/planning ----------

interface Epic {
  code: string;
  name: string;
  feature: number | null;
}
interface Story {
  code: string;
  name: string;
  epic: string;
  body: string;
}
interface Task {
  code: string;
  text: string;
  type: string;
  deps: string;
  size: keyof typeof SIZE_POINTS;
  story: string;
}

const read = (file: string) =>
  readFileSync(new URL(file, PLANNING), 'utf8').replace(/\r\n/g, '\n');
const cells = (line: string) =>
  line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());

function parseEpics(): Epic[] {
  const seen = new Map<string, Epic>();
  for (const line of read('epics.md').split('\n')) {
    if (!/^\| EP-\d\d \|/.test(line)) continue;
    const [code, name] = cells(line);
    if (!seen.has(code))
      seen.set(code, { code, name, feature: Number(code.slice(3)) });
  }
  return [...seen.values()];
}

function parseStories(): Story[] {
  const text = read('user-stories.md');
  const blocks = text.split(/\n(?=### US-\d{3} — )/).slice(1);
  return blocks.map((block) => {
    const [heading, ...rest] = block.split('\n');
    const match = /^### (US-\d{3}) — (.+)$/.exec(heading);
    const epic = /\*\*Epic:\*\* (EP-\d\d)/.exec(block)?.[1];
    if (!match || !epic) throw new Error(`Unreadable story block: ${heading}`);
    const body = rest.join('\n').split(/\n## /)[0].trim();
    return { code: match[1], name: match[2].trim(), epic, body };
  });
}

function parseTasks(): Task[] {
  const tasks: Task[] = [];
  for (const line of read('task-breakdown.md').split('\n')) {
    if (!/^\| CV-\d{3} \|/.test(line)) continue;
    const parts = cells(line);
    // Read from both ends: a task text may itself contain a pipe.
    const story = parts.at(-1)!;
    const size = parts.at(-2)! as Task['size'];
    const deps = parts.at(-3)!;
    const type = parts.at(-4)!;
    const text = parts.slice(1, -4).join(' | ');
    if (!(size in SIZE_POINTS) || !/^US-\d{3}$/.test(story))
      throw new Error(`Unreadable task row ${parts[0]}`);
    tasks.push({ code: parts[0], text, type, deps, size, story });
  }
  return tasks;
}

function parseSprints(): {
  name: string;
  start: string;
  finish: string;
  stories: string[];
}[] {
  const sprints: {
    name: string;
    start: string;
    finish: string;
    stories: string[];
  }[] = [];
  for (const line of read('sprint-plan.md').split('\n')) {
    const match = /^\| (SP-\d\d) \|/.exec(line);
    if (!match) continue;
    const parts = cells(line);
    const index = Number(match[1].slice(3)) - 1;
    const start = new Date(`${SPRINT_ONE_START}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + index * SPRINT_DAYS);
    const finish = new Date(start);
    finish.setUTCDate(finish.getUTCDate() + SPRINT_DAYS - 1);
    const stories = [...line.matchAll(/US-\d{3}/g)].map((m) => m[0]);
    if (sprints.some((sprint) => sprint.name.startsWith(match[1]))) continue;
    sprints.push({
      name: `${match[1]} — ${parts[1]} ${parts[2]}`,
      start: start.toISOString().slice(0, 10),
      finish: finish.toISOString().slice(0, 10),
      stories,
    });
  }
  return sprints;
}

// ---------- Taiga client ----------

function credentials() {
  let env: Record<string, string> = {};
  const file = new URL('.mcp.json', REPO);
  if (existsSync(file))
    env =
      (
        JSON.parse(readFileSync(file, 'utf8')) as {
          mcpServers: { taiga?: { env?: Record<string, string> } };
        }
      ).mcpServers.taiga?.env ?? {};
  const pick = (key: string) => process.env[key] || env[key] || '';
  const value = {
    api:
      pick('TAIGA_API_URL').replace(/\/$/, '') || 'https://api.taiga.io/api/v1',
    username: pick('TAIGA_USERNAME'),
    password: pick('TAIGA_PASSWORD'),
    slug: pick('TAIGA_PROJECT_SLUG'),
  };
  for (const [key, v] of Object.entries(value))
    if (!v || v.startsWith('ĐIỀN'))
      throw new Error(`Taiga ${key} is not set (env or .mcp.json)`);
  return value;
}

const config = credentials();
let token = '';

async function taiga<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await delay(REQUEST_GAP_MS);
    const response = await fetch(`${config.api}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-disable-pagination': 'True',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 5) {
      await delay(2000 * (attempt + 1));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `Taiga ${method} ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`,
      );
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}

interface Named {
  id: number;
  name: string;
}
interface Member {
  user: number;
  full_name_display: string;
  role_name: string;
}
interface Project {
  id: number;
  is_epics_activated: boolean;
  members: Member[];
  roles: (Named & { computable: boolean })[];
  points: (Named & { value: number | null })[];
  us_statuses: Named[];
  task_statuses: Named[];
  epic_statuses: Named[];
}
interface Item {
  id: number;
  tags: [string, string | null][] | string[];
  ref: number;
  version: number;
}

const refOf = (item: Item) =>
  (item.tags as (string | [string, unknown])[])
    .map((tag) => (Array.isArray(tag) ? tag[0] : tag))
    .find((tag) => tag.startsWith('ref:'))
    ?.slice(4)
    .toUpperCase();

// ---------- planning the push ----------

const epics = parseEpics();
const stories = parseStories();
const tasks = parseTasks();
const sprints = parseSprints();
const featureOf = (epicCode: string) =>
  epics.find((epic) => epic.code === epicCode)?.feature ?? null;

const pointsByStory = new Map<string, number>();
for (const task of tasks)
  pointsByStory.set(
    task.story,
    (pointsByStory.get(task.story) ?? 0) + SIZE_POINTS[task.size],
  );
const taigaPoints = (sum: number) =>
  TAIGA_POINT_STEPS.find((step) => step >= sum) ?? TAIGA_POINT_STEPS.at(-1)!;

const storyStatus = (epicCode: string) => {
  const feature = featureOf(epicCode);
  if (feature && BUILT_FEATURES.has(feature)) return 'Ready for test';
  if (feature && NEXT_FEATURES.has(feature)) return 'Ready';
  return 'New';
};
const taskStatus = (story: Story | undefined) =>
  story && storyStatus(story.epic) === 'Ready for test' ? 'Closed' : 'New';

token = (
  await taiga<{ auth_token: string }>('POST', '/auth', {
    type: 'normal',
    username: config.username,
    password: config.password,
  })
).auth_token;
const project = await taiga<Project>(
  'GET',
  `/projects/by_slug?slug=${encodeURIComponent(config.slug)}`,
);

// Even spread of tasks over the members holding each role, in task order.
const membersByRole = new Map<string, Member[]>();
for (const member of project.members)
  membersByRole.set(member.role_name, [
    ...(membersByRole.get(member.role_name) ?? []),
    member,
  ]);
const turn = new Map<string, number>();
const assigneeFor = (type: string): Member | null => {
  const role = membersByRole.has(ROLE_BY_TASK_TYPE[type] ?? '')
    ? ROLE_BY_TASK_TYPE[type]
    : FALLBACK_ROLE;
  const pool = membersByRole.get(role) ?? project.members;
  if (!pool.length) return null;
  const n = turn.get(role) ?? 0;
  turn.set(role, n + 1);
  return pool[n % pool.length];
};
const taskAssignee = new Map(
  tasks.map((task) => [task.code, assigneeFor(task.type)]),
);
// A story belongs to whoever holds most of its points.
const storyAssignee = new Map<string, Member | null>();
for (const story of stories) {
  const load = new Map<number, { member: Member; points: number }>();
  for (const task of tasks.filter((t) => t.story === story.code)) {
    const member = taskAssignee.get(task.code);
    if (!member) continue;
    const entry = load.get(member.user) ?? { member, points: 0 };
    entry.points += SIZE_POINTS[task.size];
    load.set(member.user, entry);
  }
  storyAssignee.set(
    story.code,
    [...load.values()].sort((a, b) => b.points - a.points)[0]?.member ?? null,
  );
}

const [existingEpics, existingStories, existingTasks, existingSprints] =
  await Promise.all([
    project.is_epics_activated
      ? taiga<Item[]>('GET', `/epics?project=${project.id}`)
      : Promise.resolve([] as Item[]),
    taiga<Item[]>('GET', `/userstories?project=${project.id}`),
    taiga<Item[]>('GET', `/tasks?project=${project.id}`),
    taiga<(Named & { id: number })[]>(
      'GET',
      `/milestones?project=${project.id}`,
    ),
  ]);
const have = (items: Item[]) =>
  new Map(
    items.map((item) => [refOf(item), item] as const).filter(([ref]) => ref),
  );
const epicIds = have(existingEpics);
const storyIds = have(existingStories);
const taskIds = have(existingTasks);
const sprintIds = new Map(
  existingSprints.map((sprint) => [sprint.name.split(' ')[0], sprint.id]),
);

const extraStoryCount = EXTRA_EPICS.reduce(
  (n, epic) => n + epic.stories.length,
  0,
);
const missing = {
  epics:
    epics.filter((e) => !epicIds.has(e.code)).length +
    EXTRA_EPICS.filter((e) => !epicIds.has(e.code)).length,
  stories:
    stories.filter((s) => !storyIds.has(s.code)).length +
    EXTRA_EPICS.flatMap((e) => e.stories).filter((s) => !storyIds.has(s.code))
      .length,
  tasks: tasks.filter((t) => !taskIds.has(t.code)).length,
  sprints: [...sprints.map((s) => s.name.split(' ')[0]), 'SP-UI'].filter(
    (code) => !sprintIds.has(code),
  ).length,
};

console.log(
  `Project ${project.id}; epics module ${project.is_epics_activated ? 'on' : 'off (turned on by --apply)'}`,
);
console.log(
  `Parsed: ${epics.length}+${EXTRA_EPICS.length} epics, ${stories.length}+${extraStoryCount} stories, ${tasks.length} tasks, ${sprints.length}+1 sprints`,
);
console.log(
  `To create: ${missing.epics} epics, ${missing.stories} stories, ${missing.tasks} tasks, ${missing.sprints} sprints`,
);
const statusCount = (values: string[]) =>
  Object.entries(
    values.reduce<Record<string, number>>(
      (acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }),
      {},
    ),
  )
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
console.log(
  `Story status: ${statusCount(stories.map((s) => storyStatus(s.epic)))}`,
);
console.log(
  `Task status: ${statusCount(tasks.map((t) => taskStatus(stories.find((s) => s.code === t.story))))}`,
);
console.log('\nAssignees (tasks by type, points = sum of S1/M2/L4):');
const table = new Map<string, Record<string, number>>();
for (const task of tasks) {
  const name = taskAssignee.get(task.code)?.full_name_display ?? '(none)';
  const row = table.get(name) ?? {};
  row[task.type] = (row[task.type] ?? 0) + 1;
  row.points = (row.points ?? 0) + SIZE_POINTS[task.size];
  table.set(name, row);
}
const types = [
  'Dữ liệu',
  'Nghiệp vụ',
  'Tích hợp',
  'Giao diện',
  'Kiểm thử',
  'Tài liệu',
];
console.log(
  `| Thành viên | Vai trò Taiga | ${types.join(' | ')} | Tổng việc | Điểm | Story |`,
);
console.log(`|---|---|${types.map(() => '---').join('|')}|---|---|---|`);
for (const [name, row] of table) {
  const member = project.members.find((m) => m.full_name_display === name);
  const total = types.reduce((n, t) => n + (row[t] ?? 0), 0);
  const ownStories = [...storyAssignee.values()].filter(
    (m) => m?.full_name_display === name,
  ).length;
  console.log(
    `| ${name} | ${member?.role_name ?? ''} | ${types.map((t) => row[t] ?? 0).join(' | ')} | ${total} | ${row.points} | ${ownStories} |`,
  );
}
console.log('\nSprints:');
for (const sprint of sprints)
  console.log(
    `  ${sprint.name}: ${sprint.start} → ${sprint.finish}, ${sprint.stories.length} stories`,
  );
console.log(
  `  ${EXTRA_SPRINT.name}: ${EXTRA_SPRINT.start} → ${EXTRA_SPRINT.finish}, ${extraStoryCount} stories`,
);

if (!APPLY) {
  console.log(
    '\nDry run: nothing written. Run with --apply after the table above is approved.',
  );
  process.exit(0);
}

// ---------- apply ----------

const statusId = (list: Named[], name: string) => {
  const found = list.find((s) => s.name === name);
  if (!found) throw new Error(`Taiga status "${name}" is missing`);
  return found.id;
};
const pointsRole = project.roles.find(
  (role) => role.name === POINTS_ROLE && role.computable,
);
const pointId = (value: number) =>
  project.points.find((p) => p.value === value)?.id;

if (!project.is_epics_activated) {
  const full = await taiga<{ version: number }>(
    'GET',
    `/projects/${project.id}`,
  );
  await taiga('PATCH', `/projects/${project.id}`, {
    is_epics_activated: true,
    version: full.version,
  });
}

for (const sprint of [
  ...sprints,
  { ...EXTRA_SPRINT, stories: [] as string[] },
]) {
  const code = sprint.name.split(' ')[0];
  if (sprintIds.has(code)) continue;
  const created = await taiga<{ id: number }>('POST', '/milestones', {
    project: project.id,
    name: sprint.name,
    estimated_start: sprint.start,
    estimated_finish: sprint.finish,
  });
  sprintIds.set(code, created.id);
}
const sprintOfStory = new Map<string, number>();
for (const sprint of sprints)
  for (const story of sprint.stories)
    sprintOfStory.set(story, sprintIds.get(sprint.name.split(' ')[0])!);

let created = 0;
const epicStatusName = (feature: number | null, done?: boolean) =>
  done === true || (feature && BUILT_FEATURES.has(feature))
    ? 'Ready for test'
    : feature && NEXT_FEATURES.has(feature)
      ? 'Ready'
      : 'New';
for (const epic of [
  ...epics,
  ...EXTRA_EPICS.map((e) => ({ code: e.code, name: e.name, feature: null })),
]) {
  if (epicIds.has(epic.code)) continue;
  const extra = EXTRA_EPICS.find((e) => e.code === epic.code);
  const item = await taiga<Item>('POST', '/epics', {
    project: project.id,
    subject: `${epic.code} — ${epic.name}`,
    description: extra
      ? 'Việc ngoài docs/planning, ghi lại để theo dõi.'
      : `Nguồn: docs/planning/epics.md (${epic.code}).`,
    status: statusId(
      project.epic_statuses,
      extra ? 'In progress' : epicStatusName(epic.feature),
    ),
    tags: [`ref:${epic.code}`],
  });
  epicIds.set(epic.code, item);
  created++;
}

async function createStory(input: {
  code: string;
  subject: string;
  description: string;
  status: string;
  epic: string;
  points?: number;
  milestone?: number;
  assignee?: Member | null;
}) {
  if (storyIds.has(input.code)) return;
  const point = input.points ? pointId(taigaPoints(input.points)) : undefined;
  const item = await taiga<Item>('POST', '/userstories', {
    project: project.id,
    subject: `${input.code} — ${input.subject}`,
    description: input.description,
    status: statusId(project.us_statuses, input.status),
    tags: [`ref:${input.code}`],
    milestone: input.milestone ?? null,
    assigned_to: input.assignee?.user ?? null,
    ...(pointsRole && point ? { points: { [pointsRole.id]: point } } : {}),
  });
  storyIds.set(input.code, item);
  const epic = epicIds.get(input.epic);
  if (epic)
    await taiga('POST', `/epics/${epic.id}/related_userstories`, {
      epic: epic.id,
      user_story: item.id,
    });
  created++;
}

for (const story of stories)
  await createStory({
    code: story.code,
    subject: story.name,
    description: `${story.body}\n\n_Nguồn: docs/planning/user-stories.md (${story.code})._`,
    status: storyStatus(story.epic),
    epic: story.epic,
    points: pointsByStory.get(story.code),
    milestone: sprintOfStory.get(story.code),
    assignee: storyAssignee.get(story.code),
  });
for (const epic of EXTRA_EPICS)
  for (const story of epic.stories)
    await createStory({
      code: story.code,
      subject: story.name,
      description:
        'Xem docs/progress/progress_log.md và docs/implement-report/.',
      status: story.done ? 'Done' : 'In progress',
      epic: epic.code,
      milestone: sprintIds.get('SP-UI'),
    });

for (const task of tasks) {
  if (taskIds.has(task.code)) continue;
  const story = stories.find((s) => s.code === task.story);
  const storyItem = storyIds.get(task.story);
  await taiga('POST', '/tasks', {
    project: project.id,
    subject: `${task.code} — ${task.text.length > 200 ? `${task.text.slice(0, 197)}...` : task.text}`,
    description: `${task.text}\n\n- Loại: ${task.type}\n- Cỡ: ${task.size} (${SIZE_POINTS[task.size]} điểm)\n- Phụ thuộc: ${task.deps}\n\n_Nguồn: docs/planning/task-breakdown.md (${task.code})._`,
    status: statusId(project.task_statuses, taskStatus(story)),
    user_story: storyItem?.id ?? null,
    milestone: sprintOfStory.get(task.story) ?? null,
    assigned_to: taskAssignee.get(task.code)?.user ?? null,
    tags: [`ref:${task.code}`, task.type],
  });
  created++;
}
console.log(`\nApplied: ${created} items created.`);
