import { expect, test } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import { createCourse } from '../fixtures/courses.js';
import { addCurriculumItem, chooseSegment, curriculumRow } from '../fixtures/curriculum.js';
import { chooseMultipleOption } from '../fixtures/multiselect.js';
import { createProgram } from '../fixtures/programs.js';
import { chooseOption } from '../fixtures/select.js';
import { createGroupedCourse, createSharedSyllabus, createSyllabus, fillRichText, prepareWeek, weeklyRow } from '../fixtures/syllabi.js';
import {
  cloneOutcomeProgram, coverageSection, createAdminOutcome, createClo, createOutcomeFixture,
  createPlo, curriculumItemId, editWeight, itemMatrixPath, linkClo, matrixCell,
  outcomePath, outcomeRow, outcomeVersionId, prepareClo, preparePlo, setWeight,
} from '../fixtures/outcomes.js';

test.describe('F-11 PLO, CLO, ma trận', () => {
  test.use(asRole('R1'));
  test.setTimeout(180_000);

  test('F11-TC_001 Thêm PLO tối thiểu', async ({ page }) => {
    const program = await createProgram(page);
    await createPlo(page, program);
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả PLO1');
  });
  test('F11-TC_002 Từ chối mã PLO trùng không phân biệt hoa thường', async ({ page }) => {
    const program = await createProgram(page);
    await createPlo(page, program);
    const dialog = await preparePlo(page, program, 'plo1');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã PLO đã có trong phiên bản này.', { exact: true })).toBeVisible();
  });
  test('F11-TC_003 PLO cùng mã độc lập giữa hai chương trình', async ({ page }) => {
    const first = await createProgram(page);
    const second = await createProgram(page);
    await createPlo(page, first);
    await createPlo(page, second, 'PLO1', 'Mô tả riêng B');
    await page.goto(outcomePath(first, 'plos'));
    await outcomeRow(page, 'PLO1').getByRole('button', { name: /Sửa$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mô tả (tiếng Việt)', { exact: true }).fill('Mô tả riêng A');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả riêng A');
    await page.goto(outcomePath(second, 'plos'));
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả riêng B');
  });
  test('F11-TC_004 Cảnh báo liên kết trước khi xóa PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await page.goto(outcomePath(owned.program, 'plos'));
    await outcomeRow(page, 'PLO1').getByRole('button', { name: /Xóa$/ }).click();
    const confirm = page.locator('.ant-popconfirm:visible');
    await expect(confirm).toContainText('Xóa PLO này sẽ xóa 1 ô học phần–PLO và 1 liên kết CLO.');
    await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(outcomeRow(page, 'PLO1')).toHaveCount(0);
  });
  test('F11-TC_005 Thêm CLO có mức nhận thức', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    await expect(outcomeRow(page, 'CLO1')).toContainText('Mô tả CLO1');
    await expect(outcomeRow(page, 'CLO1')).toContainText('Áp dụng');
  });
  test('F11-TC_006 Từ chối mã CLO trùng', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    const dialog = await prepareClo(page, syllabus, 'clo1');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã CLO đã có trong đề cương này.', { exact: true })).toBeVisible();
  });
  test('F11-TC_007 CLO dùng chung qua hai chương trình', async ({ page }) => {
    const syllabus = await createSharedSyllabus(page);
    await createClo(page, syllabus);
    for (const program of syllabus.programs) {
      await createPlo(page, program);
      const itemId = await curriculumItemId(page, program, syllabus.course.code);
      await page.goto(itemMatrixPath(program, itemId));
      await expect(page.getByRole('cell', { name: 'CLO1 — Mô tả CLO1', exact: true })).toBeVisible();
    }
  });
  test('F11-TC_008 Cảnh báo nơi dùng trước khi xóa CLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await page.goto(owned.syllabus.editPath);
    await page.getByRole('tab', { name: 'CLO', exact: true }).click();
    await outcomeRow(page, 'CLO1').getByRole('button', { name: /Xóa$/ }).click();
    const confirm = page.locator('.ant-popconfirm:visible');
    await expect(confirm).toContainText(`CLO này đang gắn PLO ở chương trình ${owned.program.code}; xóa sẽ xóa các liên kết đó.`);
    await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(outcomeRow(page, 'CLO1')).toHaveCount(0);
  });
  test('F11-TC_010 Lưu liên kết nhị phân CLO–PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
  });
  test('F11-TC_011 Cùng CLO có ánh xạ độc lập ở hai chương trình', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    const second = await createProgram(page);
    await addCurriculumItem(page, second.curriculumPath, owned.course);
    await createPlo(page, second, 'PLO5');
    await setWeight(page, second, owned.course.code, 'PLO5');
    const secondPath = itemMatrixPath(second, await curriculumItemId(page, second, owned.course.code));
    await linkClo(page, secondPath, 'CLO1', 'PLO5');
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await expect(page.getByRole('columnheader', { name: /^PLO5( |$)/ })).toHaveCount(0);
    await page.goto(secondPath);
    await expect((await matrixCell(page, 'CLO1', 'PLO5')).getByRole('checkbox')).toBeChecked();
  });
  test('F11-TC_012 Ô chưa có trọng số không cho gắn CLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await page.goto(owned.itemPath);
    const cell = await matrixCell(page, 'CLO1', 'PLO1');
    await expect(cell.getByRole('checkbox')).toBeDisabled();
    await expect(cell.getByRole('combobox')).toHaveCount(0);
  });
  test('F11-TC_013 API chặn liên kết khi thiếu trọng số', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    const response = await page.request.put(`/api/curriculum-items/${owned.itemId}/clo-plo-links`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { links: [{ cloId: owned.clo.id, ploId: owned.plo.id }] },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).message).toBe('Học phần chưa gắn PLO này trong ma trận học phần–PLO; gắn ở đó trước.');
  });
  test('F11-TC_014 Học phần ngoài khoa vẫn được gắn CLO–PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page, { foreign: true });
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
  });
  test('F11-TC_015 Ma trận toàn chương trình hiển thị ánh xạ', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await page.goto(outcomePath(owned.program, 'plos'));
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả PLO1');
    await page.goto(outcomePath(owned.program, 'clo-plo-matrix'));
    const panel = page.locator('.ant-collapse-item').filter({ hasText: owned.course.code });
    await panel.locator('.ant-collapse-header').click();
    await expect(panel.getByRole('cell', { name: 'CLO1 — Mô tả CLO1', exact: true })).toBeVisible();
    await expect(panel.getByRole('columnheader', { name: 'PLO1', exact: true })).toBeVisible();
    await expect(panel.getByLabel('CLO1 gắn PLO1', { exact: true })).toBeVisible();
  });
  test('F11-TC_016 Lọc ma trận theo học kỳ', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    const second = await createCourse(page);
    await addCurriculumItem(page, owned.program.curriculumPath, second, { semester: '2' });
    await page.goto(outcomePath(owned.program, 'clo-plo-matrix'));
    await chooseOption(page, page.getByRole('combobox', { name: 'Lọc theo học kỳ', exact: true }), 'Học kỳ 1');
    await expect(page.locator('.ant-collapse-item').filter({ hasText: owned.course.code })).toBeVisible();
    await expect(page.locator('.ant-collapse-item').filter({ hasText: second.code })).toHaveCount(0);
  });
  test('F11-TC_017 Lọc ma trận theo PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await createPlo(page, owned.program, 'PLO2');
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await page.goto(outcomePath(owned.program, 'clo-plo-matrix'));
    await chooseOption(page, page.getByRole('combobox', { name: 'Lọc theo PLO', exact: true }), 'PLO1');
    const panel = page.locator('.ant-collapse-item').filter({ hasText: owned.course.code });
    await panel.locator('.ant-collapse-header').click();
    await expect(panel.getByRole('columnheader', { name: 'PLO1', exact: true })).toBeVisible();
    await expect(panel.getByRole('columnheader', { name: 'PLO2', exact: true })).toHaveCount(0);
  });
  test('F11-TC_019 Trọng số thập phân hiển thị dấu phẩy sau tải lại', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await page.reload();
    await expect(await matrixCell(page, owned.course.code, 'PLO1')).toHaveText('0,5');
  });
  test('F11-TC_020 Từ chối trọng số lớn hơn một', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await page.goto(outcomePath(owned.program, 'course-plo-matrix'));
    const cell = await editWeight(page, owned.course.code, 'PLO1', '1,5');
    await expect(cell.getByRole('alert')).toHaveText('Trọng số phải lớn hơn 0, không quá 1 và có tối đa hai chữ số thập phân.');
  });
  test('F11-TC_024 Chấp nhận trọng số biên trên', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1', '1');
    await page.reload();
    await expect(await matrixCell(page, owned.course.code, 'PLO1')).toHaveText('1');
  });
  test('F11-TC_026 Xóa ô trọng số có cảnh báo liên kết', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    await page.goto(outcomePath(owned.program, 'course-plo-matrix'));
    await editWeight(page, owned.course.code, 'PLO1', '');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Xóa ô này sẽ xóa 1 liên kết CLO–PLO của học phần với PLO này.');
    await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(await matrixCell(page, owned.course.code, 'PLO1')).toHaveText('＋');
    await page.goto(owned.itemPath);
    const checkbox = (await matrixCell(page, 'CLO1', 'PLO1')).getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeDisabled();
  });
  test('F11-TC_028 Báo PLO chưa có học phần', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await page.goto(outcomePath(owned.program, 'outcome-coverage'));
    await expect(coverageSection(page, 'PLO chưa có học phần')).toContainText('PLO1');
  });
  test('F11-TC_029 Báo CLO chưa gắn PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await page.goto(outcomePath(owned.program, 'outcome-coverage'));
    const section = coverageSection(page, 'CLO chưa gắn PLO');
    await expect(section).toContainText(owned.course.code);
    await expect(section).toContainText('CLO1');
  });
  test('F11-TC_030 Báo học phần chưa gắn PLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await page.goto(outcomePath(owned.program, 'outcome-coverage'));
    await expect(coverageSection(page, 'Học phần chưa gắn PLO')).toContainText(owned.course.code);
  });
  test('F11-TC_031 Thiếu sót không chặn lưu ma trận', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await createPlo(page, owned.program, 'PLO2');
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await page.goto(outcomePath(owned.program, 'outcome-coverage'));
    await expect(coverageSection(page, 'PLO chưa có học phần')).toContainText('PLO2');
    await expect(page.getByText('Chỉ để theo dõi: thiếu sót không chặn việc lưu.', { exact: true })).toBeVisible();
  });
  test('F11-TC_033 Nhân bản giữ PLO trọng số và ánh xạ', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await setWeight(page, owned.program, owned.course.code, 'PLO1');
    await linkClo(page, owned.itemPath);
    const cloned = await cloneOutcomeProgram(page, owned.program);
    await page.goto(outcomePath(cloned, 'plos'));
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả PLO1');
    await page.goto(outcomePath(cloned, 'course-plo-matrix'));
    await expect(await matrixCell(page, owned.course.code, 'PLO1')).toHaveText('0,5');
    await page.goto(itemMatrixPath(cloned, await curriculumItemId(page, cloned, owned.course.code)));
    await expect((await matrixCell(page, 'CLO1', 'PLO1')).getByRole('checkbox')).toBeChecked();
  });
  test('F11-TC_034 Sửa PLO bản sao không đổi nguồn', async ({ page }) => {
    const program = await createProgram(page);
    await createPlo(page, program);
    const cloned = await cloneOutcomeProgram(page, program);
    await page.goto(outcomePath(cloned, 'plos'));
    await outcomeRow(page, 'PLO1').getByRole('button', { name: /Sửa$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mô tả (tiếng Việt)', { exact: true }).fill('Mô tả bản sao');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả bản sao');
    await page.goto(outcomePath(program, 'plos'));
    await expect(outcomeRow(page, 'PLO1')).toContainText('Mô tả PLO1');
  });
  test('F11-TC_035 Bản sao vẫn dùng chung đề cương và CLO', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    const cloned = await cloneOutcomeProgram(page, owned.program);
    await page.goto(cloned.curriculumPath);
    await curriculumRow(page, owned.course).getByRole('link', { name: /Đề cương$/ }).click();
    expect(new URL(page.url()).pathname).toBe(owned.syllabus.viewPath);
    await expect(outcomeRow(page, 'CLO1')).toContainText('Mô tả CLO1');
  });
  test('F11-TC_036 Danh sách PLO rỗng', async ({ page }) => {
    const program = await createProgram(page);
    await page.goto(outcomePath(program, 'plos'));
    await expect(page.getByText('Phiên bản này chưa có PLO', { exact: true })).toBeVisible();
  });
  test('F11-TC_037 Danh sách CLO rỗng', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await page.goto(syllabus.editPath);
    await page.getByRole('tab', { name: 'CLO', exact: true }).click();
    await expect(page.getByText('Chưa có CLO', { exact: true })).toBeVisible();
  });
  test('F11-TC_038 Ma trận học phần chưa có đề cương', async ({ page }) => {
    const program = await createProgram(page);
    const course = await createCourse(page);
    await addCurriculumItem(page, program.curriculumPath, course);
    await page.goto(itemMatrixPath(program, await curriculumItemId(page, program, course.code)));
    await expect(page.getByText('Học phần chưa có đề cương', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Mở đề cương$/ })).toBeVisible();
  });
  test('F11-TC_039 Ma trận đề cương chưa có CLO', async ({ page }) => {
    const program = await createProgram(page);
    const syllabus = await createSyllabus(page);
    await addCurriculumItem(page, program.curriculumPath, syllabus.course);
    await page.goto(itemMatrixPath(program, await curriculumItemId(page, program, syllabus.course.code)));
    await expect(page.getByText('Đề cương chưa có CLO', { exact: true })).toBeVisible();
  });
  test('F11-TC_040 Bộ lọc PLO không có kết quả', async ({ page }) => {
    const owned = await createOutcomeFixture(page);
    await createPlo(page, owned.program, 'PLO2');
    await page.goto(outcomePath(owned.program, 'clo-plo-matrix'));
    await chooseOption(page, page.getByRole('combobox', { name: 'Lọc theo PLO', exact: true }), 'PLO2');
    await expect(page.locator('.ant-collapse-item')).toHaveCount(0);
  });
  test('F11-TC_041 Bắt buộc mã PLO', async ({ page }) => {
    const dialog = await preparePlo(page, await createProgram(page), '');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Nhập mã PLO.', { exact: true })).toBeVisible();
  });
  test('F11-TC_042 Bắt buộc mô tả PLO', async ({ page }) => {
    const dialog = await preparePlo(page, await createProgram(page), 'PLO1', '');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Nhập mô tả PLO.', { exact: true })).toBeVisible();
  });
  test('F11-TC_043 Bắt buộc mã CLO', async ({ page }) => {
    const dialog = await prepareClo(page, await createSyllabus(page), '');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Nhập mã CLO.', { exact: true })).toBeVisible();
  });
  test('F11-TC_044 Bắt buộc mô tả CLO', async ({ page }) => {
    const dialog = await prepareClo(page, await createSyllabus(page), 'CLO1', '');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog.getByText('Nhập mô tả CLO.', { exact: true })).toBeVisible();
  });
  test('F11-TC_063 Tìm CLO theo mã trong đa chọn', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    const dialog = await prepareWeek(page);
    const combobox = dialog.getByLabel('CLO đạt được', { exact: true });
    await combobox.click();
    await combobox.fill('CLO1');
    await expect(page.locator('.ant-select-dropdown:visible').getByText('CLO1', { exact: true })).toBeVisible();
  });
  test('F11-TC_081 Lưu CLO của tuần bằng đa chọn không nhập tìm kiếm', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    const dialog = await prepareWeek(page);
    await dialog.getByLabel('Tuần', { exact: true }).fill('1');
    await fillRichText(dialog, 'Nội dung', 'Nội dung gắn CLO');
    await chooseMultipleOption(page, dialog.getByLabel('CLO đạt được', { exact: true }), 'CLO1', '', { skipSearch: true });
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Nội dung theo tuần', exact: true }).click();
    await expect(weeklyRow(page, '1')).toContainText('CLO1');
  });
  test('F11-TC_064 Xem mô tả CLO song ngữ', async ({ page }) => {
    const syllabus = await createSyllabus(page);
    await createClo(page, syllabus);
    await outcomeRow(page, 'CLO1').getByRole('button', { name: /Sửa$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mô tả (tiếng Anh)', { exact: true }).fill('Analyse');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.goto(syllabus.viewPath);
    await chooseSegment(page, 'English');
    await expect(outcomeRow(page, 'CLO1')).toContainText('Analyse');
    await chooseSegment(page, 'Tiếng Việt');
    await expect(outcomeRow(page, 'CLO1')).toContainText('Mô tả CLO1');
  });

  test.describe('R2 chỉ xem', () => {
    test.use(asRole('R2'));
    test('F11-TC_018 Không sửa ô trọng số qua giao diện', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        await page.goto(outcomePath(owned.program, 'course-plo-matrix'));
        const cell = await matrixCell(page, owned.course.code, 'PLO1');
        await expect(cell.getByLabel(/^(Nhập trọng số|Trọng số )/)).toHaveCount(0);
        await expect(cell.getByRole('textbox')).toHaveCount(0);
      } finally { await owned.context.close(); }
    });
    test('F11-TC_065 API từ chối sửa trọng số', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const response = await page.request.put(`/api/curriculum-items/${owned.itemId}/plo-weights/${owned.plo.id}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { weight: '0.5' },
        });
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Bạn không có quyền thực hiện thao tác này.');
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R3 ngoài chương trình', () => {
    test.use(asRole('R3b'));
    test('F11-TC_066 Không thêm PLO ngoài phạm vi', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const response = await page.request.post(`/api/program-versions/${owned.versionId}/plos`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { ploCode: 'PLO2', description: 'Ngoài phạm vi' },
        });
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Đối tượng này nằm ngoài phạm vi được phân công của bạn.');
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R4 cùng nhóm', () => {
    test.use(asRole('R4'));
    test('F11-TC_032 Báo cáo chỉ lọc học phần cùng nhóm', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const admin = await owned.context.newPage();
        const other = await createGroupedCourse(admin, 'E2E-CNPM — Công nghệ phần mềm');
        await addCurriculumItem(admin, owned.program.curriculumPath, other);
        await page.goto(outcomePath(owned.program, 'outcome-coverage'));
        const section = coverageSection(page, 'Học phần chưa gắn PLO');
        await expect(section).toContainText(owned.course.code);
        await expect(section).not.toContainText(other.code);
        await expect(page.getByRole('alert')).toContainText('nhóm');
      } finally { await owned.context.close(); }
    });
    test('F11-TC_072 Gắn CLO–PLO trong nhóm được phân công', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const admin = await owned.context.newPage();
        await setWeight(admin, owned.program, owned.course.code, 'PLO1');
        await linkClo(page, owned.itemPath);
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R4 ngoài nhóm', () => {
    test.use(asRole('R4b'));
    test('F11-TC_068 API từ chối gắn CLO–PLO ngoài nhóm', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const response = await page.request.put(`/api/curriculum-items/${owned.itemId}/clo-plo-links`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { links: [] },
        });
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Đối tượng này nằm ngoài phạm vi được phân công của bạn.');
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R5 cùng nhóm', () => {
    test.use(asRole('R5'));
    test('F11-TC_073 Giảng viên gắn CLO–PLO cùng nhóm', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const admin = await owned.context.newPage();
        await setWeight(admin, owned.program, owned.course.code, 'PLO1');
        await linkClo(page, owned.itemPath);
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R5 ngoài nhóm', () => {
    test.use(asRole('R5b'));
    test('F11-TC_069 API từ chối gắn CLO–PLO ngoài nhóm', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        const response = await page.request.put(`/api/curriculum-items/${owned.itemId}/clo-plo-links`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { links: [] },
        });
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Đối tượng này nằm ngoài phạm vi được phân công của bạn.');
      } finally { await owned.context.close(); }
    });
  });
  test.describe('R6 ngoài phạm vi', () => {
    test.use(asRole('R6'));
    test('F11-TC_070 Không xem ma trận học phần–PLO', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        await page.goto(outcomePath(owned.program, 'course-plo-matrix'));
        await expect(page.getByText('Bạn không có quyền xem ma trận này', { exact: true })).toBeVisible();
        const response = await page.request.get(`/api/program-versions/${owned.versionId}/course-plo-matrix`);
        expect(response.status()).toBe(403);
      } finally { await owned.context.close(); }
    });
    test('F11-TC_074 Không xem PLO chương trình ngoài phạm vi', async ({ page, browser }) => {
      const owned = await createAdminOutcome(browser);
      try {
        await page.goto(outcomePath(owned.program, 'plos'));
        await expect(page.getByText('Bạn không có quyền xem PLO này', { exact: true })).toBeVisible();
      } finally { await owned.context.close(); }
    });
  });
});
