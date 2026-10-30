import { expect, test, type Page } from '@playwright/test';
import { asRole } from '../fixtures/accounts.js';
import { chooseOption } from '../fixtures/select.js';
import {
  cancelCourse,
  courseData,
  createCourse,
  discontinueCourse,
  openSeedCourse,
  openStatusAction,
  prepareCourse,
} from '../fixtures/courses.js';
import { uniqueSuffix } from '../fixtures/unique.js';

async function expectCreditRejected(page: Page, value: string) {
  await prepareCourse(page, { credits: value });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText(courseData.creditError, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/courses\/new$/);
}

async function expectFieldRejected(page: Page, field: string, value: string, message: string) {
  await prepareCourse(page);
  await page.getByLabel(field, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/courses\/new$/);
}

async function expectNoEdit(page: Page, code: string) {
  await openSeedCourse(page, code);
  await expect(page.getByText('Thông tin học phần', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0);
}

async function expectNoStatus(page: Page) {
  await openSeedCourse(page, 'PRG101');
  await expect(page.getByText('Thông tin học phần', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi trạng thái', exact: true })).toHaveCount(0);
}

async function searchCourses(page: Page, text: string) {
  const search = page.getByPlaceholder('Tìm theo mã hoặc tên học phần');
  await search.fill(text);
  await search.press('Enter');
}

test.describe('F-04 Danh mục học phần', () => {
  test.use(asRole('R1'));

  test('F04-TC_001 Kiểm tra tìm theo một phần mã học phần', async ({ page }) => {
    await page.goto('/courses');
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill('prg');
    await expect(page.getByRole('link', { name: 'PRG101', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'MAT101', exact: true })).toHaveCount(0);
  });

  test('F04-TC_002 Kiểm tra tìm theo một phần tên tiếng Việt', async ({ page }) => {
    await page.goto('/courses');
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill('Giải tích');
    await expect(page.getByRole('link', { name: 'MAT101', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'PRG101', exact: true })).toHaveCount(0);
  });

  test('F04-TC_005 Kiểm tra sắp xếp mã học phần giảm dần', async ({ page }) => {
    await page.goto('/courses');
    const codeHeader = page.getByRole('columnheader', { name: /^Mã( |$)/ });
    await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
    await codeHeader.click();
    await expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
    const codeLinks = page.getByRole('table').getByRole('link');
    await expect.poll(async () => {
      const codes = await codeLinks.allTextContents();
      return codes.length > 1 && codes.every((code, index) => index === 0 || codes[index - 1]! >= code);
    }).toBe(true);
  });

  test('F04-TC_006 Kiểm tra thông tin chi tiết học phần', async ({ page }) => {
    await openSeedCourse(page, 'PRG101');
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    for (const value of ['PRG101', 'Nhập môn lập trình', 'Introduction to Programming', '3', 'Lý thuyết', 'Đang sử dụng', courseData.homeFaculty, courseData.homeGroup]) {
      await expect(info.getByText(value, { exact: true })).toBeVisible();
    }
  });

  test('F04-TC_007 Kiểm tra tìm kiếm không có kết quả', async ({ page }) => {
    await page.goto('/courses');
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(`NO${uniqueSuffix()}`);
    await expect(page.getByText('Chưa có học phần', { exact: true })).toBeVisible();
    await expect(page.getByRole('table').getByRole('link')).toHaveCount(0);
  });

  test('F04-TC_010 Kiểm tra R6 không thấy học phần đã hủy', async ({ page, browser, baseURL }) => {
    const course = await createCourse(page);
    await cancelCourse(page);
    const reader = await browser.newContext({ ...asRole('R6'), baseURL, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    try {
      const student = await reader.newPage();
      await student.goto('/courses');
      await student.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(course.code);
      await expect(student.getByText('Chưa có học phần', { exact: true })).toBeVisible();
      await student.goto(course.path);
      await expect(student.getByText('Không tìm thấy học phần', { exact: true })).toBeVisible();
    } finally {
      await reader.close();
    }
  });

  test('F04-TC_012 Kiểm tra lưu học phần 2.5 tín chỉ không có tên Anh', async ({ page }) => {
    const course = await createCourse(page);
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('2.5', { exact: true })).toBeVisible();
    await expect(info.getByRole('row').filter({ hasText: 'Tên tiếng Anh' }).getByText('—', { exact: true })).toBeVisible();
    await page.goto('/courses');
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(course.code);
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: course.code, exact: true }) }).getByRole('cell', { name: '2.5', exact: true })).toBeVisible();
  });

  test('F04-TC_013 Kiểm tra lưu học phần điều kiện 0 tín chỉ', async ({ page }) => {
    const course = await createCourse(page, { credits: '0', type: 'Học phần điều kiện' });
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('0', { exact: true })).toBeVisible();
    await expect(info.getByText('Học phần điều kiện', { exact: true })).toBeVisible();
    await page.goto('/courses');
    await page.getByPlaceholder('Tìm theo mã hoặc tên học phần', { exact: true }).fill(course.code);
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: course.code, exact: true }) }).getByRole('cell', { name: '0', exact: true })).toBeVisible();
  });

  test('F04-TC_014 Kiểm tra sửa số tín chỉ', async ({ page }) => {
    const course = await createCourse(page);
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    await page.getByLabel('Số tín chỉ', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByRole('heading', { name: `${course.code} — ${course.name}`, exact: true })).toBeVisible();
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('3', { exact: true })).toBeVisible();
  });

  test('F04-TC_015 Kiểm tra không sửa được mã sau khi tạo', async ({ page }) => {
    const course = await createCourse(page);
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    await expect(page.getByLabel('Mã học phần', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Mã học phần', { exact: true })).toHaveValue(course.code);
  });

  test('F04-TC_016 Kiểm tra mã học phần trùng', async ({ page }) => {
    const course = await createCourse(page);
    await prepareCourse(page, { code: course.code });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Mã học phần đã tồn tại.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/courses\/new$/);
  });

  test('F04-TC_017 Kiểm tra chặn tín chỉ âm', async ({ page }) => {
    await expectCreditRejected(page, '-1');
  });
  test('F04-TC_018 Kiểm tra chặn tín chỉ không phải số', async ({ page }) => {
    await expectCreditRejected(page, 'abc');
  });
  test('F04-TC_019 Kiểm tra bắt buộc nhập tín chỉ', async ({ page }) => {
    await expectFieldRejected(page, 'Số tín chỉ', '', 'Nhập số tín chỉ.');
  });
  test('F04-TC_020 Kiểm tra biên trên 999.99 tín chỉ', async ({ page }) => {
    await createCourse(page, { credits: '999.99' });
    await expect(page.getByText('999.99', { exact: true })).toBeVisible();
  });
  test('F04-TC_021 Kiểm tra chặn tín chỉ vượt biên', async ({ page }) => {
    await expectCreditRejected(page, '1000');
  });
  test('F04-TC_022 Kiểm tra chặn ba chữ số thập phân', async ({ page }) => {
    await expectCreditRejected(page, '2.555');
  });
  test('F04-TC_023 Kiểm tra chặn dấu phẩy thập phân', async ({ page }) => {
    await expectCreditRejected(page, '2,5');
  });
  test('F04-TC_024 Kiểm tra bắt buộc nhập mã', async ({ page }) => {
    await expectFieldRejected(page, 'Mã học phần', '', 'Nhập mã học phần.');
  });
  test('F04-TC_025 Kiểm tra bắt buộc nhập tên Việt', async ({ page }) => {
    await expectFieldRejected(page, 'Tên tiếng Việt', '', 'Nhập tên tiếng Việt của học phần.');
  });
  test('F04-TC_026 Kiểm tra bắt buộc chọn loại', async ({ page }) => {
    await page.goto('/courses/new');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Chọn loại học phần.', { exact: true })).toBeVisible();
  });
  test('F04-TC_027 Kiểm tra bắt buộc chọn khoa', async ({ page }) => {
    await page.goto('/courses/new');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Chọn khoa phụ trách.', { exact: true })).toBeVisible();
  });
  test('F04-TC_028 Kiểm tra mã dài đúng 20 ký tự', async ({ page }) => {
    await createCourse(page, { code: `E2E${uniqueSuffix()}X` });
  });
  test('F04-TC_029 Kiểm tra mã vượt 20 ký tự', async ({ page }) => {
    await expectFieldRejected(page, 'Mã học phần', `E2E${uniqueSuffix()}XX`, 'Mã học phần tối đa 20 ký tự.');
  });
  test('F04-TC_030 Kiểm tra tên Việt dài đúng 200 ký tự', async ({ page }) => {
    await createCourse(page, { name: 'V'.repeat(200) });
  });
  test('F04-TC_031 Kiểm tra tên Việt vượt 200 ký tự', async ({ page }) => {
    await expectFieldRejected(page, 'Tên tiếng Việt', 'V'.repeat(201), 'Tên học phần tối đa 200 ký tự.');
  });
  test('F04-TC_032 Kiểm tra tên Anh dài đúng 200 ký tự', async ({ page }) => {
    await createCourse(page, { englishName: 'E'.repeat(200) });
    await expect(page.getByText('E'.repeat(200), { exact: true })).toBeVisible();
  });
  test('F04-TC_033 Kiểm tra tên Anh vượt 200 ký tự', async ({ page }) => {
    await expectFieldRejected(page, 'Tên tiếng Anh', 'E'.repeat(201), 'Tên tiếng Anh tối đa 200 ký tự.');
  });
  test('F04-TC_034 Kiểm tra tên Việt chỉ có khoảng trắng', async ({ page }) => {
    await expectFieldRejected(page, 'Tên tiếng Việt', '   ', 'Nhập tên tiếng Việt của học phần.');
  });
  test('F04-TC_035 Kiểm tra chuẩn hóa mã thành chữ hoa và bỏ khoảng trắng', async ({ page }) => {
    const code = `e${uniqueSuffix().toLowerCase()}`;
    const course = await createCourse(page, { code: ` ${code} ` });
    await expect(page.getByRole('heading', { level: 2 })).toContainText(course.code);
  });

  test('F04-TC_036 Kiểm tra tạo học phần khoa khác không có nhóm', async ({ page }) => {
    await createCourse(page, { foreign: true });
    await expect(page.getByText(`${courseData.foreignFaculty} (Khoa khác)`, { exact: true })).toBeVisible();
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByRole('row').filter({ hasText: 'Nhóm phụ trách' }).getByText('—', { exact: true })).toBeVisible();
  });

  test('F04-TC_037 Kiểm tra lọc theo khoa phụ trách', async ({ page }) => {
    await page.goto('/courses');
    // The unlabelled faculty combobox is the first filter; subsequent comboboxes filter group, type and status.
    await chooseOption(page, page.getByRole('combobox').nth(0), courseData.foreignFaculty, {
      search: courseData.foreignFaculty,
    });
    // Real data fills several pages; narrow to the two world courses being compared.
    await searchCourses(page, 'MAT101');
    await expect(page.getByRole('link', { name: 'MAT101', exact: true })).toBeVisible();
    await searchCourses(page, 'PRG101');
    await expect(page.getByRole('link', { name: 'PRG101', exact: true })).toHaveCount(0);
  });

  test('F04-TC_038 Kiểm tra lọc nguồn học phần khoa khác', async ({ page }) => {
    await page.goto('/courses');
    const origin = page.getByRole('radiogroup', { name: 'segmented control', exact: true });
    await origin.getByText('Khoa khác', { exact: true }).click();
    await expect(origin.getByRole('radio', { name: 'Khoa khác', exact: true })).toBeChecked();
    await searchCourses(page, 'MAT101');
    await expect(page.getByRole('link', { name: 'MAT101', exact: true })).toBeVisible();
    await searchCourses(page, 'PRG101');
    await expect(page.getByRole('link', { name: 'PRG101', exact: true })).toHaveCount(0);
  });

  test('F04-TC_055 Kiểm tra ngừng mở lớp khi chưa có thay thế', async ({ page }) => {
    await createCourse(page);
    const dialog = await openStatusAction(page, 'Ngừng mở lớp');
    await expect(dialog.getByText('Chọn học phần thay thế (bắt buộc):', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Ngừng mở lớp', exact: true })).toBeDisabled();
  });

  test('F04-TC_056 Kiểm tra ngừng mở lớp với học phần thay thế', async ({ page }) => {
    await createCourse(page);
    await discontinueCourse(page);
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('Ngừng mở lớp', { exact: true })).toBeVisible();
  });

  test('F04-TC_057 Kiểm tra mở lại học phần đã ngừng', async ({ page }) => {
    await createCourse(page);
    await discontinueCourse(page);
    const dialog = await openStatusAction(page, 'Mở lại');
    await dialog.getByRole('button', { name: 'Mở lại', exact: true }).click();
    await expect(page.getByText('Đã chuyển sang Đang sử dụng.', { exact: true })).toBeVisible();
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('Đang sử dụng', { exact: true })).toBeVisible();
  });

  test('F04-TC_058 Kiểm tra cảnh báo không hoàn tác khi hủy', async ({ page }) => {
    const course = await createCourse(page);
    const dialog = await openStatusAction(page, 'Hủy học phần');
    await expect(dialog).toContainText(`Hủy học phần ${course.code}?`);
    await expect(dialog.getByText(courseData.cancelWarning, { exact: true })).toBeVisible();
  });

  test('F04-TC_059 Kiểm tra xác nhận hủy học phần chưa dùng', async ({ page }) => {
    await createCourse(page);
    await cancelCourse(page);
    const info = page.getByRole('table').filter({ has: page.getByText('Mã học phần', { exact: true }) });
    await expect(info.getByText('Đã hủy', { exact: true })).toBeVisible();
  });

  test('F04-TC_060 Kiểm tra học phần đã hủy không có thao tác sửa hay mở lại', async ({ page }) => {
    await createCourse(page);
    await cancelCourse(page);
    await expect(page.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Đổi trạng thái', exact: true })).toHaveCount(0);
  });

  test('F04-TC_063 Kiểm tra không có chức năng xóa cứng học phần', async ({ page }) => {
    await openSeedCourse(page, 'PRG101');
    await expect(page.getByRole('button', { name: /Xóa học phần|Xóa vĩnh viễn/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Đổi trạng thái', exact: true })).toBeVisible();
  });

  test('F04-TC_069 Kiểm tra đường dẫn học phần không tồn tại', async ({ page }) => {
    await page.goto(`/courses/absent-${uniqueSuffix()}`);
    await expect(page.getByText('Không tìm thấy học phần', { exact: true })).toBeVisible();
  });

  test.describe('R2', () => {
    test.use(asRole('R2'));
    test('F04-TC_042 Kiểm tra R2 không được thêm học phần', async ({ page }) => {
      await page.goto('/courses');
      await expect(page.getByRole('heading', { name: 'Danh mục học phần', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Thêm học phần', exact: true })).toHaveCount(0);
      await page.goto('/courses/new');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
    test('F04-TC_044 Kiểm tra R2 không được sửa học phần', async ({ page }) => {
      await expectNoEdit(page, 'PRG101');
    });
    test('F04-TC_067 Kiểm tra R2 không được đổi trạng thái', async ({ page }) => {
      await expectNoStatus(page);
    });
  });

  test.describe('R3', () => {
    test.use(asRole('R3'));
    test('F04-TC_048 Kiểm tra R3 không sửa trực tiếp học phần khoa khác', async ({ page }) => {
      await expectNoEdit(page, 'MAT101');
      await expect(page.getByRole('button', { name: 'Tạo đề xuất', exact: true })).toBeVisible();
    });
    test('F04-TC_064 Kiểm tra R3 không được đổi trạng thái', async ({ page }) => {
      await expectNoStatus(page);
    });
  });

  test.describe('R4', () => {
    test.use(asRole('R4'));
    test('F04-TC_046 Kiểm tra R4 không sửa học phần ngoài nhóm', async ({ page }) => {
      await expectNoEdit(page, 'SWE301');
    });
    test('F04-TC_049 Kiểm tra R4 không sửa học phần khoa khác', async ({ page }) => {
      await expectNoEdit(page, 'MAT101');
    });
    test('F04-TC_065 Kiểm tra R4 không được đổi trạng thái', async ({ page }) => {
      await expectNoStatus(page);
    });
  });

  test.describe('R5', () => {
    test.use(asRole('R5'));
    test('F04-TC_047 Kiểm tra R5 không sửa học phần ngoài nhóm', async ({ page }) => {
      await expectNoEdit(page, 'SWE301');
    });
    test('F04-TC_050 Kiểm tra R5 không sửa học phần khoa khác', async ({ page }) => {
      await expectNoEdit(page, 'MAT101');
    });
    test('F04-TC_053 Kiểm tra giới hạn tạo học phần của R5', async ({ page }) => {
      await prepareCourse(page);
      await expect(page.getByLabel('Nhóm phụ trách', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Lưu', exact: true }).click();
      await expect(page.getByText('Đối tượng này nằm ngoài phạm vi được phân công của bạn.', { exact: true })).toBeVisible();
    });
    test('F04-TC_066 Kiểm tra R5 không được đổi trạng thái', async ({ page }) => {
      await expectNoStatus(page);
    });
  });

  test.describe('R6', () => {
    test.use(asRole('R6'));
    test('F04-TC_009 Kiểm tra R6 tra cứu được danh mục', async ({ page }) => {
      await openSeedCourse(page, 'PRG101');
      await expect(page.getByText('Thông tin học phần', { exact: true })).toBeVisible();
    });
    test('F04-TC_011 Kiểm tra R6 không thấy bản đề cương Nháp', async ({ page }) => {
      await openSeedCourse(page, 'PRG101');
      // AntD icons prepend their aria-label ("file-text") to the button's accessible name.
      const syllabusButton = page.getByRole('button', { name: /Đề cương$/ });
      await expect(syllabusButton).toBeVisible();
      await syllabusButton.click();
      await expect(page.getByText('Học phần chưa có đề cương', { exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Nháp', exact: true })).toHaveCount(0);
    });
    test('F04-TC_043 Kiểm tra R6 không được thêm học phần', async ({ page }) => {
      await page.goto('/courses');
      await expect(page.getByRole('heading', { name: 'Danh mục học phần', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Thêm học phần', exact: true })).toHaveCount(0);
      await page.goto('/courses/new');
      await expect(page.getByText('Bạn không có quyền truy cập trang này', { exact: true })).toBeVisible();
    });
    test('F04-TC_045 Kiểm tra R6 không được sửa học phần', async ({ page }) => {
      await expectNoEdit(page, 'PRG101');
    });
    test('F04-TC_068 Kiểm tra R6 không được đổi trạng thái', async ({ page }) => {
      await expectNoStatus(page);
    });
  });
});
