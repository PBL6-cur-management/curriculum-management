import { expect, test } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import { createCourse } from '../fixtures/courses.js';
import { createProgram } from '../fixtures/programs.js';
import { chooseOption } from '../fixtures/select.js';
import { uniqueSuffix } from '../fixtures/unique.js';
import {
  addCurriculumItem, assignElectiveItems, chooseCurriculumFilter, chooseCurriculumSegment, createElectiveGroup,
  curriculumRow, curriculumWarning, electiveGroupRow, prepareCurriculumItem, prepareElectiveGroup,
  semesterCard, setRequisite,
} from '../fixtures/curriculum.js';

test.describe('F-07 Khung chương trình, nhóm tự chọn', () => {
  test.use(asRole('R1'));

  test('F07-TC_001 Kiểm tra đủ cột và giữ nguyên ký hiệu', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    const dialog = await prepareCurriculumItem(page, program.curriculumPath, course, { block: 'ĐC / *', note: 'Ghi chú riêng' });
    await dialog.getByRole('checkbox', { name: 'HT ĐA', exact: true }).check();
    await dialog.getByRole('checkbox', { name: 'TQ ĐA', exact: true }).check();
    await dialog.getByLabel('Điểm học', { exact: true }).fill('2.5');
    await dialog.getByLabel('Điểm chuyển', { exact: true }).fill('3');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const row = curriculumRow(page, course);
    await expect(row.getByRole('cell', { name: 'ĐC / *', exact: true })).toBeVisible();
    await expect(row.getByText('Ghi chú riêng', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Sửa', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'HT ĐA', exact: true })).toBeChecked();
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'TQ ĐA', exact: true })).toBeChecked();
    await expect(page.getByLabel('Điểm học', { exact: true })).toHaveValue('2.5');
    await expect(page.getByLabel('Điểm chuyển', { exact: true })).toHaveValue('3');
  });

  test('F07-TC_002 Kiểm tra học phần đã có không còn được chọn', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course);
    await page.getByRole('button', { name: 'Thêm học phần', exact: true }).click();
    const input = page.getByRole('dialog').getByLabel('Học phần', { exact: true });
    await input.click();
    await input.fill(course.code);
    await expect(page.getByText('Không tìm thấy', { exact: true })).toBeVisible();
  });

  test('F07-TC_004 Kiểm tra tiên quyết riêng theo phiên bản', async ({ page }) => {
    const source = await createCourse(page);
    const target = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, source);
    await addCurriculumItem(page, program.curriculumPath, target, { semester: '2' });
    await setRequisite(page, target, source);
    await page.reload();
    await expect(curriculumRow(page, target).getByText(`Tiên quyết: ${source.code} ≥ 2`, { exact: true })).toBeVisible();
  });

  test('F07-TC_009 Kiểm tra nhóm học kỳ và tổng tín chỉ', async ({ page }) => {
    const first = await createCourse(page);
    const second = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, first);
    await addCurriculumItem(page, program.curriculumPath, second, { semester: '2' });
    await chooseCurriculumSegment(page, 'Theo học kỳ');
    await expect(semesterCard(page, 1).getByText(`${first.code} — ${first.name} (2.5 TC)`, { exact: true })).toBeVisible();
    await expect(semesterCard(page, 2).getByText(`${second.code} — ${second.name} (2.5 TC)`, { exact: true })).toBeVisible();
    await expect(semesterCard(page, 1).getByText('Học kỳ 1 — 2.5 TC (BB 2.5 / TC 0)', { exact: true })).toBeVisible();
  });

  test('F07-TC_010 Kiểm tra học kỳ trống vẫn hiện', async ({ page }) => {
    const program = await createProgram(page);
    await page.goto(program.curriculumPath);
    await chooseCurriculumSegment(page, 'Theo học kỳ');
    await expect(semesterCard(page, 7).getByText('Chưa có học phần', { exact: true })).toBeVisible();
    await expect(await curriculumWarning(page, 'Học kỳ 7 chưa có học phần nào.')).toBeVisible();
  });

  test('F07-TC_012 Kiểm tra kết hợp học kỳ và tự chọn', async ({ page }) => {
    const first = await createCourse(page);
    const second = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, first, { semester: '2', elective: true });
    await addCurriculumItem(page, program.curriculumPath, second);
    await chooseCurriculumFilter(page, 'Học kỳ', 'Học kỳ 2');
    await chooseCurriculumSegment(page, 'Tự chọn');
    await expect(curriculumRow(page, first)).toBeVisible();
    await expect(curriculumRow(page, second)).toHaveCount(0);
  });

  test('F07-TC_013 Kiểm tra lọc ký hiệu khối tự do', async ({ page }) => {
    const first = await createCourse(page);
    const second = await createCourse(page);
    const program = await createProgram(page);
    const symbol = `K${uniqueSuffix()}`;
    await addCurriculumItem(page, program.curriculumPath, first, { block: symbol });
    await addCurriculumItem(page, program.curriculumPath, second, { block: 'KHÁC' });
    await chooseCurriculumFilter(page, 'Khối kiến thức', symbol);
    await expect(curriculumRow(page, first)).toBeVisible();
    await expect(curriculumRow(page, second)).toHaveCount(0);
    const blockRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: symbol, exact: true }) }).filter({ hasNot: page.getByRole('button', { name: 'Sửa', exact: true }) });
    await expect(blockRow.getByRole('cell', { name: '2.5', exact: true })).toBeVisible();
  });

  test('F07-TC_014 Kiểm tra tìm tên và xóa lọc', async ({ page }) => {
    const first = await createCourse(page);
    const second = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, first);
    await addCurriculumItem(page, program.curriculumPath, second);
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(first.name);
    await expect(curriculumRow(page, first)).toBeVisible();
    await expect(curriculumRow(page, second)).toHaveCount(0);
    await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click();
    await expect(curriculumRow(page, second)).toBeVisible();
  });

  test('F07-TC_015 Kiểm tra nhóm tối thiểu 6 tín chỉ có danh sách 15', async ({ page }) => {
    test.setTimeout(120_000);
    const courses = [];
    for (let index = 0; index < 5; index += 1) courses.push(await createCourse(page, { credits: '3' }));
    const program = await createProgram(page);
    for (const course of courses) await addCurriculumItem(page, program.curriculumPath, course, { elective: true, credits: '3' });
    const group = await createElectiveGroup(page, program.curriculumPath);
    await assignElectiveItems(page, group.code, courses, '3');
    const row = electiveGroupRow(page, group.code);
    await expect(row.getByRole('cell', { name: '6 TC', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '15', exact: true })).toBeVisible();
    await expect(row.getByText('Ít hơn yêu cầu', { exact: true })).toHaveCount(0);
  });

  test('F07-TC_016 Kiểm tra chỉ có số học phần tối thiểu', async ({ page }) => {
    const program = await createProgram(page);
    const group = await prepareElectiveGroup(page, program.curriculumPath);
    await page.getByLabel('Số học phần tối thiểu', { exact: true }).fill('2');
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(electiveGroupRow(page, group.code).getByRole('cell', { name: '2 HP', exact: true })).toBeVisible();
  });

  test('F07-TC_017 Kiểm tra thiếu cả hai yêu cầu tối thiểu', async ({ page }) => {
    const program = await createProgram(page);
    await prepareElectiveGroup(page, program.curriculumPath);
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Nhập ít nhất một yêu cầu tối thiểu.', { exact: true })).toBeVisible();
  });

  test('F07-TC_018 Kiểm tra không chào dòng bắt buộc vào nhóm', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course);
    const group = await createElectiveGroup(page, program.curriculumPath);
    await electiveGroupRow(page, group.code).getByRole('button', { name: 'Chọn học phần', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('listitem').filter({ hasText: course.code })).toHaveCount(0);
  });

  test('F07-TC_019 Kiểm tra không chào dòng đã thuộc nhóm khác', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course, { elective: true });
    const first = await createElectiveGroup(page, program.curriculumPath, '2.5');
    await assignElectiveItems(page, first.code, [course]);
    const second = await createElectiveGroup(page, program.curriculumPath, '2.5');
    await electiveGroupRow(page, second.code).getByRole('button', { name: 'Chọn học phần', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('listitem').filter({ hasText: course.code })).toHaveCount(0);
  });

  test('F07-TC_020 Kiểm tra sắp xếp bằng bàn phím và tải lại', async ({ page }) => {
    const first = await createCourse(page);
    const second = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, first);
    await addCurriculumItem(page, program.curriculumPath, second);
    const handle = curriculumRow(page, second).getByRole('button', { name: 'Kéo để đổi thứ tự', exact: true });
    await handle.focus();
    await handle.press('Space');
    await handle.press('ArrowUp');
    const saved = page.waitForResponse((response) => response.url().endsWith('/curriculum-order') && response.request().method() === 'PUT' && response.ok());
    await handle.press('Space');
    await saved;
    await page.reload();
    await expect(curriculumRow(page, second).getByRole('cell', { name: '1', exact: true })).toHaveCount(2);
    await expect(curriculumRow(page, first).getByRole('cell', { name: '2', exact: true })).toBeVisible();
  });

  test('F07-TC_021 Kiểm tra chuyển học kỳ qua form', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course, { semester: '3' });
    await curriculumRow(page, course).getByRole('button', { name: 'Sửa', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await chooseOption(page, dialog.getByLabel('Học kỳ', { exact: true }), 'Học kỳ 5');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await chooseCurriculumSegment(page, 'Theo học kỳ');
    await expect(semesterCard(page, 3).getByText('Học kỳ 3 — 0 TC (BB 0 / TC 0)', { exact: true })).toBeVisible();
    await expect(semesterCard(page, 5).getByText('Học kỳ 5 — 2.5 TC (BB 2.5 / TC 0)', { exact: true })).toBeVisible();
  });

  test('F07-TC_022 Kiểm tra chuyển trước tiên quyết vẫn lưu và cảnh báo', async ({ page }) => {
    const source = await createCourse(page);
    const target = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, source, { semester: '4' });
    await addCurriculumItem(page, program.curriculumPath, target, { semester: '5' });
    await setRequisite(page, target, source);
    await curriculumRow(page, target).getByRole('button', { name: 'Sửa', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await chooseOption(page, dialog.getByLabel('Học kỳ', { exact: true }), 'Học kỳ 3');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(await curriculumWarning(page, `${target.code} (học kỳ 3) cần ${source.code} trước, nhưng ${source.code} xếp ở học kỳ 4.`)).toBeVisible();
  });

  test('F07-TC_023 Kiểm tra danh sách dùng ở hai chương trình trong form sửa', async ({ page }) => {
    const course = await createCourse(page);
    const first = await createProgram(page);
    await addCurriculumItem(page, first.curriculumPath, course);
    const second = await createProgram(page);
    await addCurriculumItem(page, second.curriculumPath, course, { semester: '2' });
    await page.goto(`${course.path}/edit`);
    for (const { program, semester } of [{ program: first, semester: 1 }, { program: second, semester: 2 }]) {
      const item = page.getByRole('listitem').filter({ hasText: program.code });
      await expect(item.getByRole('link', { name: `${program.code} — ${program.name}`, exact: true })).toBeVisible();
      await expect(item).toContainText(`(Nháp, học kỳ ${semester})`);
    }
  });

  test('F07-TC_024 Kiểm tra học phần chưa được dùng', async ({ page }) => {
    const course = await createCourse(page);
    await page.goto(`${course.path}/edit`);
    await expect(page.getByText('Học phần chưa được chương trình nào sử dụng', { exact: true })).toBeVisible();
  });

  test('F07-TC_025 Kiểm tra danh sách dùng ở chi tiết', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course, { semester: '2' });
    await page.goto(course.path);
    const item = page.getByRole('listitem').filter({ hasText: program.code });
    await expect(item.getByRole('link', { name: `${program.code} — ${program.name}`, exact: true })).toBeVisible();
    await expect(item).toContainText('(Nháp, học kỳ 2)');
  });

  test('F07-TC_029 Kiểm tra ký hiệu vượt 20 ký tự', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    const dialog = await prepareCurriculumItem(page, program.curriculumPath, course, { block: 'K'.repeat(21) });
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Ký hiệu tối đa 20 ký tự.', { exact: true })).toBeVisible();
  });

  test('F07-TC_030 Kiểm tra ghi chú vượt 500 ký tự', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    const dialog = await prepareCurriculumItem(page, program.curriculumPath, course, { note: 'N'.repeat(501) });
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Ghi chú tối đa 500 ký tự.', { exact: true })).toBeVisible();
  });

  test('F07-TC_034 Kiểm tra mã nhóm bắt buộc', async ({ page }) => {
    const program = await createProgram(page);
    await prepareElectiveGroup(page, program.curriculumPath, '6');
    await page.getByLabel('Mã nhóm', { exact: true }).fill('');
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Nhập mã nhóm.', { exact: true })).toBeVisible();
  });

  test('F07-TC_038 Kiểm tra trùng mã nhóm trong phiên bản', async ({ page }) => {
    const program = await createProgram(page);
    const group = await createElectiveGroup(page, program.curriculumPath);
    await prepareElectiveGroup(page, program.curriculumPath, '6');
    await page.getByLabel('Mã nhóm', { exact: true }).fill(group.code);
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã nhóm tự chọn đã có trong phiên bản này.', { exact: true })).toBeVisible();
  });

  test('F07-TC_042 Kiểm tra nhóm tự chọn rỗng trên chương trình riêng', async ({ page }) => {
    const program = await createProgram(page);
    await page.goto(program.curriculumPath.replace(/\/curriculum$/, '/elective-groups'));
    await expect(page.getByText('Chưa có nhóm tự chọn', { exact: true })).toBeVisible();
  });

  test('F07-TC_044 Kiểm tra tìm khung không có kết quả', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course);
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(`NONE${uniqueSuffix()}`);
    await expect(curriculumRow(page, course)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xóa lọc', exact: true })).toBeVisible();
  });

  test('F07-TC_055 Kiểm tra lọc tắt tay cầm sắp xếp', async ({ page }) => {
    const course = await createCourse(page);
    const program = await createProgram(page);
    await addCurriculumItem(page, program.curriculumPath, course);
    await expect(curriculumRow(page, course).getByRole('button', { name: 'Kéo để đổi thứ tự', exact: true })).toBeVisible();
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(course.code);
    await expect(curriculumRow(page, course).getByRole('button', { name: 'Kéo để đổi thứ tự', exact: true })).toHaveCount(0);
  });
});
