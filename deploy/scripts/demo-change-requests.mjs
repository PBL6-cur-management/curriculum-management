// Seeds realistic change requests on the demo through the public API, each step done by the person it belongs to.
// Usage: node deploy/scripts/demo-change-requests.mjs [baseUrl]
//   DEMO_PASSWORD (default "demo") for the demo account; DEMO_STAFF_PASSWORD for the sample coordinators,
//   directors and lecturer made by `pnpm db:demo-org`; DEMO_PROGRAM (default CNTT-KS-CNPM) for curriculum requests.
// Idempotent by title: a scenario whose title already exists is skipped. A failing step is logged and that
// scenario stops where it is; the others still run.
const BASE = (process.argv[2] ?? 'https://ctdt.oguri-lab.io.vn').replace(/\/$/, '');
const PROGRAM = process.env.DEMO_PROGRAM ?? 'CNTT-KS-CNPM';
const HEADERS = { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' };
const DEMO = 'demo';
const STAFF = ['dp.httt', 'dp.khmt', 'dp.mmt', 'dp.ktmt', 'gv.cnpm', 'gd.httt', 'gd.attt', 'gd.khdl', 'gd.ktmt', 'gd.nn', 'gd.cntt'];
const cookies = new Map(); // username → session cookie
const usernameById = new Map();
let actor = DEMO; // whose session `api` uses

async function call(user, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...HEADERS, cookie: cookies.get(user) ?? '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookies.set(user, set.map((c) => c.split(';')[0]).join('; '));
  const text = await res.text();
  if (!res.ok) throw new Error(`${user}: ${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const api = (method, path, body) => call(actor, method, path, body);
const as = async (user, work) => {
  const before = actor;
  actor = user;
  try {
    return await work();
  } finally {
    actor = before;
  }
};

async function signIn(user, password) {
  await call(user, 'POST', '/auth/login', { username: user, password });
  const me = await call(user, 'GET', '/auth/me');
  usernameById.set(me.id, user);
}

const rows = (page) => (Array.isArray(page) ? page : page.items);

async function course(code) {
  const found = rows(await api('GET', `/courses?q=${code}&pageSize=20`)).find((c) => c.courseCode === code);
  if (!found) throw new Error(`course ${code} not found`);
  return found;
}

async function program(code) {
  const found = rows(await api('GET', `/programs?q=${encodeURIComponent(code)}&pageSize=50`)).find(
    (p) => p.programCode === code,
  );
  if (!found) throw new Error(`program ${code} not found`);
  return found;
}

const courseName = (item) => item.course?.courseName ?? item.courseName ?? '';
const open = (body) => api('POST', '/change-requests', { origin: 'FACULTY', ...body });
const submit = (id) => api('POST', `/change-requests/${id}/submit`, {});

const LEVEL_OF = { PENDING_COORDINATOR: 1, PENDING_DIRECTOR: 2, PENDING_ACADEMIC_OFFICE: 3 };

// Every approver still pending at the request's level approves under their own account, except `waitFor`,
// who is left pending (the demo account, so the request waits in its "Chờ tôi duyệt").
async function approveLevel(request, remark, waitFor = []) {
  const level = LEVEL_OF[request.status];
  if (!level || level === 3) return request;
  const detail = await as(DEMO, () => api('GET', `/change-requests/${request.id}`));
  const pending = detail.steps.filter(
    (step) => step.approvalLevel === level && step.action === 'PENDING' && !step.isSkipped && step.approver,
  );
  let current = detail;
  for (const id of new Set(pending.map((step) => step.approver.id))) {
    const user = usernameById.get(id);
    if (!user) throw new Error(`no session for approver ${id}`);
    if (waitFor.includes(user)) continue;
    current = await as(user, () => api('POST', `/change-requests/${request.id}/approve`, { remark }));
  }
  return current;
}

// Approves level after level, one remark per level, until the request reaches `stop`.
async function approveUntil(request, stop, remarks) {
  let current = request;
  for (const remark of remarks) {
    if (current.status === stop) break;
    current = await approveLevel(current, remark);
  }
  return current;
}

async function moveCourse(copyId, pattern, semester) {
  const copy = await api('GET', `/program-versions/${copyId}/curriculum`);
  const item = copy.items.find((row) => pattern.test(courseName(row)));
  if (!item) throw new Error(`${pattern} not in this program`);
  const target = semester(item.plannedSemester);
  await api('PATCH', `/curriculum-items/${item.id}`, { plannedSemester: target });
}

async function nextSemester() {
  const list = rows(await api('GET', '/semesters?pageSize=100'));
  const today = new Date().toISOString().slice(0, 10);
  const future = list
    .filter((s) => s.startDate && s.startDate.slice(0, 10) > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!future.length) throw new Error('no future semester');
  return future[0].id;
}

const SCENARIOS = [
  {
    title: 'Chuyển Toán rời rạc lên học kỳ sớm hơn',
    async run() {
      const p = await program(PROGRAM);
      const r = await open({
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: p.id,
        title: this.title,
        reason:
          'Toán rời rạc cung cấp kiến thức logic, tập hợp, quan hệ và đồ thị cho Cấu trúc dữ liệu và Phân tích thiết kế giải thuật. ' +
          'Buổi rà soát CTĐT của nhóm Khoa học máy tính ngày 12/9/2026 thống nhất học sớm một học kỳ để sinh viên có nền tảng trước các học phần cơ sở ngành.',
      });
      await moveCourse(r.workspace.copyId, /^Toán rời rạc/, (s) => Math.max(1, (s ?? 3) - 1));
      const s = await submit(r.id);
      // The KHMT coordinator agrees; the program director (the demo account) still has to decide.
      return approveUntil(s, 'PENDING_DIRECTOR', [
        'Nhóm Khoa học máy tính đồng ý, Toán rời rạc không có học phần tiên quyết nên học sớm được.',
      ]);
    },
  },
  {
    title: 'Cập nhật tài liệu tham khảo học phần Cấu trúc dữ liệu',
    as: 'dp.khmt',
    async run() {
      const c = await course('1023280');
      const r = await open({
        requestType: 'SYLLABUS_CONTENT',
        targetType: 'COURSE',
        targetId: c.id,
        title: this.title,
        reason:
          'Giáo trình hiện hành xuất bản năm 2008, nhiều ví dụ dùng C cũ. Đề nghị bổ sung bản mới của Cormen và bài giảng của Khoa, ' +
          'chuyển giáo trình cũ sang mục tham khảo thêm.',
      });
      await api('PATCH', `/syllabi/${r.workspace.copyId}`, {
        references:
          '<ol><li>T. H. Cormen, C. E. Leiserson, R. L. Rivest, C. Stein, <em>Introduction to Algorithms</em>, 4th ed., MIT Press, 2022.</li>' +
          '<li>R. Sedgewick, K. Wayne, <em>Algorithms</em>, 4th ed., Addison-Wesley, 2011.</li>' +
          '<li>Khoa Công nghệ Thông tin, <em>Bài giảng Cấu trúc dữ liệu</em>, Trường Đại học Bách khoa – ĐHĐN, 2025.</li></ol>',
      });
      return r; // still a draft: the lecturer is still writing it
    },
  },
  {
    title: 'Bổ sung Cấu trúc dữ liệu làm học phần học trước của Cơ sở dữ liệu',
    as: 'dp.httt',
    async run() {
      const [db, ds] = await Promise.all([course('1023290'), course('1023280')]);
      const r = await open({
        requestType: 'COURSE_RELATION',
        targetType: 'COURSE',
        targetId: db.id,
        title: this.title,
        reason:
          'Nội dung chỉ mục B-tree, băm và tối ưu truy vấn trong Cơ sở dữ liệu cần kiến thức cây và bảng băm của Cấu trúc dữ liệu. ' +
          'Kết quả học tập khóa K23 cho thấy sinh viên chưa học Cấu trúc dữ liệu có tỉ lệ không đạt cao gấp đôi.',
      });
      await api('PUT', `/change-requests/${r.id}/items`, {
        items: [
          { operation: 'ADD_RELATION', sourceCourseId: ds.id, targetCourseId: db.id, relationType: 'PRIOR', minScore: null },
        ],
      });
      const s = await submit(r.id);
      // The author coordinates the HTTT group, so level 1 is skipped; every other director agrees, the CNPM
      // director (the demo account) has not decided yet.
      const atDirectors = await approveUntil(s, 'PENDING_DIRECTOR', [
        'Nhóm học phần đồng ý; ràng buộc phù hợp với thứ tự giảng dạy hiện tại.',
      ]);
      return approveLevel(
        atDirectors,
        'Đồng ý, chương trình của tôi đã xếp Cấu trúc dữ liệu trước Cơ sở dữ liệu.',
        [DEMO],
      );
    },
  },
  {
    title: 'Bổ sung nội dung Git và kiểm thử đơn vị vào Kỹ thuật lập trình',
    as: 'gv.cnpm',
    async run() {
      const c = await course('1022863');
      const r = await open({
        requestType: 'SYLLABUS_CONTENT',
        targetType: 'COURSE',
        targetId: c.id,
        title: this.title,
        reason:
          'Doanh nghiệp đối tác (khảo sát tháng 6/2026) phản hồi sinh viên năm 3 chưa quen quản lý mã nguồn và viết kiểm thử. ' +
          'Đề nghị đưa Git cơ bản và kiểm thử đơn vị vào hai tuần cuối, không thay đổi số tín chỉ.',
      });
      await api('PATCH', `/syllabi/${r.workspace.copyId}`, {
        objectives:
          '<p>Sau khi hoàn thành học phần, sinh viên có khả năng:</p><ul>' +
          '<li>Phân tích bài toán và thiết kế chương trình theo hướng mô-đun.</li>' +
          '<li>Cài đặt chương trình C/C++ đúng chuẩn, dễ đọc, có xử lý lỗi.</li>' +
          '<li>Quản lý mã nguồn bằng Git (commit, nhánh, hợp nhất) khi làm bài tập nhóm.</li>' +
          '<li>Viết kiểm thử đơn vị cho các hàm đã cài đặt.</li></ul>',
      });
      const s = await submit(r.id);
      return approveUntil(s, 'PENDING_ACADEMIC_OFFICE', [
        'Nhóm học phần thống nhất, nội dung phù hợp thời lượng.',
        'Đồng ý, đề nghị Phòng Đào tạo ban hành từ học kỳ 1 năm học 2027–2028.',
      ]);
    },
  },
  {
    title: 'Viết lại mục tiêu học phần Lập trình hướng đối tượng theo chuẩn đầu ra mới',
    as: 'gv.cnpm',
    async run() {
      const c = await course('1023693');
      const r = await open({
        requestType: 'SYLLABUS_CONTENT',
        targetType: 'COURSE',
        targetId: c.id,
        title: this.title,
        reason:
          'CTĐT 2026 điều chỉnh PLO về thiết kế phần mềm. Mục tiêu học phần cần nêu rõ khả năng thiết kế lớp theo nguyên lý SOLID ' +
          'và áp dụng mẫu thiết kế cơ bản để ma trận CLO–PLO phản ánh đúng.',
      });
      await api('PATCH', `/syllabi/${r.workspace.copyId}`, {
        objectives:
          '<p>Sau khi hoàn thành học phần, sinh viên có khả năng:</p><ul>' +
          '<li>Giải thích các khái niệm đóng gói, kế thừa, đa hình và trừu tượng.</li>' +
          '<li>Thiết kế sơ đồ lớp cho bài toán vừa và nhỏ theo nguyên lý SOLID.</li>' +
          '<li>Áp dụng các mẫu thiết kế Factory, Strategy, Observer trong bài tập lớn.</li></ul>',
      });
      return submit(r.id); // the next approval level decides
    },
  },
  {
    title: 'Chuẩn hóa tên tiếng Anh học phần Nhập môn ngành',
    as: 'gv.cnpm',
    async run() {
      const c = await course('1022940');
      const r = await open({
        requestType: 'COURSE_RELATION',
        targetType: 'COURSE',
        targetId: c.id,
        title: this.title,
        reason:
          'Tên tiếng Anh trên bảng điểm không thống nhất giữa các khóa. Đề nghị dùng "Introduction to Information Technology" ' +
          'theo danh mục học phần song ngữ của Trường.',
      });
      await api('PUT', `/change-requests/${r.id}/items`, {
        items: [
          { operation: 'SET_COURSE_FIELD', field: 'englishName', value: 'Introduction to Information Technology' },
        ],
      });
      const s = await submit(r.id);
      const atOffice = await approveUntil(s, 'PENDING_ACADEMIC_OFFICE', [
        'Nhóm học phần đồng ý.',
        'Đồng ý chuẩn hóa tên tiếng Anh.',
      ]);
      if (atOffice.status !== 'PENDING_ACADEMIC_OFFICE') return atOffice;
      return as(DEMO, async () => api('POST', `/change-requests/${atOffice.id}/final-approve`, {
        decisionNumber: '1520/QĐ-ĐHBK',
        signedDate: '2026-10-28',
        effectiveSemesterId: await nextSemester(),
        remark: 'Phòng Đào tạo phê duyệt, áp dụng từ học kỳ kế tiếp.',
      }));
    },
  },
  {
    title: 'Đổi tên chương trình sang "Kỹ thuật phần mềm"',
    async run() {
      const p = await program(PROGRAM);
      const r = await open({
        requestType: 'PROGRAM_INFO',
        targetType: 'PROGRAM',
        targetId: p.id,
        title: this.title,
        reason: 'Đề nghị đổi tên chương trình cho phù hợp xu hướng tuyển sinh của các trường trong khu vực.',
      });
      await api('PATCH', `/program-versions/${r.workspace.copyId}/info`, { programName: 'Kỹ thuật phần mềm' });
      const s = await submit(r.id);
      const atOffice = await approveUntil(s, 'PENDING_ACADEMIC_OFFICE', [
        'Chuyển cấp trên xem xét.',
        'Chuyển Phòng Đào tạo xem xét.',
      ]);
      return api('POST', `/change-requests/${atOffice.id}/reject`, {
        remark:
          'Tên chương trình phải giữ đúng quyết định mở ngành đã đăng ký với Bộ GD&ĐT. Đổi tên cần hồ sơ điều chỉnh ngành đào tạo riêng, ' +
          'không thực hiện qua đề xuất thay đổi CTĐT.',
      });
    },
  },
  {
    title: 'Chuyển Xác suất thống kê sang học kỳ sau để giảm tải',
    async run() {
      const p = await program(PROGRAM);
      const r = await open({
        requestType: 'CURRICULUM',
        targetType: 'PROGRAM',
        targetId: p.id,
        title: this.title,
        reason: 'Học kỳ hiện tại đang có 22 tín chỉ. Đề nghị lùi Xác suất thống kê một học kỳ để cân bằng khối lượng.',
      });
      await moveCourse(r.workspace.copyId, /^Xác suất thống kê/, (s) => (s ?? 3) + 1);
      const s = await submit(r.id);
      return api('POST', `/change-requests/${s.id}/return`, {
        remark:
          'Đề nghị bổ sung biên bản họp Bộ môn và phân tích ảnh hưởng tới khóa K24 đang học theo kế hoạch cũ trước khi gửi lại.',
      });
    },
  },
];

await signIn(DEMO, process.env.DEMO_PASSWORD ?? 'demo');
const staffPassword = process.env.DEMO_STAFF_PASSWORD;
if (!staffPassword) throw new Error('Đặt DEMO_STAFF_PASSWORD (mật khẩu các tài khoản mẫu của db:demo-org).');
for (const user of STAFF) await signIn(user, staffPassword);
// Drafts are visible to their author only, so every account's list counts.
const existing = new Set();
for (const user of [DEMO, ...STAFF])
  for (const r of rows(await call(user, 'GET', '/change-requests?pageSize=100'))) existing.add(r.title);
for (const scenario of SCENARIOS) {
  if (existing.has(scenario.title)) {
    console.log(`skip  ${scenario.title}`);
    continue;
  }
  try {
    const result = await as(scenario.as ?? DEMO, () => scenario.run());
    console.log(`ok    ${result.requestCode ?? ''} ${result.status}  ${scenario.title}`);
  } catch (error) {
    console.log(`FAIL  ${scenario.title}
      ${error.message}`);
  }
}
