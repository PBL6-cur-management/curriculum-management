import { expect, test } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import {
  buildAdminReleaseProgram, buildPendingRequest, buildReleaseProgram, fixtureApi, prepareRequest,
  requestHeading, saveRequest, seedRequest, submitRequest, uploadRequestDocument, withRequestRole, withdrawRequest,
} from '../fixtures/change-requests.js';
import { chooseOption } from '../fixtures/select.js';
import { uniqueSuffix } from '../fixtures/unique.js';

test.describe('F-13 Đề xuất thay đổi', () => {
  test.describe('R1 soạn đề xuất và kiểm dữ liệu', () => {
    test.use(asRole('R1'));

    test('F13-TC_005 Tạo Nháp có mã riêng', async ({ page }) => {
      const program = await buildReleaseProgram(page);
      await prepareRequest(page, program);
      const request = await saveRequest(page);
      await expect(requestHeading(page, request)).toBeVisible();
      await expect(page.getByText('Nháp', { exact: true })).toBeVisible();
      await expect(page.getByText('Soạn thay đổi', { exact: true })).toBeVisible();
    });

    test('F13-TC_006 Bản sao không đổi dữ liệu đang áp dụng', async ({ page }) => {
      const program = await buildReleaseProgram(page);
      await prepareRequest(page, program);
      const request = await saveRequest(page);
      await page.getByRole('button', { name: 'Sửa thông tin chương trình', exact: true }).click();
      await page.getByLabel('Tên chương trình', { exact: true }).fill(`Điều chỉnh ${program.code}`);
      await page.getByRole('button', { name: 'Lưu', exact: true }).click();
      await expect(requestHeading(page, request)).toBeVisible();
      await expect(page.getByText(`Điều chỉnh ${program.code}`, { exact: true })).toBeVisible();
      await page.goto(program.path);
      // The program workspace (PR #35) titles the program with a level-3 heading.
      await expect(page.getByRole('heading', { level: 3 }).first()).toContainText(program.name);
      await expect(page.getByRole('heading', { level: 3 }).first()).not.toContainText(`Điều chỉnh ${program.code}`);
    });

    test('F13-TC_007 Xóa Nháp chưa gửi sau xác nhận', async ({ page }) => {
      const program = await buildReleaseProgram(page);
      await prepareRequest(page, program);
      const request = await saveRequest(page);
      await page.getByRole('button', { name: 'Xóa', exact: true }).click();
      const confirm = page.locator('.ant-popconfirm:visible');
      await expect(confirm.getByText('Xóa đề xuất Nháp này? Bản nháp dữ liệu và hồ sơ đính kèm cũng bị xóa.', { exact: true })).toBeVisible();
      await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
      await expect(page).toHaveURL(/\/change-requests$/);
      await page.goto(`/change-requests/${request.id}`);
      await expect(page.getByText('Không tìm thấy đề xuất', { exact: true })).toBeVisible();
    });

    test('F13-TC_011 Nguồn Trường bắt buộc số căn cứ', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page), { university: true });
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Nhập số văn bản căn cứ của Trường.', { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/change-requests\/new\?/);
    });

    test('F13-TC_012 Nguồn Khoa để trống căn cứ vẫn lưu', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      await saveRequest(page);
      await expect(page.getByText('Khoa đề xuất', { exact: true })).toBeVisible();
    });

    test('F13-TC_014 Lọc nguồn của đề xuất riêng', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      const request = await saveRequest(page);
      await page.goto('/change-requests');
      await chooseOption(page, page.getByRole('combobox', { name: 'Nguồn', exact: true }), 'Khoa đề xuất');
      const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: request.requestCode, exact: true }) });
      await expect(row).toContainText(request.title);
      await expect(row).toContainText('Khoa đề xuất');
    });

    test('F13-TC_015 Tải hồ sơ căn cứ lên Nháp', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      await saveRequest(page);
      const fileName = `can-cu-${uniqueSuffix()}.png`;
      await uploadRequestDocument(page, fileName);
      const row = page.getByRole('row').filter({ hasText: fileName });
      await expect(row).toContainText('Công văn');
      await expect(row.getByRole('cell')).not.toHaveCount(0);
      await expect(row).toContainText(/\d{2}\/\d{2}\/\d{4}/);
    });

    test('F13-TC_016 Người duyệt tải hồ sơ đã gửi', async ({ browser }) => {
      const program = await buildAdminReleaseProgram(browser);
      const fileName = `can-cu-${uniqueSuffix()}.png`;
      const request = await withRequestRole(browser, 'R5', async (creator) => {
        const owned = await seedRequest(creator, program);
        await creator.goto(`/change-requests/${owned.id}/edit`);
        await uploadRequestDocument(creator, fileName);
        await fixtureApi(creator, 'POST', `/change-requests/${owned.id}/submit`);
        return owned;
      });
      await withRequestRole(browser, 'R4', async (reviewer) => {
        await reviewer.goto(`/change-requests/${request.id}`);
        const downloading = reviewer.waitForEvent('download');
        await reviewer.getByRole('row').filter({ hasText: fileName }).getByRole('button', { name: fileName, exact: true }).click();
        expect((await downloading).suggestedFilename()).toBe(fileName);
      });
    });

    test('F13-TC_026 Cảnh báo đề xuất khác không chặn tạo', async ({ page, browser }) => {
      const { program, request: other } = await buildPendingRequest(browser);
      await prepareRequest(page, program, { course: true });
      await expect(page.getByText('Đối tượng này đang có đề xuất khác chưa kết thúc', { exact: true })).toBeVisible();
      const conflict = page.getByRole('listitem').filter({ hasText: other.requestCode });
      await expect(conflict).toContainText('ThS. Đặng Thị Lan');
      await expect(conflict).toContainText('Chờ Điều phối duyệt');
      const own = await saveRequest(page);
      expect(own.requestCode).not.toBe(other.requestCode);
    });

    test('F13-TC_028 Khác đối tượng không có cảnh báo', async ({ page }) => {
      const first = await buildReleaseProgram(page);
      await seedRequest(page, first, false);
      const second = await buildReleaseProgram(page);
      await prepareRequest(page, second);
      await expect(page.getByLabel('Tiêu đề', { exact: true })).toHaveValue(/Đề xuất/);
      await expect(page.getByText('Đối tượng này đang có đề xuất khác chưa kết thúc', { exact: true })).not.toBeVisible();
    });

    test('F13-TC_038 Tiêu đề bắt buộc', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      await page.getByLabel('Tiêu đề', { exact: true }).clear();
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Nhập tiêu đề đề xuất.', { exact: true })).toBeVisible();
    });

    test('F13-TC_039 Lý do bắt buộc', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      await page.getByLabel('Lý do', { exact: true }).clear();
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Nhập lý do đề xuất.', { exact: true })).toBeVisible();
    });

    test('F13-TC_040 Tiêu đề đúng 200 ký tự', async ({ page }) => {
      const title = `${uniqueSuffix()}${'a'.repeat(184)}`;
      await prepareRequest(page, await buildReleaseProgram(page), { title });
      const request = await saveRequest(page);
      await expect(requestHeading(page, request)).toContainText(title);
    });

    test('F13-TC_041 Tiêu đề vượt 200 ký tự', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page), { title: 'a'.repeat(201) });
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Tối đa 200 ký tự.', { exact: true })).toBeVisible();
    });

    test('F13-TC_042 Căn cứ đúng 100 ký tự', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page), { university: true });
      const basis = 'Q'.repeat(100);
      await page.getByLabel('Số văn bản căn cứ', { exact: true }).fill(basis);
      await saveRequest(page);
      await expect(page.getByText(basis, { exact: true })).toBeVisible();
    });

    test('F13-TC_043 Căn cứ vượt 100 ký tự', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page), { university: true });
      await page.getByLabel('Số văn bản căn cứ', { exact: true }).fill('Q'.repeat(101));
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Tối đa 100 ký tự.', { exact: true })).toBeVisible();
    });

    test('F13-TC_046 Hồ sơ rỗng', async ({ page }) => {
      await prepareRequest(page, await buildReleaseProgram(page));
      await saveRequest(page);
      await expect(page.getByText('Chưa có hồ sơ đính kèm', { exact: true })).toBeVisible();
    });
  });

  test.describe('R5 tạo và thu hồi', () => {
    test.use(asRole('R5'));

    test('F13-TC_017 Hồ sơ đã gửi không xóa được', async ({ page, browser }) => {
      const program = await buildAdminReleaseProgram(browser);
      const request = await seedRequest(page, program);
      await page.goto(`/change-requests/${request.id}/edit`);
      const fileName = `can-cu-${uniqueSuffix()}.png`;
      await uploadRequestDocument(page, fileName);
      await submitRequest(page, request);
      const row = page.getByRole('row').filter({ hasText: fileName });
      await expect(row).toContainText('Đã gửi kèm lần 1');
      await expect(row.getByRole('button', { name: 'Xóa', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tải hồ sơ lên', exact: true })).toBeVisible();
    });

    test('F13-TC_029 Rút khi chưa ai duyệt', async ({ page, browser }) => {
      const { request } = await buildPendingRequest(browser);
      await withRequestRole(browser, 'R4', async (reviewer) => {
        await reviewer.goto('/approval-queue');
        await expect(reviewer.getByRole('row').filter({ hasText: request.requestCode })).toBeVisible();
      });
      await withdrawRequest(page, request);
      await withRequestRole(browser, 'R4', async (reviewer) => {
        await reviewer.goto('/approval-queue');
        await expect(reviewer.getByRole('heading', { level: 2 })).toBeVisible();
        await expect(reviewer.getByRole('row').filter({ hasText: request.requestCode })).toHaveCount(0);
      });
    });

    test('F13-TC_032 Đã rút không tiếp tục soạn', async ({ page, browser }) => {
      const { request } = await buildPendingRequest(browser);
      await withdrawRequest(page, request);
      await page.goto(`/change-requests/${request.id}/edit`);
      await expect(page).toHaveURL(new RegExp(`/change-requests/${request.id}$`));
      await expect(page.getByText('Đã rút', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tiếp tục soạn', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Gửi duyệt$/ })).toHaveCount(0);
    });
  });

  test.describe('R3 tạo trong phạm vi và không sửa Nháp người khác', () => {
    test.use(asRole('R3'));

    test('F13-TC_010 Nháp của người khác không mở sửa được', async ({ page, browser }) => {
      const request = await withRequestRole(browser, 'R1', async (admin) => seedRequest(admin, await buildReleaseProgram(admin), false));
      await page.goto(`/change-requests/${request.id}/edit`);
      await expect(page.getByText('Không tìm thấy đề xuất', { exact: true })).toBeVisible();
    });

    test('F13-TC_031 Bỏ qua tự duyệt không cản rút', async ({ page, browser }) => {
      const program = await buildAdminReleaseProgram(browser);
      const request = await seedRequest(page, program, false);
      await submitRequest(page, request);
      await expect(page.getByText('Chờ Phòng Đào tạo duyệt', { exact: true })).toBeVisible();
      await withdrawRequest(page, request);
    });

    test('F13-TC_047 Chưa có thay đổi không gửi được', async ({ page, browser }) => {
      await prepareRequest(page, await buildAdminReleaseProgram(browser));
      await saveRequest(page);
      await page.getByRole('button', { name: /Gửi duyệt$/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Gửi đề xuất đi duyệt' });
      await expect(dialog.getByText('Đề xuất chưa có thay đổi nào so với bản đang áp dụng.', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Gửi', exact: true })).toBeDisabled();
    });
  });

  test.describe('R5 ngoài nhóm', () => {
    test.use(asRole('R5b'));
    test('F13-TC_009 Không tạo cho học phần ngoài nhóm', async ({ page, browser }) => {
      await prepareRequest(page, await buildAdminReleaseProgram(browser), { course: true });
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Đối tượng này nằm ngoài phạm vi được phân công của bạn.', { exact: true })).toBeVisible();
    });
  });

  test.describe('R2 chỉ đề xuất tổ chức', () => {
    test.use(asRole('R2'));
    test('F13-TC_035 Không có lựa chọn tạo dữ liệu', async ({ page }) => {
      await page.goto('/change-requests');
      await expect(page.getByRole('heading', { name: 'Đề xuất thay đổi', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Tạo đề xuất$/ })).toHaveCount(0);
      await page.goto('/change-requests/new');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });

  test.describe('R3 không phải Giám đốc', () => {
    test.use(asRole('R3b'));
    test('F13-TC_049 Không tạo cho chương trình ngoài phạm vi', async ({ page, browser }) => {
      await prepareRequest(page, await buildAdminReleaseProgram(browser));
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Đối tượng này nằm ngoài phạm vi được phân công của bạn.', { exact: true })).toBeVisible();
    });
  });

  test.describe('R4 ngoài nhóm', () => {
    test.use(asRole('R4b'));
    test('F13-TC_050 Không tạo nội dung học phần ngoài nhóm', async ({ page, browser }) => {
      await prepareRequest(page, await buildAdminReleaseProgram(browser), { course: true });
      await page.getByRole('button', { name: /Tạo đề xuất$/ }).click();
      await expect(page.getByText('Đối tượng này nằm ngoài phạm vi được phân công của bạn.', { exact: true })).toBeVisible();
    });
  });

  test.describe('R6 không được tạo', () => {
    test.use(asRole('R6'));
    test('F13-TC_051 Không mở form tạo đề xuất', async ({ page }) => {
      await page.goto('/change-requests/new');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
});
