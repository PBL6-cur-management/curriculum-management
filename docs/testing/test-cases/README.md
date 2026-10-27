# Quy ước test case theo tính năng

## Chỉ mục

- [F-01 Đăng nhập, phiên](./f-01-auth-session-test-cases.md)
- [F-02 Tài khoản, vai trò, phạm vi quyền](./f-02-accounts-roles-permissions-test-cases.md)
- [F-03 Đơn vị và nhóm chuyên môn](./f-03-org-units-subject-groups-test-cases.md)
- [F-04 Danh mục học phần](./f-04-course-catalog-test-cases.md)
- [F-05 Quan hệ học phần, nhóm tương đương](./f-05-course-relations-equivalence-test-cases.md)
- [F-06 Thông tin chương trình, Giám đốc CTĐT](./f-06-programs-directors-test-cases.md)
- [F-07 Khung chương trình, nhóm tự chọn](./f-07-curriculum-elective-groups-test-cases.md)
- [F-08 Kiểm tra nhất quán](./f-08-consistency-check-test-cases.md)
- [F-09 Nhập, xuất Excel](./f-09-excel-import-export-test-cases.md) — 30 ca: 27 tự động Passed ngày 10/26/26 (5 Playwright, 17 Backend e2e, 1 Backend unit, 4 Frontend unit); 3 Manual chưa chạy. TC_001 Passed nhưng Failed 1/2 lượt do flake chooseOption chưa sửa.
- [F-10 Đề cương](./f-10-syllabus-test-cases.md)
- [F-11 PLO, CLO, ma trận](./f-11-plo-clo-matrices-test-cases.md)
- [F-13 Đề xuất thay đổi](./f-13-change-requests-test-cases.md)
- [F-14 Duyệt ba cấp, bình luận, thông báo](./f-14-three-level-approval-notifications-test-cases.md)
- [F-15 Ban hành phiên bản](./f-15-release-version-snapshots-test-cases.md)
- [MVP Luồng xuyên tính năng](./mvp-flow-test-cases.md)

- [F-16 So sánh phiên bản, gán khóa](./f-16-version-compare-cohort-assignment-test-cases.md) — 27 ca: 22 Automated (backend e2e/frontend unit; 5 ca Playwright), 5 Manual; chưa chạy, orchestrator điền kết quả browser walk.

## Tổng kết thực thi theo chỉ mục

Đếm trực tiếp các dòng TC trong 14 tài liệu tính năng ngày 2026-10-26: **789 ca = 408 tự động Passed + 381 thủ công chưa chạy**. F-09 bổ sung 30 ca (27 tự động Passed + 3 Manual); 13 tính năng MVP giữ 759 ca (381 Passed + 378 thủ công). Không cộng 9 auth setup, không đếm trùng các tầng automation của cùng TC. Năm ca MVP xuyên tính năng trong mvp-flow-test-cases.md đã Passed, được theo dõi riêng, không cộng vào tổng theo tính năng này.

## Mục đích và phạm vi

Mỗi file là hợp đồng kiểm thử một tính năng: truy vết AC → ca cụ thể → test Playwright (nếu có). Đây là bộ test case theo tính năng, bổ sung chứ không thay thế tài liệu `feature__*.md` / `refactor__*.md` ghi kiểm thử theo thay đổi ở thư mục cha.

Tên file: `f-xx-<slug>-test-cases.md`, ví dụ `f-04-course-catalog-test-cases.md`. Prose bằng tiếng Việt; TC_ID, đường dẫn và code bằng tiếng Anh. Cách chạy và mở rộng: [playwright-guide.md](../playwright-guide.md).

## Cấu trúc bắt buộc

1. Tiêu đề `# F-xx <Tên tính năng> — Test Cases`.
2. Bảng đầu file: stories, màn hình MH-xx, vai/tài khoản, dữ liệu demo và trạng thái cần có, đường dẫn nguồn đã đọc, đường dẫn spec.
3. `## Truy vết`: bảng `| AC | TC |`, liệt kê từng AC và từng KB/NT được sử dụng. Không được bỏ một AC; AC khác mã phải có ca ghi lệch.
4. `## Test cases`: bảng dưới đây; một hành vi mỗi dòng, happy path trước trong nhóm.
5. `## Ghi chú`: lệch, giới hạn đã biết, phụ thuộc dữ liệu và phần chỉ kiểm thủ công.

## Hợp đồng cột

Giữ đúng thứ tự, không đổi tên hoặc thêm cột:

| TC_ID | Target item | Sub-target item | AC | Test summary | Pre-Condition | Steps | Test Data | Expected Result | Is Test? | Test Result | Executed On | Executed By | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Năm cột cuối (`Is Test?`, `Test Result`, `Executed On`, `Executed By`, `Note`) thuộc nhóm **Developer** của bảng tính nhóm. Markdown không gộp ô tiêu đề nên mỗi file nhắc lại điều này ngay trước bảng.

| Cột | Quy ước |
|---|---|
| TC_ID | `F04-TC_001`, `F04-TC_002`, … tăng liên tiếp trong file; đổi prefix theo feature. Không tái sử dụng ID đã công bố cho hành vi khác. |
| Target item | Màn hình/chức năng kèm MH-xx, ví dụ `Danh mục học phần (MH-16)`. |
| Sub-target item | Chức năng con, ví dụ Thêm học phần, Lọc, Phân quyền. Chỉ điền Target và Sub-target ở dòng đầu mỗi nhóm; dòng tiếp theo để trống cả hai. |
| AC | `US-012 AC3`, `KB-001`, `NT-B1-03`; nhiều mã cách nhau bằng `; `. Dùng `Bổ sung` cho ca biên có nguồn trong code nhưng không thuộc AC nào. |
| Test summary | Một câu bắt đầu `Kiểm tra …`. |
| Pre-Condition | Trạng thái cụ thể và tài khoản/vai/phạm vi; có thể ghi `F04-TC_003 đã đạt` khi kiểm tay. Automation phải tự dựng dữ liệu và không dựa thứ tự ca. |
| Steps | `1. …; 2. …; 3. …`: người dùng bấm/nhập gì; dùng `<br>` nếu cần xuống dòng. |
| Test Data | Giá trị cụ thể hoặc `—`; ký hiệu `<suffix>` phải được giải thích và thay bằng giá trị riêng khi kiểm tay. |
| Expected Result | Chỉ kết quả quan sát được. Trích đúng nhãn, lỗi/toast tiếng Việt trong frontend/backend; không ghi truy vấn, bảng dữ liệu hoặc chi tiết thực thi làm kết quả. |
| Is Test? | `Yes` hoặc `No`. Mới viết luôn `No`, kể cả đã có spec. Chỉ `Yes` khi thực sự thử thực thi ca. |
| Test Result | `Passed`, `Failed`, `Blocked`, `N/A`; mới viết để trống. `Blocked` khi không đủ điều kiện để thực thi; `N/A` khi đã được xác nhận không áp dụng và ghi lý do. |
| Executed On | Ngày thực thi `MM/DD/YY`, ví dụ `10/21/26`; chưa thực thi để trống. |
| Executed By | Tên người thực thi hoặc `Playwright (auto)`; chưa thực thi để trống. |
| Note | Ca có test phải ghi `Tự động: F04-TC_xxx trong specs/f-04-course-catalog.spec.ts`; thêm lệch, giới hạn và nguồn. Không ghi Passed chỉ vì có code. |

### Đánh số AC và truy vết

AC1 là dòng Cho/Khi/Thì **đầu tiên** dưới story, AC2 là dòng thứ hai, …; không tính tiêu đề, mục Vai trò/Bao phủ hoặc BR/EC. Mọi AC có ít nhất một ca, tách hành vi độc lập nếu một AC chứa nhiều nhánh. Bổ sung biên kiểm dữ liệu, rỗng, lọc không kết quả, trùng mã và từ chối vai/phạm vi theo ma trận quyền và seed thật.

KB dùng chung EC với story khác chỉ được ghi phần giao điểm thuộc feature; nói rõ phần còn lại chưa được pilot bao phủ. Không suy ra coverage toàn KB chỉ vì đã dùng một đầu vào.

### Khi mã khác yêu cầu

**Mã hiện hành thắng**: expected bám hành vi thật, Note nêu AC lệch, lý do, đường dẫn và mục/dòng Lệch kế hoạch hoặc Còn nợ nếu có. Báo cáo cũ có thể đã bị tính năng sau thay thế; kiểm mã trước khi chép giới hạn.

Ngoại lệ: AC rõ ràng không được mã đáp ứng và báo cáo chưa thừa nhận → vẫn ghi expected theo AC, Note `⚠️ nghi lỗi: …`, ghi bằng chứng file:dòng và đưa vào Escalations; không tự sửa backend/frontend hoặc coi lỗi là hành vi chuẩn. Điều kiện chưa có vì tính năng tương lai đã được báo cáo ghi nhận là giới hạn, không tự kết luận bug mới.

## Quy ước automation

Viết dòng test case trước, rồi test có tiêu đề bắt đầu đúng TC_ID. Chỉ đánh dấu `Tự động:` khi spec thực sự có ca đó. Ưu tiên `getByRole`, `getByLabel`, nhãn/placeholder tiếng Việt; không thêm test id hoặc sửa frontend. Trường thiếu nhãn dùng thứ tự role được giải thích rõ nếu vẫn định vị xác định được; không thể định vị thì để thủ công.

Mã mới dùng suffix riêng; không reset DB, không sửa fixture seed, không phụ thuộc thứ tự file. Mật khẩu và phiên nằm trong `.env` / `.auth/` bị gitignore, không đưa vào tài liệu. Sau mỗi lần chạy, đọc kết quả thật rồi cập nhật bốn cột thực thi theo [hướng dẫn](../playwright-guide.md).
