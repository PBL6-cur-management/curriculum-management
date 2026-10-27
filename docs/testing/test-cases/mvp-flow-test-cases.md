# MVP Luồng xuyên tính năng — Test Cases

| Mục | Nội dung |
|---|---|
| User stories | Giao điểm happy path của US-019, US-023, US-029, US-054, US-063, US-064, US-071..073; không thay thế coverage đầy đủ của từng feature. |
| Màn hình | CTĐT và khung; kiểm tra nhất quán; tạo/soạn đề xuất; hàng đợi và chi tiết duyệt; ban hành khởi tạo, phê duyệt cuối, lịch sử và chi tiết phiên bản; đề cương ghim theo phiên bản. |
| Vai trò/tài khoản | `fixtures/accounts.ts`: R1 tạo CTĐT, ban hành khởi tạo và duyệt cuối; R5 KHMT tạo đề xuất nội dung đề cương; R4 KHMT duyệt cấp 1; R3 được phân công trên CTĐT riêng duyệt cấp 2. |
| Môi trường | App dev đã chạy theo `../playwright-guide.md`, frontend mặc định localhost:5173, backend qua `/api`; seed nền/demo, phiên đăng nhập của setup; PostgreSQL và Redis hoạt động. |
| Dữ liệu | CTĐT `MP<suffix>` mới, Kỹ sư, 8 học kỳ, 2.5 TC bắt buộc, 0 TC tự chọn; học phần KHMT và đề cương riêng. `<suffix>` do `uniqueSuffix()` sinh; kiểm tay dùng mã riêng tối đa 20 ký tự. Chỉ đọc tài khoản/nhóm/học kỳ demo; không sửa seed, reset DB hoặc chia sẻ dữ liệu với file khác. |
| Học kỳ | Phải có ít nhất một học kỳ đã bắt đầu và một học kỳ tương lai với `startDate`; `releaseSemester` chọn từ HTTP `/api/semesters`, thiếu thì báo rõ, không tự đổi ngày. |
| Nguồn đối chiếu | `docs/planning/user-stories.md`; `docs/requirement/REQUIREMENTS.md` BR-22/24/25; `source/backend/src/features/releases/releases.service.ts`, `release-activation.processor.ts`, `release-activation.scheduler.ts`; `source/backend/src/shared/releases/version.publisher.ts`, `version.activator.ts`; `source/backend/src/features/change-requests/final-approval.service.ts`; các spec F-06/07/08/13/14/15. |
| Playwright spec | `source/e2e/specs/mvp-flow.spec.ts`; dùng lại fixtures `programs`, `syllabi`, `curriculum`, `consistency`, `change-requests`, `release-versions`, `accounts`, `unique`. Không thêm helper hoặc sửa hành vi fixture cũ. |
| Thứ tự | Ngoại lệ có chủ đích cho luồng này: một describe `serial`, MVP-TC_001 → 005 truyền trạng thái CTĐT/đề xuất chỉ trong describe. Ca trước lỗi thì ca sau không chạy; không chạy riêng ca giữa bằng `-g`. Chạy cả file để dựng mới từ đầu. |
| Trạng thái | Caller chạy trên app dev ngày 10/25/26: lần 3 và 4 đều 14 Passed (9 setup + 5 ca MVP), mỗi lần 1.7 phút. MVP-TC_001..005 đều Passed; giữ lịch sử hai lần đầu và flake chưa sửa ở ghi chú. |

## Truy vết

Chỉ truy vết các nhánh thực sự đi qua trong luồng, không tuyên bố bao phủ toàn bộ story/AC hoặc mọi biến thể dữ liệu.

| AC | TC |
|---|---|
| US-019 AC1 | MVP-TC_001 |
| US-023 AC1 (dòng bắt buộc tối thiểu); US-029 AC3 (tổng tính lại sau thêm dòng) | MVP-TC_002 |
| US-071 AC1, AC4 (học kỳ đã bắt đầu), AC6 | MVP-TC_002 |
| US-054 AC1, AC2; Bổ sung: đường nối gửi đề xuất của R5 tới Điều phối | MVP-TC_003 |
| US-063 AC1; US-064 AC1 | MVP-TC_004 |
| US-072 AC2, AC4, AC6; US-073 AC1 | MVP-TC_005 |
| Bổ sung: nội dung đề cương ghim theo hai phiên bản | MVP-TC_005 |

## Test cases

Năm cột cuối thuộc nhóm **Developer**; có automation không có nghĩa đã Passed. Mỗi dòng tương ứng đúng một test trong spec.

| TC_ID | Target item | Sub-target item | AC | Test summary | Pre-Condition | Steps | Test Data | Expected Result | Is Test? | Test Result | Executed On | Executed By | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MVP-TC_001 | Luồng MVP xuyên tính năng | CTĐT và dữ liệu riêng | US-019 AC1 | Kiểm tra tạo CTĐT mới làm gốc của toàn bộ luồng | R1 đã đăng nhập; demo có nhóm KHMT, R3 và học kỳ đã bắt đầu | 1. Mở Thêm chương trình, nhập và Lưu; 2. Tạo học phần KHMT riêng và đề cương qua UI; 3. Nhập mô tả, mục tiêu rồi Lưu nội dung; 4. Fixture phân công R3 lên CTĐT mới qua HTTP | MP<suffix>; 2.5 TC; mô tả ban đầu gắn mã CTĐT | CTĐT tạo thành công với phiên bản Nháp; có link Khung chương trình; đề cương riêng lưu được | Yes | Passed | 10/25/26 | Playwright (auto) | Tự động: MVP-TC_001 trong specs/mvp-flow.spec.ts. Phân công HTTP chỉ là setup cho cấp duyệt, không sửa tài khoản hoặc CTĐT seed. |
| MVP-TC_002 | | Khung → nhất quán → ban hành khởi tạo và áp dụng | US-023 AC1; US-029 AC3; US-071 AC1, AC4, AC6 | Kiểm tra khung nhất quán được ban hành và áp dụng ngay vào học kỳ đã bắt đầu | MVP-TC_001 hoàn tất trong cùng describe serial | 1. Xem tổng khung trống rồi thêm học phần riêng vào học kỳ 1 bằng UI; 2. Mở Kiểm tra nhất quán, bấm Chạy lại; 3. Mở ban hành khởi tạo, nhập quyết định và học kỳ đã bắt đầu, xác nhận; 4. Mở CTĐT và link Khung chương trình | Tổng 2.5 = bắt buộc 2.5 + tự chọn 0; số phiên bản mặc định 1.0 | Tổng tính từ khung đổi từ 0 lên 2.5, bằng khai báo, chênh lệch 0; không có lỗi chặn; phiên bản 1.0 Đang hiệu lực, ghim Bản 1 (đang ban hành); link khung của CTĐT trỏ đúng phiên bản này, HTTP xác nhận ACTIVE và currentVersion cùng ID | Yes | Passed | 10/25/26 | Playwright (auto) | Tự động: MVP-TC_002 trong specs/mvp-flow.spec.ts. Đây là đường kích hoạt thực qua ban hành khởi tạo, không phải job chuyển bản tương lai. Lần 1: caller bỏ exact khỏi locator Chạy lại tại specs/mvp-flow.spec.ts:56 vì accessible name là “reload Chạy lại”; lỗi test, không phải lỗi app. Lần 2: chooseOption (fixtures/select.ts:22, qua curriculum.ts:27) chờ Học kỳ/plannedSemester đóng nhưng aria-expanded vẫn true sau 10 giây; flake 1/4 lần chạy, bước này đạt ở lần 1/3/4, chưa rõ nguyên nhân, chưa sửa. |
| MVP-TC_003 | | Đề xuất từ dữ liệu đã ban hành | US-054 AC1, AC2; Bổ sung | Kiểm tra R5 soạn trên bản sao và gửi đề xuất của cùng CTĐT | MVP-TC_002 hoàn tất; R5 thuộc KHMT; R3 đã được gán trên CTĐT riêng | 1. R5 mở tạo đề xuất Nội dung đề cương cho học phần riêng; 2. Tạo đề xuất, mở Sửa nội dung đề cương, đổi mô tả và lưu; 3. Xác nhận Gửi duyệt; 4. R1 mở đề cương ghim theo phiên bản 1.0 | Nội dung điều chỉnh gắn mã CTĐT; nguồn Khoa đề xuất | Đề xuất Chờ Điều phối duyệt; mô tả ở phiên bản 1.0 vẫn là nội dung ban đầu, không bị bản sao sửa trực tiếp | Yes | Passed | 10/25/26 | Playwright (auto) | Tự động: MVP-TC_003 trong specs/mvp-flow.spec.ts. Dùng R5 để không tự bỏ qua cấp R4 hoặc R3; không dùng fixture approve để đi tắt. |
| MVP-TC_004 | | Hai cấp chuyên môn và chương trình | US-063 AC1; US-064 AC1 | Kiểm tra R4 rồi R3 duyệt đúng đề xuất qua UI | MVP-TC_003 hoàn tất; đề xuất đang chờ R4 | 1. R4 mở hàng đợi và thấy mã đề xuất, mở chi tiết rồi Đồng ý và xác nhận; 2. R3 mở hàng đợi, thấy cùng mã, mở chi tiết rồi Đồng ý và xác nhận | Cùng CTĐT, học phần và mã đề xuất từ các ca trước | Sau R4: Chờ Giám đốc CTĐT duyệt; sau R3: Chờ Phòng Đào tạo duyệt | Yes | Passed | 10/25/26 | Playwright (auto) | Tự động: MVP-TC_004 trong specs/mvp-flow.spec.ts. Cả hai lần dùng approveRequest qua UI và phiên riêng withRequestRole. |
| MVP-TC_005 | | Cấp cuối → ban hành mới → giữ bản đang áp dụng | US-072 AC2, AC4, AC6; US-073 AC1; Bổ sung | Kiểm tra R1 ban hành bản 1.1 Chờ hiệu lực mà không thay bản 1.0 đang áp dụng | MVP-TC_004 hoàn tất; có học kỳ tương lai | 1. R1 mở phê duyệt cuối, nhập quyết định/ngày ký/học kỳ tương lai và xác nhận; 2. Mở lại đề xuất; 3. Xem lịch sử, mở bản 1.1 và kiểm tra đề xuất nguồn, bản trước, học kỳ; 4. Xem đề cương ghim theo 1.1 và 1.0; 5. Mở CTĐT và link Khung chương trình | Phiên bản 1.1 từ đề xuất nội dung đề cương; học kỳ có startDate sau hôm nay | Đề xuất Đã phê duyệt; 1.1 Chờ hiệu lực (HTTP PENDING), có quyết định/học kỳ/đề xuất nguồn/bản trước 1.0; đề cương 1.1 chứa mô tả mới, 1.0 giữ mô tả cũ; CTĐT vẫn trỏ 1.0 ACTIVE và chỉ có một bản ACTIVE | Yes | Passed | 10/25/26 | Playwright (auto) | Tự động: MVP-TC_005 trong specs/mvp-flow.spec.ts. Chưa bao phủ lúc đến ngày đầu kỳ: 1.1 PENDING → ACTIVE, 1.0 → HISTORICAL, đề xuất → EFFECTIVE. |

## Ghi chú

- Chạy tại `source/e2e`: `pnpm test specs/mvp-flow.spec.ts`. Kết quả dưới đây do caller quan sát trên app dev ngày 2026-10-25; lượt cập nhật tài liệu này không chạy lại suite.
- Lần 1: MVP-TC_002 thất bại vì `getByRole('button', { name: 'Chạy lại', exact: true })` không khớp accessible name “reload Chạy lại” do aria-label của icon AntD. Caller sửa `source/e2e/specs/mvp-flow.spec.ts:56` thành `{ name: 'Chạy lại' }`, bỏ exact; đây là lỗi locator của test, không phải lỗi ứng dụng và không ghi vào `error_log.md`.
- Lần 2: MVP-TC_002 thất bại sớm hơn trong `fixtures/select.ts:22` (`chooseOption`), được gọi từ `fixtures/curriculum.ts:27` (`prepareCurriculumItem`): sau khi chọn option, combobox Học kỳ (`plannedSemester`) vẫn `aria-expanded=true` sau 10 giây. Cùng bước đạt ở lần 1, 3, 4: flake trong fixture dùng chung, quan sát 1/4 lần chạy, nguyên nhân chưa xác định, chưa sửa.
- Lần 3 và 4: mỗi lần **14 Passed = 9 setup + MVP-TC_001..005**, thời gian **1.7 phút/lần**. Năm dòng ca kiểm thử ghi kết quả Passed từ các lần chạy thành công; không tính 9 setup thành ca nghiệp vụ hoặc coi flake đã được khắc phục.
- Kích hoạt tức thời được kiểm ở MVP-TC_002 trên chính CTĐT mới: HTTP `POST /api/programs/:programId/versions/:versionId/release`, `ReleasesService.release` gọi `VersionPublisher.promote`; `effectiveStart <= today` sinh ACTIVE ngay. UI hiển thị Đang hiệu lực và khung mặc định trỏ đúng ID; không chỉ kiểm nhãn trạng thái.
- Với đề xuất R5 của MVP-TC_003, `FinalApprovalService.assertSemesterAllowed` chỉ nhận học kỳ tương lai vì `createdByAcademicOffice` là false. MVP-TC_005 kiểm PENDING, không đổi ngày seed hay dùng test-only endpoint. Quy tắc ngoại lệ `createdByAcademicOffice` vẫn là câu hỏi người dùng chưa chốt; luồng này không quyết định thay.
- Chưa bao phủ kích hoạt theo lịch của bản 1.1: `ReleaseActivationScheduler` xếp job lúc khởi động và mỗi ngày; `ReleaseActivationProcessor.reconcile` chọn PENDING có học kỳ đã bắt đầu rồi gọi `VersionActivator.activate`. Cần đến ngày đầu học kỳ tương lai và chạy worker thật để kiểm chuyển ACTIVE/HISTORICAL/EFFECTIVE cùng đổi bản áp dụng; không suy từ activation khởi tạo sang coverage job này.
