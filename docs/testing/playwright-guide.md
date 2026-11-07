# Hướng dẫn Playwright — pilot danh mục học phần

## 1. Suite này là gì?

`source/e2e/` là dự án pnpm **độc lập**; không phải workspace, không import hay phụ thuộc package backend/frontend. Playwright dùng giao diện đăng nhập thật và trình duyệt Chromium, chỉ giao tiếp HTTP với app đang chạy. Không có `webServer`: suite không khởi động, seed, migrate hoặc reset ứng dụng. Spec đầu tiên là `specs/f-04-course-catalog.spec.ts`; quy ước và truy vết tại [test-cases/README.md](./test-cases/README.md).

Các lệnh dưới đây đều một dòng, chạy bằng PowerShell; vị trí được ghi ngay trước lệnh. Không cần chạy chúng để chỉ đọc tài liệu. Kết quả chạy từng tính năng nằm ở dòng "Trạng thái" của tài liệu ca kiểm thử tương ứng.

## 2. Điều kiện trước khi chạy

> **Tài khoản và mật khẩu:** nguồn chính là [`docs/ACCOUNTS.md`](../ACCOUNTS.md). Ở đó có tài khoản theo vai, thế giới `e2e.*`, các biến `SEED_ADMIN_PASSWORD` / `E2E_ADMIN_PASSWORD` / `E2E_PASSWORD` và cách dựng hoặc gỡ bằng `pnpm e2e:world` / `pnpm e2e:purge`. Danh sách tài khoản demo bên dưới là của bản pilot cũ; khi lệch, theo ACCOUNTS.md.

- Node.js 22, tối thiểu 22.22; pnpm 10.23.0; PostgreSQL và Redis đã hoạt động. Dùng DB phát triển dành cho kiểm thử, không dùng production.
- Theo [setup-and-test-guide.md](./setup-and-test-guide.md) §1: người dùng cài backend/frontend, áp migration và sinh Prisma client nếu cần. Từ `source/backend`, chạy `pnpm services:up`, `pnpm prisma:migrate`, `pnpm prisma:seed`, rồi `pnpm prisma:seed:demo` theo thứ tự; mỗi lệnh chạy riêng, không nối bằng toán tử shell.
- `SEED_ADMIN_PASSWORD` và `SEED_DEMO_PASSWORD` đã cấu hình ở backend; không ghi mật khẩu thật vào tài liệu. Nếu cần đặt trong PowerShell, dùng `$env:SEED_ADMIN_PASSWORD = '<mật khẩu do bạn chọn>'` và `$env:SEED_DEMO_PASSWORD = '<mật khẩu do bạn chọn>'` trước lệnh seed; không dùng cú pháp gán biến của Bash.
- Khởi động backend bằng `pnpm dev` tại `source/backend` và frontend bằng `pnpm dev` tại `source/frontend`, trong hai terminal riêng. Backend: `http://localhost:3000`; frontend: `http://localhost:5173`, Vite proxy `/api` tới backend. Suite truy cập frontend origin, không gọi chéo cổng backend để đăng nhập.
- `admin` bị buộc đổi mật khẩu lần đầu: đăng nhập thủ công và hoàn tất tại trang tài khoản **trước khi chạy**. Suite không tự đổi mật khẩu. `E2E_ADMIN_PASSWORD` phải là mật khẩu hiện tại (sau đổi), không nhất thiết còn bằng mật khẩu seed.
- Demo tạo 8 tài khoản dùng chung `SEED_DEMO_PASSWORD`, không buộc đổi lần đầu: r2.lanhdao, r3.giamdoc, r3.giamdoc2, r4.dieuphoi, r4.dieuphoi2, r5.giangvien, r5.giangvien2, r6.sinhvien. Seed chạy lại không ghi đè mật khẩu đã đổi.
- Demo có bốn nhóm KHMT/CNPM/HTTT/MMT, 17 học phần, ITS100 (0 tín chỉ), MAT101 (khoa khác), đề cương Nháp và khung Nháp. Giữ nguyên các fixture seed; nhất là PRG101 chưa có đề cương Ban hành cho ca F04-TC_011. Không đòi danh mục chỉ có đúng 17 dòng sau khi suite đã tạo dữ liệu.

## 3. Cài đặt một lần

Từ repo root: `Set-Location source/e2e`.

| Thao tác tại `source/e2e` | Lệnh PowerShell |
|---|---|
| Cài dependency đã ghim | `pnpm install` |
| Cài Chromium | `pnpm browsers` |
| Tạo cấu hình cá nhân, chỉ làm nếu chưa có .env | `Copy-Item .env.example .env` |
| Kiểm kiểu khi đã cài dependency | `pnpm typecheck` |

Mở `.env` trong editor của bạn và điền E2E_ADMIN_PASSWORD, E2E_DEMO_PASSWORD. E2E_DEMO_PASSWORD phải khớp mật khẩu demo hiện tại; không dùng chuỗi ví dụ như mật khẩu thật. Có thể đổi E2E_ADMIN_USERNAME (mặc định admin). E2E_BASE_URL mặc định `http://localhost:5173`; dùng đúng một hostname ổn định, không trộn localhost với 127.0.0.1 vì cookie theo origin.

Mỗi lần chạy, project `setup` đăng nhập một lần cho từng tài khoản và ghi `.auth/<username>.json`; project `chromium` phụ thuộc setup. Thiếu một trong hai biến mật khẩu thì config dừng ngay với tên biến thiếu. Nếu setup thất bại, ca phụ thuộc không được coi là lỗi chức năng F-04. `.env`, `.auth/`, kết quả và report đều bị gitignore; phiên là dữ liệu nhạy cảm, không chia sẻ. Setup tắt trace/screenshot để tránh ghi thao tác nhập mật khẩu.

## 4. Chạy suite

Mọi lệnh trong bảng chạy tại `source/e2e` sau khi app đã chạy và `.env` đủ:

| Mục đích | Lệnh |
|---|---|
| Tất cả ca | `pnpm test` |
| Một tính năng | `pnpm test specs/f-04-course-catalog.spec.ts` |
| Một ca | `pnpm test -g "F04-TC_007"` |
| Có cửa sổ trình duyệt | `pnpm test:headed` |
| UI mode | `pnpm test:ui` |
| Debug một ca | `pnpm test -g "F04-TC_007" --debug` |
| Mở HTML report | `pnpm report` |
| Xem trace của ca lỗi | `pnpm exec playwright show-trace 'test-results/<thư mục ca lỗi>/trace.zip'` |
| Ghi thao tác và gợi ý locator | `pnpm codegen` |

Đường dẫn trace là mẫu: thay bằng đường dẫn `trace.zip` thật trong report. Config có list reporter và HTML reporter không tự mở; trace chỉ giữ khi lỗi, screenshot chỉ chụp khi lỗi. Report có thể chứa nội dung học phần/phiên, không công khai tùy tiện.

`pnpm test:ui`: nếu Playwright UI không chạy project dependency tự động, bật project `setup` trong bộ lọc và chạy setup trước khi chạy ca Chromium. Tương tự, nếu bạn dùng `--no-deps` hoặc chạy file từ extension, phải chủ động chạy setup lại khi phiên hết hạn. Không tái sử dụng `.auth` của một origin khác.

Mặc định một worker, không retry để kết quả dễ đọc và giảm ghi đồng thời. Mỗi ca độc lập; thứ tự chạy không được dùng làm điều kiện đúng. Các ca tạo mã mới mỗi lần, không reset DB và không xóa dữ liệu sau chạy. Test chỉ đổi trạng thái học phần do chính nó tạo; ITS100 được chọn làm đích thay thế nhưng không sửa ITS100.

## 5. Ghi kết quả trở lại test-case doc

Tên test bắt đầu bằng TC_ID, ví dụ `F04-TC_007 Kiểm tra …`; tìm đúng dòng trong [F-04 test cases](./test-cases/f-04-course-catalog-test-cases.md). Playwright không tự sửa Markdown.

| Tình huống | Cách ghi |
|---|---|
| Ca thực sự chạy và đạt | Is Test? = Yes; Test Result = Passed |
| Ca thực sự chạy và sai expected | Is Test? = Yes; Test Result = Failed; Note thêm actual và đường dẫn report/trace |
| Không thể chạy do dữ liệu/dịch vụ/mật khẩu | Khi đã thử thực thi: Is Test? = Yes; Test Result = Blocked; Note ghi trở ngại. Không biến lỗi môi trường thành Failed của tính năng. |
| Ca chưa được chọn/chưa thử chạy | Giữ Is Test? = No và ba cột thực thi để trống. Việc setup lỗi không đồng nghĩa mọi ca đã được thực thi. |
| Đã xác nhận ca không áp dụng | Test Result = N/A, ghi lý do và người quyết định, không dùng thay cho thiếu dữ liệu |

Với ca chạy tự động, Executed On dùng ngày thực tế `MM/DD/YY`, Executed By = `Playwright (auto)`. Với kiểm tay, ghi tên người thực hiện. Giữ nguyên tiền tố `Tự động:` trong Note; có test không có nghĩa đã Passed. Không điền ngày dự kiến vào cột Executed On.

## 6. Thêm ca hoặc tính năng

1. Đọc story/AC, BR/EC, test-plan, implement report và code thật; viết dòng ca **trước**, gán TC_ID kế tiếp và cập nhật bảng Truy vết. Áp dụng code-wins kèm Note, không âm thầm sửa expected theo phỏng đoán.
2. Chỉ tự động hóa hành vi trình duyệt quan sát xác định được. Tạo test tiêu đề bắt đầu đúng TC_ID, đặt trong describe của tính năng; thêm Note `Tự động: <TC_ID> trong specs/<file>.spec.ts`. Không tự động hóa việc cần bảng/màn hình chưa có hoặc thay đổi frontend.
3. Dùng `pnpm codegen` tại source/e2e để ghi UI; codegen mở origin localhost:5173 cố định theo script (đổi script có chủ đích nếu dùng origin khác). Đăng nhập khi cần; rà soát và bỏ mọi mật khẩu thật khỏi đoạn code sinh ra trước khi lưu. Không commit output chứa thông tin đăng nhập.
4. Ưu tiên getByRole/getByLabel/getByPlaceholder/getByText với đúng nhãn tiếng Việt. OrgUnitSelect không chuyển tiếp id do Form.Item truyền, nên bộ lọc khoa dùng combobox đầu tiên, form dùng combobox thứ hai; helper đã giải thích bằng comment. Không chọn theo CSS class của AntD. Nếu không có cách định vị chắc chắn, để thủ công và ghi lý do.
5. Dùng `fixtures/accounts.ts` làm nguồn tên tài khoản duy nhất; `test.use(asRole('R4'))` chọn phiên, không ghi username trực tiếp trong spec. Thêm vai ở map thì setup tự lưu phiên vai đó.
6. Dùng `uniqueSuffix()` cho mọi học phần tạo mới; tên/mã phải nằm trong giới hạn 20/200 ký tự. Ca thử trùng tự tạo một mã riêng rồi lặp mã đó. Không chia sẻ biến dữ liệu ghi được giữa test/file, không reset DB hoặc đổi seed.
7. Chỉ tách page helper khi ít nhất hai test sử dụng. Giữ helper thuộc feature ở mức nhỏ; không import từ backend/frontend để lấy nhãn hoặc fixture. Nếu code thay đổi nhãn, đối chiếu rồi cập nhật cả doc và spec có chủ đích.
8. Tự chạy `pnpm typecheck`, ca vừa thêm rồi file tính năng trên app thật; chỉ sau đó điền kết quả. Tính năng mới thêm index vào test-cases/README.md và Features của docs/testing/README.md.

## 7. Khắc phục sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| Thiếu E2E_ADMIN_PASSWORD hoặc E2E_DEMO_PASSWORD | Điền biến trong source/e2e/.env; không chép .env backend và không in mật khẩu để debug. |
| Đăng nhập sai / setup không thấy danh mục | Đã seed nền rồi seed demo chưa? Mật khẩu có đúng tài khoản hiện tại không? Admin đã đổi mật khẩu bắt buộc và cập nhật E2E_ADMIN_PASSWORD chưa? Seed lại không đổi mật khẩu cũ. |
| Connection refused / “Không kết nối được máy chủ ứng dụng” | Kiểm tra cả hai terminal, frontend 5173, backend 3000, proxy /api và health theo setup guide; suite không tự bật server. |
| Backend đứng ở Watching for file changes | Kiểm PostgreSQL/Redis và cấu hình backend; đây không phải kết quả kiểm tính năng. |
| Redis cổng 6379 đã dùng | Theo setup guide, đặt REDIS_PORT khác trong môi trường/backend trước khi services:up; ứng dụng phải đọc cùng cổng. Không thay E2E_BASE_URL thành cổng Redis. |
| Thiếu browser executable | Chạy pnpm browsers khi có mạng; scaffold không tự tải Chromium. |
| Phiên hết hạn / bị đẩy về login | Chạy setup lại bằng pnpm test bình thường; thời hạn nhàn rỗi mặc định 60 phút. UI mode sau thời gian dài có thể cần chạy lại setup riêng. |
| Không tìm thấy option/khoa/nhóm | Kiểm demo và trạng thái đơn vị; dùng đúng role. R5 không có ô nhóm và chưa tạo được học phần qua form là giới hạn đã ghi nhận, không phải mật khẩu sai. |
| Ca hủy dữ liệu có kết quả học tập chưa chạy được | MVP chưa có dữ liệu AcademicResult; hasStudyResults vẫn false. Ghi Blocked khi thử chạy, không tuyên bố đã bảo vệ kết quả học tập. Ca chặn hủy sau ban hành cần dữ liệu F-15 chuẩn bị riêng. |
| Tổng số học phần tăng hoặc ca rỗng không còn đúng | Dữ liệu riêng tích lũy là chủ ý. Không reset DB để làm xanh suite; dùng tìm kiếm mã riêng và giữ fixture seed nguyên trạng. |
| `-g "A\|B"` báo không có test hoặc lỗi lệnh trên Windows | Shim `.cmd` của pnpm/Volta cho `cmd` đọc lại dấu `\|` thành ống lệnh. Chọn ca theo dòng: `pnpm exec playwright test specs/f-04-course-catalog.spec.ts:360` (nhiều ca thì liệt kê nhiều `file:dòng`), hoặc `-g` với một chuỗi không có `\|`. |
| Chọn mục trong Select hết thời gian chờ | `getByRole('option')` khớp danh sách ARIA ẩn của AntD (luôn không hiển thị). Dùng `chooseOption` trong `fixtures/select.ts`; không tự viết bộ chọn AntD trong spec. |
| Select nhiều đã chọn nhưng helper vẫn chờ đóng popup | `chooseOption` dành cho Select đơn; Select nhiều giữ popup mở sau chọn. Dùng `chooseMultipleOption` trong `fixtures/multiselect.ts`: chọn mục hiển thị rồi Escape; không dùng option ARIA ẩn. |
| Trùng tài khoản nhưng không thấy message tiếng Việt của backend | `UserFormModal` lấy `details[].constraints` nên hiện “unique” dưới đúng trường, không lấy message “Tên đăng nhập đã được dùng.”. Kiểm lỗi gắn trường, không suy ra tài khoản trùng đã được tạo. |
| Không tìm thấy nút OK trong modal quản trị | `ConfigProvider locale={viVN}` đặt nút mặc định của Modal/Popconfirm là “Đồng ý”, hủy là “Hủy”. Đối chiếu `okText` tại component trước; modal có nhãn riêng như Lưu/Thêm giữ nhãn riêng. |
| APIRequest trả 403 nhưng chưa chứng minh từ chối quyền | Yêu cầu ghi trực tiếp phải có `X-Requested-With: XMLHttpRequest` như API client của frontend. Kiểm cả mã `PERMISSION_DENIED`/`OUT_OF_SCOPE`, không nhận nhầm `CSRF_HEADER_MISSING` là kiểm quyền thành công. |
| Strict mode violation khi trang liệt kê dữ liệu kiểm thử tích lũy | Nhãn trạng thái và nút thao tác lặp ở nhiều bản ghi, kể cả khi danh sách cũ còn hiện trong lúc chuyển trang/lọc. Scope vào dòng chứa mã duy nhất của bản ghi vừa tạo hoặc phần chi tiết có định danh của nó; dùng helper khi lặp lại. Không dùng `.first()`/`.nth()` để chọn đại một kết quả. |
| Không tìm thấy nút dù thấy trên màn hình | Nút có biểu tượng mang tên truy cập kèm `aria-label` của biểu tượng (“file-text Đề cương”). Dùng biểu thức khớp phần cuối (`{ name: /Đề cương$/ }`), không dùng `exact: true`. |
| Biểu thức `/^Mã\b/` không khớp tiêu đề | `\b` của JavaScript không coi chữ có dấu (ã, ư, …) là ký tự chữ. Dùng `( \|$)` hoặc chuỗi chính xác. |

| Thấy constraint trong mock unit test nhưng không tìm được trên UI | `details[].constraints` như `unique`/`creditsSum` không phải nhãn lỗi hiển thị. Đối chiếu form và `applyFieldErrors`: thông báo nghiệp vụ dùng `error.message` tiếng Việt; không chép mã constraint vào assertion hoặc Expected Result. |
| Segmented có radio nhưng `.check()` hết thời gian chờ | Input radio của AntD Segmented bị label hiển thị che. Scope vào radiogroup chứa nhãn cần chọn, bấm phần chữ hiển thị rồi kiểm radio được chọn; dùng `chooseCurriculumSegment` trong `fixtures/curriculum.ts`. Radio.Group thông thường không cần đổi theo cách này. |
| Back sau đăng xuất trong context mới về `about:blank` | Đăng nhập, chuyển bắt buộc đổi mật khẩu và đăng xuất dùng replace nên chưa có lịch sử trang được bảo vệ. Với tài khoản riêng, hoàn tất đổi mật khẩu rồi dùng liên kết trong ứng dụng để push sang trang được bảo vệ thứ hai trước khi đăng xuất. Chỉ đăng xuất context mới có storageState rỗng, không dùng phiên `.auth`. |
| Chọn bộ lọc xong helper mất combobox | Placeholder Select biến mất sau khi có giá trị. Với Select không có nhãn truy cập, tìm input từ placeholder hiển thị rồi giữ ID input trước khi gọi `chooseOption`; không giữ locator phụ thuộc placeholder hoặc lớp AntD. |

| Ma trận nhiều ô cùng nhãn Trọng số | Dùng `matrixCell` trong `fixtures/outcomes.ts`: tìm hàng bằng mã học phần/CLO riêng, cột bằng tiêu đề PLO rồi suy ra cellIndex để lấy ô. `td:nth-child` này là vị trí cột suy ra từ header, không phải chọn đại bản ghi. Nhập dấu phẩy như 0,5; checkbox CLO–PLO có nhãn gồm mã CLO, dấu – và mã PLO. |
| Rich text không phải textarea | TipTap cung cấp contenteditable với role textbox và aria-label tiếng Việt. Dùng `fillRichText`/`pasteRichText` trong `fixtures/syllabi.ts`; kiểm HTML đã render và lưu khi thử khử thẻ nguy hiểm, không thực thi script. |
| Required field của AntD có tên truy cập thêm dấu sao | `getByRole('combobox', { name: 'Học kỳ hiệu lực', exact: true })` không khớp tên “* Học kỳ hiệu lực”; textbox bắt buộc cũng có thể mang dấu sao. Theo các fixture form đã có, dùng `getByLabel('Học kỳ hiệu lực', { exact: true })` rồi `chooseOption`; textbox như “Số quyết định” cũng dùng `getByLabel`, không đoán tên role bằng nhãn nhìn thấy. |
| Trang đề cương đã ban hành không có tab Tệp đính kèm của editor | `uploadAttachment` dùng tab của editor Nháp; trang chỉ đọc dùng section “Tệp đính kèm” bên trong tab revision. Dùng `attachPublishedFile` trong `fixtures/release-versions.ts` (tái dùng `syllabusSection`/`attachmentRow`); khi đọc bản sao, chọn tab “Bản nháp của đề xuất” và scope vào tabpanel đó, không lẫn tệp của revision đã công bố. |

## 8. Phạm vi suite và giới hạn

Đủ truy vết 16 AC của US-011..014 trong tài liệu; không có nghĩa mọi nhánh đều chạy tự động hoặc AC gốc đều được mã MVP đáp ứng. Hiệu năng 500 dòng, danh mục thực sự trống, trạng thái nhóm ngừng, lỗi kết nối và fixture phiên bản ban hành/kết quả học tập giữ kiểm tay. Các KB dùng chung EC nhưng thuộc tính năng khác chỉ được nêu giao điểm; không thêm test khung, quy trình duyệt, đăng ký hoặc bảng sức khỏe vào pilot F-04.

Batch 1 bổ sung F-03 (US-007..010), F-02 (US-004..006), F-05 (US-015..017) theo cùng hợp đồng test case. Không sửa tài khoản/đơn vị/nhóm/học phần seed hoặc ma trận quyền trong automation; dữ liệu ghi luôn tự tạo với suffix riêng. Lịch sử duyệt, phiên tài khoản riêng, phân công và hiệu lực thời gian giữ kiểm tay khi cần fixture riêng. Suite chưa được chạy trình duyệt trong lần viết batch này; Is Test? vẫn No cho mọi ca.

Batch 2 bổ sung F-01 (US-001), F-06 (US-018..022), F-07 (US-023..028). F-01 chỉ thử mật khẩu sai/đổi mật khẩu trên tài khoản riêng; đăng xuất chỉ trong context mới không dùng phiên `.auth`; hết hạn 60 phút giữ thủ công. F-06/F-07 tạo chương trình, học phần và khung riêng, không đổi 1024034 hay chương trình seed khác. F-07 kiểm đổi thứ tự bằng bàn phím, chuyển kỳ qua form; phần xuất Excel và hiệu năng giữ thủ công. Chưa chạy trình duyệt ở đợt viết batch 2; mọi cột thực thi của ba tài liệu mới còn trống, Is Test? là No.

Batch 3: F-08 (US-029..031) có 34 ca / 13 test tự động; F-10 (US-038..041) có 56 ca / 37 test thường, F10-TC_001 ghi lệch công thức điểm đã hoãn sang F-12 theo kế hoạch; F-11 (US-042..048) có 81 ca / 49 test (F11-TC_026/063 từng là fixme, bỏ fixme sau khi sửa lỗi ứng dụng ngày 2026-10-22). F11-TC_081 kiểm đường chọn/lưu CLO không nhập tìm kiếm, không thay thế ca lỗi tìm theo mã. Tất cả dùng dữ liệu riêng, không sửa seed. Lượt sửa này không chạy trình duyệt; không coi fixme là đạt; các cột thực thi để người dùng cập nhật, Is Test? vẫn No.

Batch 4 bổ sung F-13 (US-053..060), F-14 (US-061..070), F-15 (US-071..079; US-077 chỉ phần tệp ký đã xây, US-078 ghi lệch hoãn F-16). Ba spec dùng chung builder chương trình/học phần riêng trong `fixtures/change-requests.ts`; F-15 có helper ban hành trong `fixtures/release-versions.ts`. Không tạo đề xuất/duyệt/ban hành trên 1024034, DEMO* hoặc bản ghi seed khác; chỉ đọc học kỳ/khóa/nhóm và gán R3 làm Giám đốc chương trình throwaway. Luồng clock/job, fan-out lớn, phục hồi/nâng cấp và ngoại lệ đề xuất R1 tạo cần R1 thứ hai giữ kiểm tay an toàn. F15-TC_001 từng là fixme do xem trước cuối hiện mã vấn đề đề cương chưa dịch, bỏ fixme sau khi sửa ngày 2026-10-22; ghi nhận, không sửa ứng dụng, không coi là đạt. Không chạy trình duyệt trong lượt viết; mọi cột thực thi để người dùng điền.
