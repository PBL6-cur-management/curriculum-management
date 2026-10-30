import { expect, test } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import { chooseOption } from '../fixtures/select.js';
import { uniqueSuffix } from '../fixtures/unique.js';
import { createOrgUnit, createSubjectGroup } from '../fixtures/organization.js';

test.describe('F-03 Đơn vị và nhóm chuyên môn', () => {
  test.use(asRole('R1'));

  test('F03-TC_001 Kiểm tra cây đơn vị và bốn nhóm', async ({ page }) => {
    await page.goto('/org-units');
    const tree = page.getByRole('tree');
    for (const name of ['Trường Đại học Bách khoa – Đại học Đà Nẵng', 'Khoa Công nghệ Thông tin', 'Phòng Đào tạo', 'Khoa học máy tính', 'Công nghệ phần mềm', 'Hệ thống thông tin', 'Mạng và truyền thông']) {
      // A tree node's text also carries its type tag ("Khoa", "Nhóm chuyên môn").
      await expect(tree.getByRole('treeitem').filter({ hasText: name }).first()).toBeVisible();
    }
  });

  test('F03-TC_002 Kiểm tra thêm khoa riêng', async ({ page }) => {
    const unit = await createOrgUnit(page);
    await expect(page.getByRole('tree').getByText(unit.name)).toBeVisible();
  });

  test('F03-TC_005 Kiểm tra mã đơn vị bắt buộc', async ({ page }) => {
    await page.goto('/org-units');
    await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Nhập mã đơn vị', { exact: true })).toBeVisible();
  });

  test('F03-TC_006 Kiểm tra mã đơn vị vượt giới hạn', async ({ page }) => {
    await page.goto('/org-units');
    await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
    await page.getByLabel('Mã đơn vị', { exact: true }).fill('U'.repeat(33));
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Mã đơn vị tối đa 32 ký tự', { exact: true })).toBeVisible();
  });

  test('F03-TC_007 Kiểm tra mã đơn vị không hợp lệ', async ({ page }) => {
    await page.goto('/org-units');
    await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
    await page.getByLabel('Mã đơn vị', { exact: true }).fill('KHOA-THỬ');
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Chỉ dùng chữ không dấu, số và dấu gạch dưới', { exact: true })).toBeVisible();
  });

  test('F03-TC_008 Kiểm tra trùng mã đơn vị riêng', async ({ page }) => {
    const unit = await createOrgUnit(page);
    await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mã đơn vị', { exact: true }).fill(unit.code);
    await dialog.getByLabel('Tên đơn vị', { exact: true }).fill(`Khoa khác ${uniqueSuffix()}`);
    await dialog.getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(dialog.getByText('Mã đơn vị đã tồn tại.', { exact: true })).toBeVisible();
  });

  test('F03-TC_009 Kiểm tra tên đơn vị bắt buộc', async ({ page }) => {
    await page.goto('/org-units');
    await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Nhập tên đơn vị', { exact: true })).toBeVisible();
  });

  test('F03-TC_014 Kiểm tra thêm nhóm riêng', async ({ page }) => {
    const group = await createSubjectGroup(page);
    await expect(page.getByRole('link', { name: group.name, exact: true })).toBeVisible();
  });

  test('F03-TC_015 Kiểm tra trùng mã nhóm riêng', async ({ page }) => {
    const group = await createSubjectGroup(page);
    await page.getByRole('button', { name: 'Thêm nhóm', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mã nhóm', { exact: true }).fill(group.code);
    await dialog.getByLabel('Tên nhóm', { exact: true }).fill(`Nhóm khác ${uniqueSuffix()}`);
    // OrgUnitSelect does not forward the Form.Item id to its combobox.
    await chooseOption(page, dialog.getByRole('combobox'), 'Khoa Công nghệ Thông tin');
    await dialog.getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(dialog.getByText('Mã nhóm chuyên môn đã tồn tại.', { exact: true })).toBeVisible();
  });

  test('F03-TC_019 Kiểm tra mã nhóm bắt buộc', async ({ page }) => {
    await page.goto('/subject-groups');
    await page.getByRole('button', { name: 'Thêm nhóm', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Nhập mã nhóm', { exact: true })).toBeVisible();
  });

  test('F03-TC_020 Kiểm tra mã nhóm vượt giới hạn', async ({ page }) => {
    await page.goto('/subject-groups');
    await page.getByRole('button', { name: 'Thêm nhóm', exact: true }).click();
    await page.getByLabel('Mã nhóm', { exact: true }).fill('G'.repeat(33));
    await page.getByRole('dialog').getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await expect(page.getByText('Mã nhóm tối đa 32 ký tự', { exact: true })).toBeVisible();
  });

  test('F03-TC_035 Kiểm tra nhóm chưa có điều phối', async ({ page }) => {
    const group = await createSubjectGroup(page);
    await page.getByRole('link', { name: group.name, exact: true }).click();
    const details = page.getByRole('main').filter({
      has: page.getByText(`(${group.code})`, { exact: true }),
    });
    await expect(details.getByRole('alert').getByText('Chưa có Điều phối', { exact: true })).toBeVisible();
  });

  test.describe('R2', () => {
    test.use(asRole('R2'));
    test('F03-TC_036 Kiểm tra R2 không quản lý cây', async ({ page }) => {
      await page.goto('/org-units');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
  test.describe('R3', () => {
    test.use(asRole('R3'));
    test('F03-TC_037 Kiểm tra R3 không quản lý cây', async ({ page }) => {
      await page.goto('/org-units');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
    test('F03-TC_043 Kiểm tra R3 không quản lý nhóm', async ({ page }) => {
      await page.goto('/subject-groups');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
  test.describe('R4', () => {
    test.use(asRole('R4'));
    test('F03-TC_038 Kiểm tra R4 không quản lý cây', async ({ page }) => {
      await page.goto('/org-units');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
  test.describe('R5', () => {
    test.use(asRole('R5'));
    test('F03-TC_039 Kiểm tra R5 không quản lý cây', async ({ page }) => {
      await page.goto('/org-units');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
    test('F03-TC_044 Kiểm tra R5 không quản lý nhóm', async ({ page }) => {
      await page.goto('/subject-groups');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
  test.describe('R6', () => {
    test.use(asRole('R6'));
    test('F03-TC_040 Kiểm tra R6 không quản lý cây', async ({ page }) => {
      await page.goto('/org-units');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
    test('F03-TC_045 Kiểm tra R6 không quản lý nhóm', async ({ page }) => {
      await page.goto('/subject-groups');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
  });
});
