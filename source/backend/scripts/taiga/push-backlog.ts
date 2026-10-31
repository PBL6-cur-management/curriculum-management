import { readFileSync } from 'node:fs';
import { createClient, type Named, REPO, refOf } from './taiga-client.js';

// Pushes the planning backlog (docs/planning) to the team's Taiga project.
//   pnpm exec tsx scripts/taiga/push-backlog.ts --dry-run   counts and the assignee table, writes nothing
//   pnpm exec tsx scripts/taiga/push-backlog.ts --apply     creates what is missing
// Epics and user stories come from docs/planning as written. Each story gets four phase tasks (PHASES);
// developer work that is not a business story becomes a storyless task. Every item carries a
// `ref:<code>` tag; an item whose tag already exists is skipped, so a second run creates nothing.
// Credentials come from TAIGA_USERNAME / TAIGA_PASSWORD (env), falling back to the gitignored
// .mcp.json at the repo root. Nothing secret is printed.

const PLANNING = new URL('docs/planning/', REPO);
const APPLY = process.argv.includes('--apply');
if (!APPLY && !process.argv.includes('--dry-run'))
  throw new Error('Pass --dry-run or --apply');

// ---------- configuration ----------

const SPRINT_ONE_START = '2026-07-06';
const SPRINT_DAYS = 14;
const SIZE_POINTS = { S: 1, M: 2, L: 4 } as const; // task-breakdown.md K-3
const TAIGA_POINT_STEPS = [1, 2, 3, 5, 8, 10, 13, 20, 40];
const POINTS_ROLE = 'Back'; // the role whose estimate Taiga sums

// Features with code merged on main. Each still has manual test cases outstanding, so its stories are
// "Ready for test" and all their tasks are closed.
const BUILT_FEATURES = new Set(Array.from({ length: 19 }, (_, i) => i + 1));
// Planned in docs/implementation (analysis and design written), build not started.
const NEXT_FEATURES = new Set([20, 21, 22]);

// Every user story is broken into the same four tasks, in this order.
const PHASES = [
  { code: 'AR', name: 'Analyzing requirement' },
  { code: 'SD', name: 'Solution design' },
  { code: 'DEV', name: 'Development' },
  { code: 'ST', name: 'Dev self-test' },
] as const;
type PhaseCode = (typeof PHASES)[number]['code'];
// Task-breakdown rows listed in each phase's description.
const CV_TYPES_BY_PHASE: Record<PhaseCode, string[]> = {
  AR: [],
  SD: ['Tài liệu'],
  DEV: ['Dữ liệu', 'Nghiệp vụ', 'Tích hợp', 'Giao diện'],
  ST: ['Kiểm thử'],
};

// Developer work that is not a business story: storyless tasks in their sprint. The cross-cutting rows of
// task-breakdown.md (scaffold, acceptance runs, backup, deploy, load) join these.
const DEV_TASKS = [
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
  {
    code: 'UI-D',
    name: 'Cải tổ giao diện cụm D — chương trình đào tạo',
    done: true,
  },
  {
    code: 'UI-E',
    name: 'Cải tổ giao diện cụm E — chuẩn đầu ra và đề cương',
    done: true,
  },
  {
    code: 'UI-F',
    name: 'Cải tổ giao diện cụm F — đề xuất và phê duyệt',
    done: false,
  },
  {
    code: 'UI-G',
    name: 'Cải tổ giao diện cụm G — phiên bản và ban hành',
    done: false,
  },
  { code: 'UI-C', name: 'Cải tổ giao diện cụm C — học phần', done: false },
  {
    code: 'UI-H',
    name: 'Cải tổ giao diện cụm H — sinh viên, nhập liệu, xét tốt nghiệp',
    done: false,
  },
  { code: 'UI-B', name: 'Cải tổ giao diện cụm B — quản trị', done: false },
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
];
const DEV_SPRINT = {
  name: 'SP-UI — Giao diện và dữ liệu thật',
  start: '2026-10-26',
  finish: '2026-11-08',
};
// Cross-cutting rows already finished.
const DONE_CROSS_CUTTING = new Set(['CV-004']);

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
  crossCutting: boolean;
}
interface Sprint {
  name: string;
  start: string;
  finish: string;
  stories: string[];
}

const read = (file: string) =>
  readFileSync(new URL(file, PLANNING), 'utf8').replace(/\r\n/g, '\n');
const cells = (line: string) =>
  line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
const codeOf = (name: string) => name.split(' ')[0];

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

// The main table is `| CV | text | type | deps | size | US |`. A later cross-cutting table repeats some
// rows as `| CV | tier | text | size | US |`; those rows are marked, not duplicated.
function parseTasks(): Task[] {
  const tasks = new Map<string, Task>();
  const crossCutting = new Set<string>();
  for (const line of read('task-breakdown.md').split('\n')) {
    if (!/^\| CV-\d{3} \|/.test(line)) continue;
    const parts = cells(line);
    if (/^B\d$/.test(parts[1])) {
      crossCutting.add(parts[0]);
      continue;
    }
    // Read from both ends: a task text may itself contain a pipe.
    const story = parts.at(-1)!;
    const size = parts.at(-2)! as Task['size'];
    const deps = parts.at(-3)!;
    const type = parts.at(-4)!;
    const text = parts.slice(1, -4).join(' | ');
    if (!(size in SIZE_POINTS) || !/^US-\d{3}$/.test(story))
      throw new Error(`Unreadable task row ${parts[0]}`);
    if (!tasks.has(parts[0]))
      tasks.set(parts[0], {
        code: parts[0],
        text,
        type,
        deps,
        size,
        story,
        crossCutting: false,
      });
  }
  for (const code of crossCutting) {
    const task = tasks.get(code);
    if (!task)
      throw new Error(
        `Cross-cutting row ${code} is missing from the main table`,
      );
    task.crossCutting = true;
  }
  return [...tasks.values()];
}

function parseSprints(): Sprint[] {
  const sprints: Sprint[] = [];
  for (const line of read('sprint-plan.md').split('\n')) {
    const match = /^\| (SP-\d\d) \|/.exec(line);
    if (!match) continue;
    if (sprints.some((sprint) => codeOf(sprint.name) === match[1])) continue;
    const parts = cells(line);
    const index = Number(match[1].slice(3)) - 1;
    const start = new Date(`${SPRINT_ONE_START}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + index * SPRINT_DAYS);
    const finish = new Date(start);
    finish.setUTCDate(finish.getUTCDate() + SPRINT_DAYS - 1);
    sprints.push({
      name: `${match[1]} — ${parts[1]} ${parts[2]}`,
      start: start.toISOString().slice(0, 10),
      finish: finish.toISOString().slice(0, 10),
      stories: [...line.matchAll(/US-\d{3}/g)].map((m) => m[0]),
    });
  }
  return sprints;
}

// ---------- Taiga client ----------

const { taiga, login, config } = createClient();

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

// ---------- planning the push ----------

const epics = parseEpics();
const stories = parseStories();
const tasks = parseTasks();
const sprints: Sprint[] = [...parseSprints(), { ...DEV_SPRINT, stories: [] }];
const featureOf = (epicCode: string) =>
  epics.find((epic) => epic.code === epicCode)?.feature ?? null;
const stage = (epicCode: string) => {
  const feature = featureOf(epicCode);
  if (feature && BUILT_FEATURES.has(feature)) return 'built';
  if (feature && NEXT_FEATURES.has(feature)) return 'planned';
  return 'new';
};
const STORY_STATUS = {
  built: 'Ready for test',
  planned: 'In progress',
  new: 'New',
} as const;
const phaseStatus = (story: Story, phase: PhaseCode) => {
  const s = stage(story.epic);
  if (s === 'built') return 'Closed';
  if (s === 'planned' && (phase === 'AR' || phase === 'SD')) return 'Closed';
  return 'New';
};
const storyOf = new Map(stories.map((story) => [story.code, story]));

const pointsByStory = new Map<string, number>();
for (const task of tasks.filter((t) => !t.crossCutting))
  pointsByStory.set(
    task.story,
    (pointsByStory.get(task.story) ?? 0) + SIZE_POINTS[task.size],
  );
const taigaPoints = (sum: number) =>
  TAIGA_POINT_STEPS.find((step) => step >= sum) ?? TAIGA_POINT_STEPS.at(-1)!;

const sprintOfStory = new Map<string, string>();
for (const sprint of sprints)
  for (const story of sprint.stories)
    sprintOfStory.set(story, codeOf(sprint.name));

interface PlannedTask {
  code: string;
  subject: string;
  description: string;
  status: string;
  story: string | null;
  sprint: string | null;
  kind: PhaseCode | 'STORYLESS';
  tags: string[];
}
const cvLine = (task: Task) =>
  `- ${task.code} (${task.type}, cỡ ${task.size}): ${task.text}`;
const PHASE_INTRO: Record<PhaseCode, (code: string) => string> = {
  AR: (code) =>
    `Phân tích yêu cầu và tiêu chí chấp nhận của ${code}; ghi lại câu hỏi mở và quy tắc nghiệp vụ liên quan.`,
  SD: (code) =>
    `Thiết kế giải pháp cho ${code}: dữ liệu, API, màn hình, quyền; cập nhật tài liệu kiến trúc.`,
  DEV: (code) => `Hiện thực ${code} theo thiết kế.`,
  ST: (code) =>
    `Tự kiểm thử ${code}: kiểm thử đơn vị, e2e và ca kiểm thử thủ công theo tiêu chí chấp nhận.`,
};

const planned: PlannedTask[] = [];
for (const story of stories) {
  const own = tasks.filter((t) => t.story === story.code && !t.crossCutting);
  for (const phase of PHASES) {
    const rows = own.filter((t) =>
      CV_TYPES_BY_PHASE[phase.code].includes(t.type),
    );
    planned.push({
      code: `${story.code}-${phase.code}`,
      subject: `${story.code} · ${phase.name}`,
      description: [
        PHASE_INTRO[phase.code](story.code),
        ...(rows.length
          ? [
              '',
              'Việc trong docs/planning/task-breakdown.md:',
              ...rows.map(cvLine),
            ]
          : []),
      ].join('\n'),
      status: phaseStatus(story, phase.code),
      story: story.code,
      sprint: sprintOfStory.get(story.code) ?? null,
      kind: phase.code,
      tags: [phase.name],
    });
  }
}
for (const task of tasks.filter((t) => t.crossCutting)) {
  const story = storyOf.get(task.story);
  planned.push({
    code: task.code,
    subject: `${task.code} — ${task.text.length > 200 ? `${task.text.slice(0, 197)}...` : task.text}`,
    description: `${task.text}\n\n- Cỡ: ${task.size}\n- Gắn với: ${task.story}\n\n_Nguồn: docs/planning/task-breakdown.md (${task.code})._`,
    status: DONE_CROSS_CUTTING.has(task.code)
      ? 'Closed'
      : story && stage(story.epic) === 'built'
        ? 'In progress'
        : 'New',
    story: null,
    sprint: sprintOfStory.get(task.story) ?? null,
    kind: 'STORYLESS',
    tags: ['Dev'],
  });
}
for (const task of DEV_TASKS)
  planned.push({
    code: task.code,
    subject: `${task.code} — ${task.name}`,
    description:
      'Việc kỹ thuật ngoài user story. Xem docs/progress/progress_log.md và docs/implement-report/.',
    status: task.done ? 'Closed' : 'In progress',
    story: null,
    sprint: codeOf(DEV_SPRINT.name),
    kind: 'STORYLESS',
    tags: ['Dev'],
  });

await login();
const project = await taiga<Project>(
  'GET',
  `/projects/by_slug?slug=${encodeURIComponent(config.slug)}`,
);

// Assignees rotate over every member in task order, so counts differ by at most one and each member
// gets every phase. A story belongs to whoever develops it.
const members = [...project.members].sort((a, b) =>
  a.full_name_display.localeCompare(b.full_name_display),
);
if (!members.length) throw new Error('The Taiga project has no members');
const assignee = new Map(
  planned.map((task, i) => [task.code, members[i % members.length]]),
);
const storyAssignee = new Map(
  stories.map((story) => [story.code, assignee.get(`${story.code}-DEV`)!]),
);

const [existingEpics, existingStories, existingTasks, existingSprints] =
  await Promise.all([
    project.is_epics_activated
      ? taiga<Item[]>('GET', `/epics?project=${project.id}`)
      : Promise.resolve([] as Item[]),
    taiga<Item[]>('GET', `/userstories?project=${project.id}`),
    taiga<Item[]>('GET', `/tasks?project=${project.id}`),
    taiga<Named[]>('GET', `/milestones?project=${project.id}`),
  ]);
const have = (items: Item[]) =>
  new Map(
    items.map((item) => [refOf(item), item] as const).filter(([ref]) => ref),
  );
const epicIds = have(existingEpics);
const storyIds = have(existingStories);
const taskIds = have(existingTasks);
const sprintIds = new Map(
  existingSprints.map((sprint) => [codeOf(sprint.name), sprint.id]),
);

const count = (values: string[]) =>
  Object.entries(
    values.reduce<Record<string, number>>(
      (acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }),
      {},
    ),
  )
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
const storyless = planned.filter((t) => t.kind === 'STORYLESS').length;
console.log(
  `Project ${project.id}; epics module ${project.is_epics_activated ? 'on' : 'off (turned on by --apply)'}`,
);
console.log(
  `Plan: ${epics.length} epics, ${stories.length} stories × ${PHASES.length} tasks, ${storyless} storyless tasks, ${sprints.length} sprints`,
);
console.log(
  `To create: ${epics.filter((e) => !epicIds.has(e.code)).length} epics, ${stories.filter((s) => !storyIds.has(s.code)).length} stories, ${planned.filter((t) => !taskIds.has(t.code)).length} tasks, ${sprints.filter((s) => !sprintIds.has(codeOf(s.name))).length} sprints`,
);
console.log(
  `Story status: ${count(stories.map((s) => STORY_STATUS[stage(s.epic)]))}`,
);
console.log(`Task status: ${count(planned.map((t) => t.status))}`);
console.log('\nAssignees (round robin over all members):');
const kinds = [...PHASES.map((p) => p.code), 'STORYLESS'];
console.log(
  `| Thành viên | Vai trò Taiga | ${[...PHASES.map((p) => p.name), 'Storyless'].join(' | ')} | Tổng task | Story |`,
);
console.log(`|---|---|${kinds.map(() => '---').join('|')}|---|---|`);
for (const member of members) {
  const mine = planned.filter((t) => assignee.get(t.code) === member);
  const ownStories = [...storyAssignee.values()].filter(
    (m) => m === member,
  ).length;
  console.log(
    `| ${member.full_name_display} | ${member.role_name} | ${kinds.map((k) => mine.filter((t) => t.kind === k).length).join(' | ')} | ${mine.length} | ${ownStories} |`,
  );
}
console.log('\nSprints:');
for (const sprint of sprints)
  console.log(
    `  ${sprint.name}: ${sprint.start} → ${sprint.finish}, ${planned.filter((t) => t.sprint === codeOf(sprint.name)).length} tasks`,
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

for (const sprint of sprints) {
  const code = codeOf(sprint.name);
  if (sprintIds.has(code)) continue;
  const made = await taiga<{ id: number }>('POST', '/milestones', {
    project: project.id,
    name: sprint.name,
    estimated_start: sprint.start,
    estimated_finish: sprint.finish,
  });
  sprintIds.set(code, made.id);
}
const sprintId = (code: string | null | undefined) =>
  code ? (sprintIds.get(code) ?? null) : null;

let created = 0;
for (const epic of epics) {
  if (epicIds.has(epic.code)) continue;
  const item = await taiga<Item>('POST', '/epics', {
    project: project.id,
    subject: `${epic.code} — ${epic.name}`,
    description: `Nguồn: docs/planning/epics.md (${epic.code}).`,
    status: statusId(project.epic_statuses, STORY_STATUS[stage(epic.code)]),
    tags: [`ref:${epic.code}`],
  });
  epicIds.set(epic.code, item);
  created++;
}

for (const story of stories) {
  if (storyIds.has(story.code)) continue;
  const points = pointsByStory.get(story.code);
  const point = points ? pointId(taigaPoints(points)) : undefined;
  const item = await taiga<Item>('POST', '/userstories', {
    project: project.id,
    subject: `${story.code} — ${story.name}`,
    description: `${story.body}\n\n_Nguồn: docs/planning/user-stories.md (${story.code})._`,
    status: statusId(project.us_statuses, STORY_STATUS[stage(story.epic)]),
    tags: [`ref:${story.code}`],
    milestone: sprintId(sprintOfStory.get(story.code)),
    assigned_to: storyAssignee.get(story.code)?.user ?? null,
    ...(pointsRole && point ? { points: { [pointsRole.id]: point } } : {}),
  });
  storyIds.set(story.code, item);
  const epic = epicIds.get(story.epic);
  if (epic)
    await taiga('POST', `/epics/${epic.id}/related_userstories`, {
      epic: epic.id,
      user_story: item.id,
    });
  created++;
}

for (const task of planned) {
  if (taskIds.has(task.code)) continue;
  await taiga('POST', '/tasks', {
    project: project.id,
    subject: task.subject,
    description: task.description,
    status: statusId(project.task_statuses, task.status),
    user_story: task.story ? (storyIds.get(task.story)?.id ?? null) : null,
    milestone: sprintId(task.sprint),
    assigned_to: assignee.get(task.code)?.user ?? null,
    tags: [`ref:${task.code}`, ...task.tags],
  });
  created++;
}
console.log(`\nApplied: ${created} items created.`);
