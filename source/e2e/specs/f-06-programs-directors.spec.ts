import { expect, test } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import { assignDirector, cloneProgram, createProgram, prepareProgram, programInfo, programRow } from '../fixtures/programs.js';
import { chooseOption } from '../fixtures/select.js';
import { createUser } from '../fixtures/users.js';
import { uniqueSuffix } from '../fixtures/unique.js';

test.describe('F-06 Thông tin chương trình, Giám đốc CTĐT', () => {
  test.use(asRole('R1'));

  test('F06-TC_001 Kiểm tra tìm chương trình riêng', async ({ page }) => {
    const program = await createProgram(page);
    await page.goto('/programs');
    await page.getByPlaceholder('Tìm theo mã hoặc tên chương trình', { exact: true }).fill(program.code);
    const row = programRow(page, program.code);
    await expect(row.getByRole('cell', { name: program.name, exact: true })).toBeVisible();
    await expect(row.getByText('Kỹ sư', { exact: true })).toBeVisible();
    await expect(row.getByText('Đang sử dụng', { exact: true })).toBeVisible();
    await expect(row.getByText('Nháp', { exact: true })).toBeVisible();
  });

  test('F06-TC_002 Kiểm tra tổng quan và chưa phân công', async ({ page }) => {
    const program = await createProgram(page);
    await expect(programInfo(page).getByText(program.name, { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa phân công Giám đốc CTĐT', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Khung chương trình', exact: true })).toHaveAttribute('href', program.curriculumPath);
  });

  test('F06-TC_004 Kiểm tra tạo kèm phiên bản Nháp', async ({ page }) => {
    await createProgram(page);
    await expect(programInfo(page).getByText('Nháp', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sửa thông tin', exact: true })).toBeVisible();
  });

  test('F06-TC_005 Kiểm tra lệch tổng tín chỉ', async ({ page }) => {
    await prepareProgram(page, { total: '150', compulsory: '120', elective: '25' });
    await expect(page.getByText('Chênh lệch 5 tín chỉ.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Tín chỉ bắt buộc cộng tín chỉ tự chọn phải bằng tổng tín chỉ (chênh lệch 5 tín chỉ).', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/programs\/new$/);
  });

  test('F06-TC_006 Kiểm tra Kỹ sư và Cử nhân cùng tồn tại', async ({ page }) => {
    const engineer = await createProgram(page, { semesters: '10', total: '150', compulsory: '120', elective: '30' });
    const bachelor = await createProgram(page, { degree: 'Cử nhân', semesters: '8', total: '120', compulsory: '100', elective: '20' });
    await expect(programInfo(page).getByText('Cử nhân', { exact: true })).toBeVisible();
    await expect(programInfo(page).getByText('120', { exact: true })).toBeVisible();
    await expect(programInfo(page).getByText('8', { exact: true })).toBeVisible();
    await page.goto(engineer.path);
    await expect(programInfo(page).getByText('Kỹ sư', { exact: true })).toBeVisible();
    await expect(programInfo(page).getByText('150', { exact: true })).toBeVisible();
    await expect(programInfo(page).getByText('10', { exact: true })).toBeVisible();
    await page.goto(bachelor.path);
    await expect(programInfo(page).getByText(bachelor.name, { exact: true })).toBeVisible();
  });

  test('F06-TC_009 Kiểm tra một người phụ trách hai chương trình riêng', async ({ page }) => {
    const user = await createUser(page);
    const first = await createProgram(page);
    await assignDirector(page, user);
    await createProgram(page);
    await assignDirector(page, user);
    await page.goto(first.path);
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: user.name, exact: true }) }).getByText('Đang hiệu lực', { exact: true })).toBeVisible();
  });

  test('F06-TC_011 Kiểm tra hai Giám đốc cùng hiệu lực', async ({ page }) => {
    const first = await createUser(page);
    const second = await createUser(page);
    await createProgram(page);
    await assignDirector(page, first);
    await assignDirector(page, second);
    for (const user of [first, second]) {
      await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: user.name, exact: true }) }).getByText('Đang hiệu lực', { exact: true })).toBeVisible();
    }
  });

  test('F06-TC_016 Kiểm tra sửa bản sao không đổi nguồn', async ({ page }) => {
    const source = await createProgram(page);
    const clone = await cloneProgram(page);
    await page.getByRole('button', { name: 'Sửa thông tin', exact: true }).click();
    await page.getByLabel('Tên chương trình', { exact: true }).fill(`${clone.name} sửa`);
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2 })).toContainText(`${clone.name} sửa`);
    await page.goto(source.path);
    await expect(programInfo(page).getByText(source.name, { exact: true })).toBeVisible();
  });

  test('F06-TC_017 Kiểm tra thông tin nguồn nhân bản', async ({ page }) => {
    const source = await createProgram(page);
    await cloneProgram(page);
    await expect(programInfo(page).getByRole('link', { name: source.code, exact: true })).toHaveAttribute('href', source.path);
  });

  test('F06-TC_018 Kiểm tra tìm không có kết quả', async ({ page }) => {
    await page.goto('/programs');
    await page.getByPlaceholder('Tìm theo mã hoặc tên chương trình', { exact: true }).fill(`NONE${uniqueSuffix()}`);
    await expect(page.getByText('Không có chương trình khớp bộ lọc', { exact: true })).toBeVisible();
  });

  test('F06-TC_020 Kiểm tra trùng mã chương trình riêng', async ({ page }) => {
    const program = await createProgram(page);
    await prepareProgram(page, { code: program.code });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã chương trình đã tồn tại.', { exact: true })).toBeVisible();
  });

  test('F06-TC_021 Kiểm tra mã chương trình bắt buộc', async ({ page }) => {
    await prepareProgram(page, { code: '' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Nhập mã chương trình.', { exact: true })).toBeVisible();
  });

  test('F06-TC_022 Kiểm tra mã chương trình vượt 20 ký tự', async ({ page }) => {
    await prepareProgram(page, { code: 'P'.repeat(21) });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã chương trình tối đa 20 ký tự.', { exact: true })).toBeVisible();
  });

  test('F06-TC_023 Kiểm tra tên chương trình bắt buộc', async ({ page }) => {
    await prepareProgram(page, { name: '' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Nhập tên chương trình.', { exact: true })).toBeVisible();
  });

  test('F06-TC_024 Kiểm tra tên chương trình vượt 200 ký tự', async ({ page }) => {
    await prepareProgram(page, { name: 'N'.repeat(201) });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Tên chương trình tối đa 200 ký tự.', { exact: true })).toBeVisible();
  });

  test('F06-TC_031 Kiểm tra tín chỉ âm', async ({ page }) => {
    await prepareProgram(page, { total: '-1' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Số tín chỉ phải là số từ 0 đến 999.99, tối đa 2 chữ số thập phân (ví dụ 3, 2.5 hoặc 0).', { exact: true })).toBeVisible();
  });

  test('F06-TC_033 Kiểm tra chương trình không tín chỉ', async ({ page }) => {
    await createProgram(page, { total: '0', compulsory: '0', elective: '0' });
    await expect(page.getByRole('button', { name: 'Sửa thông tin', exact: true })).toBeVisible();
  });

  test('F06-TC_034 Kiểm tra người phân công bắt buộc', async ({ page }) => {
    await createProgram(page);
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Phân công', exact: true }).click();
    await expect(page.getByText('Chọn người được phân công.', { exact: true })).toBeVisible();
  });

  test('F06-TC_036 Kiểm tra phân công cùng người chồng thời gian', async ({ page }) => {
    const user = await createUser(page);
    await createProgram(page);
    await assignDirector(page, user);
    await page.getByRole('button', { name: 'Phân công', exact: true }).click();
    const dialog = page.getByRole('dialog');
    // UserSelect does not forward Form.Item's id to its combobox.
    await chooseOption(page, dialog.getByRole('combobox'), `${user.userCode} — ${user.name}`, { search: user.username });
    await dialog.getByRole('button', { name: 'Phân công', exact: true }).click();
    await expect(dialog.getByText('Người này đã được phân công cho chương trình trong khoảng thời gian chồng lên.', { exact: true })).toBeVisible();
  });

  test('F06-TC_038 Kiểm tra ngừng sử dụng chương trình riêng', async ({ page }) => {
    const program = await createProgram(page);
    await page.getByRole('button', { name: 'Ngừng sử dụng', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ngừng sử dụng', exact: true }).click();
    await expect(page.getByText('Đã ngừng sử dụng chương trình.', { exact: true })).toBeVisible();
    await page.goto('/programs');
    await page.getByPlaceholder('Tìm theo mã hoặc tên chương trình', { exact: true }).fill(program.code);
    await expect(page.getByText('Không có chương trình khớp bộ lọc', { exact: true })).toBeVisible();
    await chooseOption(page, page.getByRole('combobox', { name: 'Trạng thái', exact: true }), 'Tất cả');
    await expect(programRow(page, program.code).getByText('Ngừng sử dụng', { exact: true })).toBeVisible();
  });

  test.describe('R6', () => {
    test.use(asRole('R6'));
    test('F06-TC_003 Kiểm tra sinh viên bị từ chối danh sách', async ({ page }) => {
      await page.goto('/programs');
      await expect(page.getByText('Không thể tải danh sách chương trình', { exact: true })).toBeVisible();
    });
  });
});
