# SƠ ĐỒ TRẠNG THÁI v0.1

**Hệ thống Quản lý Chương trình đào tạo — PBL6**

| | |
|---|---|
| Ngày lập | 2026-10-12 |
| Đi kèm | `docs/design/data-dictionary.md` (tên thực thể, thuộc tính, danh sách trạng thái), `docs/design/erd.md` (M-1..M-10, E-1..E-13) |
| Nguồn | `docs/requirement/REQUIREMENTS.md` mục 6.1, 6.2, 6.3, 8, 9, 10; `docs/Bo_so_do_Use_Case_CTDT/Thuyet_minh_Use_Case.md` (C01..C12); `docs/planning/epics.md` (H-1..H-4) |
| Mức | Logic — không nêu công nghệ. Sơ đồ viết bằng Mermaid `stateDiagram-v2`, **chưa kiểm tra hiển thị** |
| Điểm còn hở của tài liệu này | S-1..S-14, mục 14 |

---

## 1. Quy ước

- **Trạng thái** lấy từ cột mô tả của thuộc tính `status` (hoặc `action`, `readStatus`) trong từ điển dữ liệu. Bảng chuyển trạng thái ghi mã lập trình (`DRAFT`); sơ đồ hiển thị nhãn tiếng Việt và dùng mã làm tên nút, nên mỗi sơ đồ cũng là bảng đối chiếu mã–nhãn của thực thể đó. Lời giải thích vẫn gọi trạng thái bằng nhãn tiếng Việt. Tài liệu này không thêm, không đổi trạng thái nào.
- **Tác nhân:** R1 Phòng Đào tạo · R2 Ban lãnh đạo khoa · R3 Giám đốc CTĐT · R4 Điều phối nhóm chuyên môn · R5 Giảng viên · R6 Sinh viên · "Hệ thống" = tự động, không có người bấm · E1 cơ sở dữ liệu có sẵn của Trường.
- **Bảng chuyển trạng thái** có sáu cột cố định: Từ · Sự kiện · Điều kiện · Đến · Tác nhân · Nguồn. `[*]` ở cột Từ nghĩa là dòng được tạo ra; ở cột Đến nghĩa là dòng bị xóa.
- **Điều kiện** là điều phải đúng thì chuyển trạng thái mới xảy ra. Sai điều kiện thì thao tác bị từ chối và trạng thái giữ nguyên, trừ khi bảng ghi khác.
- Mọi chuyển trạng thái đều ghi một dòng `AuditLog` (FR-105). Bảng không nhắc lại điều này.
- Cột Nguồn ghi mã trong SRS hoặc trong tài liệu đi kèm. Mã `S-x` nghĩa là quy tắc do tài liệu này tạm chọn, xem mục 14.

### Thực thể có vòng đời

| Mục | Thực thể | Thuộc tính | Số trạng thái |
|---|---|---|---|
| 2 | `ChangeRequest` | `status` | 8 |
| 3 | `ApprovalStep` | `action` | 4 |
| 4 | `ProgramVersion` | `status` | 4 |
| 5 | `Syllabus` | `status` | 3 |
| 6 | `Course` | `status` | 3 |
| 7 | `ApprovalDelegation` | `status` | 3 |
| 8 | `ImportBatch` | `status` | 5 |
| 9 | `SyncLog` | `status` | 3 |
| 10 | `ProgramEnrollment` | `status` | 3 |
| 11 | `Student` | `status` | 4 |
| 12 | `AcademicResult` | `status` | 4 |
| 13 | `OrgUnit`, `SubjectGroup`, `User`, `Program`, `Notification`, `IntegrationClient` | hai giá trị | 2 |

---

## 2. `ChangeRequest`

Đề xuất thay đổi dữ liệu đã ban hành. Ba trạng thái cuối, không đi tiếp được: Đang hiệu lực · Từ chối · Thu hồi.

```mermaid
stateDiagram-v2
    state "Nháp" as DRAFT
    state "Chờ Điều phối nhóm CM" as PENDING_COORDINATOR
    state "Chờ Giám đốc CTĐT" as PENDING_DIRECTOR
    state "Chờ Phòng Đào tạo" as PENDING_ACADEMIC_OFFICE
    state "Đã duyệt" as APPROVED
    state "Đang hiệu lực" as EFFECTIVE
    state "Từ chối" as REJECTED
    state "Thu hồi" as WITHDRAWN

    [*] --> DRAFT : tạo đề xuất
    DRAFT --> PENDING_COORDINATOR : gửi duyệt
    DRAFT --> PENDING_DIRECTOR : gửi duyệt, bỏ qua cấp 1
    DRAFT --> PENDING_ACADEMIC_OFFICE : gửi duyệt, bỏ qua cấp 1 và 2
    PENDING_COORDINATOR --> PENDING_DIRECTOR : cấp 1 đồng ý đủ
    PENDING_COORDINATOR --> PENDING_ACADEMIC_OFFICE : cấp 1 đồng ý đủ, bỏ qua cấp 2
    PENDING_DIRECTOR --> PENDING_ACADEMIC_OFFICE : cấp 2 đồng ý đủ
    PENDING_ACADEMIC_OFFICE --> APPROVED : Phòng Đào tạo đồng ý
    APPROVED --> EFFECTIVE : tới đầu học kỳ hiệu lực
    PENDING_COORDINATOR --> DRAFT : trả lại
    PENDING_DIRECTOR --> DRAFT : trả lại
    PENDING_ACADEMIC_OFFICE --> DRAFT : trả lại
    PENDING_COORDINATOR --> REJECTED : từ chối
    PENDING_DIRECTOR --> REJECTED : từ chối
    PENDING_ACADEMIC_OFFICE --> REJECTED : từ chối
    PENDING_COORDINATOR --> WITHDRAWN : thu hồi
    PENDING_DIRECTOR --> WITHDRAWN : thu hồi
    PENDING_ACADEMIC_OFFICE --> WITHDRAWN : thu hồi
    DRAFT --> [*] : xóa nháp
    EFFECTIVE --> [*]
    REJECTED --> [*]
    WITHDRAWN --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| DX-01 | `[*]` | Tạo đề xuất | Người tạo có quyền "Tạo đề xuất thay đổi" và đối tượng nằm trong phạm vi của mình; đối tượng đã ban hành; chọn một `requestType`; `submissionRound` = 0 | `DRAFT` | R1, R3, R4, R5 (R2: xem S-1) | FR-55, FR-56, SRS mục 3.4, UC-37 |
| DX-02 | `DRAFT` | Sửa nội dung, hồ sơ đính kèm, nguồn phát sinh | Người sửa là `createdBy` | `DRAFT` | Người tạo | UC-37, FR-108, FR-109 |
| DX-03 | `DRAFT` | Xóa nháp | Người xóa là `createdBy`; `submissionRound` = 0 (đề xuất chưa từng được gửi) | `[*]` | Người tạo | UC-37, S-2 |
| DX-04 | `DRAFT` | Gửi duyệt | Có ít nhất một `ChangeItem`; mọi CLO có thành phần đánh giá bao phủ (EC-40); `baseVersion` còn khớp với đối tượng (EC-27); cấp 1 có ít nhất một người duyệt khác người tạo. `submissionRound` tăng 1; tạo `ApprovalStep` cấp 1 cho điều phối của **mọi** nhóm phụ trách học phần bị tác động | `PENDING_COORDINATOR` | Người tạo | FR-57, BR-29, EC-21, EC-22, UC-38 |
| DX-05 | `DRAFT` | Gửi duyệt, bỏ qua cấp 1 | Như DX-04, nhưng cấp 1 không còn ai phải duyệt: người tạo là điều phối duy nhất của cấp 1 (EC-20), hoặc đề xuất không tác động học phần của nhóm nào (C04). Ghi `ApprovalStep` cấp 1 với `isSkipped` = Có, `skipReason` | `PENDING_DIRECTOR` | Người tạo | FR-61, BR-27, DEC-09, EC-20, C04 |
| DX-06 | `DRAFT` | Gửi duyệt, bỏ qua cấp 1 và cấp 2 | Như DX-04, và cả hai cấp dưới không còn ai phải duyệt: học phần thuộc khoa khác (EC-24); hoặc `requestType` = `ORGANIZATION` (E-4); hoặc người tạo vừa là điều phối duy nhất vừa là Giám đốc CTĐT duy nhất của các đối tượng bị tác động | `PENDING_ACADEMIC_OFFICE` | Người tạo | EC-24, FR-61, E-4, C04 |
| DX-07 | `PENDING_COORDINATOR` | Một điều phối bấm Đồng ý và là người cuối cùng của cấp | Mọi `ApprovalStep` cấp 1 của `submissionRound` hiện tại có `action` = `APPROVE`; cấp 2 có ít nhất một người duyệt khác người tạo. Tạo `ApprovalStep` cấp 2 cho Giám đốc CTĐT của **mọi** chương trình bị tác động | `PENDING_DIRECTOR` | R4; người được ủy quyền; R1 khi can thiệp | FR-57, FR-59, EC-22, EC-23, UC-43 |
| DX-08 | `PENDING_COORDINATOR` | Như DX-07, bỏ qua cấp 2 | Như DX-07, nhưng người tạo là Giám đốc CTĐT duy nhất của mọi chương trình bị tác động (EC-19) | `PENDING_ACADEMIC_OFFICE` | R4; người được ủy quyền; R1 khi can thiệp | FR-61, DEC-09, EC-19 |
| DX-09 | `PENDING_DIRECTOR` | Một Giám đốc CTĐT bấm Đồng ý và là người cuối cùng của cấp | Mọi `ApprovalStep` cấp 2 của `submissionRound` hiện tại có `action` = `APPROVE`. Tạo một `ApprovalStep` cấp 3 không chỉ đích danh | `PENDING_ACADEMIC_OFFICE` | R3; người được ủy quyền; R1 khi can thiệp | FR-57, FR-59, EC-23, UC-44 |
| DX-10 | `PENDING_ACADEMIC_OFFICE` | Đồng ý cấp cuối | Người duyệt khác `createdBy` (BR-27, C03); nhập `decisionNumber`, `signedDate`, `effectiveSemester`; học kỳ hiệu lực có `startDate` và chưa bắt đầu (S-5); mọi học phần trong khung của các chương trình bị tác động có đề cương (EC-44); `baseVersion` còn khớp (EC-27). Hệ thống tạo `ProgramVersion` ở Chờ hiệu lực cho mọi chương trình bị tác động (PB-05) | `APPROVED` | R1 | FR-59, FR-69, FR-70, SRS mục 6.1.4, UC-46 |
| DX-11 | `APPROVED` | Tới `Semester.startDate` của `effectiveSemester` | Mọi phiên bản sinh từ đề xuất này đã chuyển Đang hiệu lực (PB-06) | `EFFECTIVE` | Hệ thống | DEC-07, BR-25, SRS mục 6.1.4 bước 7 |
| DX-12 | `PENDING_COORDINATOR` · `PENDING_DIRECTOR` · `PENDING_ACADEMIC_OFFICE` | Trả lại | `remark` tối thiểu 20 ký tự (BR-28). Các `ApprovalStep` còn Chờ của lần gửi này không còn hiệu lực (S-4) | `DRAFT` | Người duyệt của cấp đang chờ; người được ủy quyền; R1 khi can thiệp | FR-59, BR-28, BR-29, EC-26, UC-43, UC-44, UC-45 |
| DX-13 | `PENDING_COORDINATOR` · `PENDING_DIRECTOR` · `PENDING_ACADEMIC_OFFICE` | Từ chối | `remark` tối thiểu 20 ký tự (BR-28) | `REJECTED` | Như DX-12 | FR-59, BR-28, C02, UC-43, UC-44, UC-45 |
| DX-14 | `PENDING_COORDINATOR` · `PENDING_DIRECTOR` · `PENDING_ACADEMIC_OFFICE` | Thu hồi | Người thu hồi là `createdBy`; trong `submissionRound` hiện tại chưa có `ApprovalStep` nào `action` = `APPROVE` với `isSkipped` = Không (S-3) | `WITHDRAWN` | Người tạo | FR-60, UC-39 |

**Quy tắc đi kèm**

| Quy tắc | Nội dung | Nguồn |
|---|---|---|
| Gửi lại | Đề xuất bị trả về Nháp, khi gửi lại đi từ cấp 1 (DX-04..DX-06), không quay về cấp vừa trả | BR-29, Q-07 |
| Từ chối khác Trả lại | Từ chối đóng đề xuất vĩnh viễn; Trả lại đưa về Nháp. EC-26 dùng chữ "từ chối" cho trường hợp về Nháp — tài liệu này hiểu là Trả lại | C02, S-6 |
| Duyệt thay theo ủy quyền | Người được ủy quyền thực hiện DX-07..DX-09, DX-12, DX-13 thay cho `approver`; ghi `ApprovalStep.performedBy` và `delegation`. Người được ủy quyền không được là `createdBy` | FR-09, EC-25, BR-27 |
| Phòng Đào tạo can thiệp | R1 thực hiện được DX-07..DX-09, DX-12, DX-13 ở bất kỳ cấp nào; ghi `ApprovalStep.isOverride` = Có | BR-31, EC-25, EC-28 |
| Bình luận | Bình luận (`Comment`) không làm đổi trạng thái ở bất kỳ trạng thái nào | FR-62 |
| Cảnh báo xung đột | Khi tạo (DX-01) hoặc gửi (DX-04..DX-06), nếu đối tượng đang có đề xuất khác ở Nháp đã gửi, Chờ …, hoặc Đã duyệt, hệ thống cảnh báo nhưng không chặn | FR-68, BR-30, EC-27 |
| Người tạo bị vô hiệu hóa | Đề xuất giữ nguyên trạng thái và tiếp tục được xử lý | EC-29 |

---

## 3. `ApprovalStep`

Một lượt duyệt của một người ở một cấp, trong một lần gửi. Thuộc tính mang vòng đời là `action`.

```mermaid
stateDiagram-v2
    state "Chờ" as PENDING
    state "Đồng ý" as APPROVE
    state "Trả lại" as RETURN
    state "Từ chối" as REJECT

    [*] --> PENDING : đề xuất vào cấp duyệt
    [*] --> APPROVE : cấp được bỏ qua
    PENDING --> APPROVE : đồng ý
    PENDING --> RETURN : trả lại
    PENDING --> REJECT : từ chối
    APPROVE --> [*]
    RETURN --> [*]
    REJECT --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| BD-01 | `[*]` | Đề xuất vào một cấp duyệt (DX-04, DX-07, DX-09) | Một dòng cho mỗi người phải duyệt theo SRS mục 6.1.3; `approver` khác `createdBy` của đề xuất | `PENDING` | Hệ thống | FR-57, EC-22, EC-23 |
| BD-02 | `[*]` | Cấp được bỏ qua (DX-05, DX-06, DX-08) | `isSkipped` = Có; `skipReason` bắt buộc; `recordedAt` = lúc gửi | `APPROVE` | Hệ thống | FR-61, BR-27, DEC-09, S-4 |
| BD-03 | `PENDING` | Đồng ý | Đề xuất đang ở đúng cấp của dòng; `submissionRound` của dòng bằng `submissionRound` của đề xuất; người bấm là `approver`, hoặc người có `ApprovalDelegation` Hiệu lực của `approver`, hoặc R1 | `APPROVE` | R4 · R3 · R1 theo cấp | FR-59, FR-67 |
| BD-04 | `PENDING` | Trả lại | Như BD-03; `remark` tối thiểu 20 ký tự | `RETURN` | Như BD-03 | FR-59, BR-28 |
| BD-05 | `PENDING` | Từ chối | Như BD-03; `remark` tối thiểu 20 ký tự | `REJECT` | Như BD-03 | FR-59, BR-28 |

Dòng `ApprovalStep` đã rời Chờ là bất biến: nó là lịch sử duyệt mà FR-67 yêu cầu. Hàng đợi chờ duyệt (FR-65) của một người gồm các dòng `action` = `PENDING`, có `submissionRound` bằng `submissionRound` của đề xuất, và đề xuất đang ở đúng cấp của dòng.

---

## 4. `ProgramVersion`

Một phiên bản của một chương trình. Bất biến từ khi rời Nháp (FR-71, BR-23).

```mermaid
stateDiagram-v2
    state "Nháp" as DRAFT
    state "Chờ hiệu lực" as PENDING
    state "Đang hiệu lực" as ACTIVE
    state "Lịch sử" as HISTORICAL

    [*] --> DRAFT : tạo chương trình, nhập Excel, nhân bản
    DRAFT --> PENDING : ban hành khởi tạo, học kỳ chưa tới
    DRAFT --> ACTIVE : ban hành khởi tạo, học kỳ đã bắt đầu
    [*] --> PENDING : đề xuất được duyệt cấp cuối
    [*] --> PENDING : ban hành đính chính
    PENDING --> ACTIVE : tới đầu học kỳ hiệu lực
    ACTIVE --> HISTORICAL : phiên bản khác có hiệu lực
    PENDING --> HISTORICAL : bị đính chính trước khi có hiệu lực
    HISTORICAL --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| PB-01 | `[*]` | Tạo chương trình bằng nhập Excel hoặc nhân bản một phiên bản có sẵn | Chương trình chưa có phiên bản Nháp nào; `versionNumber` để trống | `DRAFT` | R1; R3 trong phạm vi phân công | FR-25, FR-33, DEC-12, M-2, UC-20, UC-73 |
| PB-02 | `DRAFT` | Sửa trực tiếp thông tin, khung, nhóm tự chọn, PLO, ma trận | Chương trình chưa có phiên bản nào rời Nháp | `DRAFT` | R1; R3 và R4 trong phạm vi | H-4, M-2 |
| PB-03 | `DRAFT` | Ban hành phiên bản khởi tạo | Chương trình chưa có phiên bản nào rời Nháp; không còn lỗi chặn (EC-05, EC-06, EC-08, EC-09); mọi dòng khung có đề cương (EC-44); nhập `decisionNumber`, `signedDate`, `effectiveSemester`, khóa áp dụng; `Semester.startDate` của học kỳ hiệu lực chưa tới | `PENDING` | R1 | H-1, FR-70, BR-24, BR-25 |
| PB-04 | `DRAFT` | Ban hành phiên bản khởi tạo cho dữ liệu đã có hiệu lực từ trước | Như PB-03, nhưng `Semester.startDate` của học kỳ hiệu lực đã qua | `ACTIVE` | R1 | H-1, S-7 |
| PB-05 | `[*]` | Đề xuất được duyệt cấp cuối (DX-10) | Một phiên bản mới cho **mỗi** chương trình bị tác động, chép từ phiên bản làm nền (`previousVersion`) rồi áp các `ChangeItem`; `sourceRequest` = đề xuất; số phiên bản tăng theo BR-24 | `PENDING` | Hệ thống | FR-69, DEC-01, E-3, C01, UC-49, EC-38 |
| PB-06 | `PENDING` | Tới `Semester.startDate` của `effectiveSemester` | Trong cùng một giao dịch, phiên bản Đang hiệu lực hiện có của chương trình chuyển Lịch sử (PB-07), để không lúc nào có hai phiên bản Đang hiệu lực | `ACTIVE` | Hệ thống | BR-22, BR-25, DEC-07 |
| PB-07 | `ACTIVE` | Phiên bản khác của cùng chương trình chuyển Đang hiệu lực | — | `HISTORICAL` | Hệ thống | SRS mục 6.2.1, BR-22 |
| PB-08 | `[*]` | Ban hành phiên bản đính chính | `correctionOf` trỏ tới phiên bản ban hành nhầm; `correctionReason` bắt buộc; các điều kiện ban hành như PB-03. Học kỳ hiệu lực đã bắt đầu thì PB-06 chạy ngay sau đó | `PENDING` | R1 | FR-75, DEC-08, EC-31, UC-53, S-8 |
| PB-09 | `PENDING` | Phiên bản đính chính của nó được ban hành | Phiên bản bị đính chính chưa kịp có hiệu lực | `HISTORICAL` | Hệ thống | DEC-08, S-8 |

**Quy tắc đi kèm**

| Quy tắc | Nội dung | Nguồn |
|---|---|---|
| Không có đường quay lại | Không phiên bản nào quay về Nháp. Không phiên bản nào bị xóa sau khi rời Nháp | FR-71, DEC-08 |
| Lịch sử vẫn được dùng | Phiên bản Lịch sử vẫn là `ProgramEnrollment.appliedVersion` của các khóa cũ và vẫn xem lại được đầy đủ | SRS mục 6.2.1, FR-73, BR-26 |
| Sinh viên không tự chuyển | PB-06 không đổi `ProgramEnrollment` của sinh viên nào | M-8, C07 |
| Số phiên bản | Thay đổi khung hoặc PLO tăng số Chính; thay đổi đề cương hoặc công thức điểm tăng số Phụ | BR-24 |

---

## 5. `Syllabus`

Một bản đề cương của một học phần. Mỗi học phần có nhiều nhất một bản Nháp và nhiều nhất một bản Đã ban hành.

```mermaid
stateDiagram-v2
    state "Nháp" as DRAFT
    state "Đã ban hành" as PUBLISHED
    state "Lịch sử" as HISTORICAL

    [*] --> DRAFT : soạn đề cương lần đầu
    DRAFT --> PUBLISHED : được ghim bởi phiên bản CTĐT rời Nháp
    [*] --> PUBLISHED : đề xuất sửa đề cương được duyệt cấp cuối
    PUBLISHED --> HISTORICAL : bản kế tiếp được ban hành
    HISTORICAL --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| DC-01 | `[*]` | Soạn đề cương lần đầu cho học phần | Học phần chưa có bản đề cương nào | `DRAFT` | R1; R3, R4, R5 trong phạm vi | FR-44, H-4, UC-33 |
| DC-02 | `DRAFT` | Sửa trực tiếp nội dung, CLO, công thức điểm | Tổng trọng số bằng 100% thì mới lưu được công thức điểm (BR-12, EC-39) | `DRAFT` | R1; R3, R4, R5 trong phạm vi | H-4, UC-33, UC-35 |
| DC-03 | `DRAFT` | Lần đầu được ghim bởi một `ProgramVersion` rời Nháp (PB-03, PB-04, PB-05) | `courseDescription`, `objectives` có nội dung; tổng trọng số 100% (BR-12); mọi CLO có thành phần đánh giá (BR-14); thành phần điều kiện có ngưỡng (BR-15). Ghi `publishedAt` | `PUBLISHED` | Hệ thống | M-1, EC-44, FR-69 |
| DC-04 | `[*]` | Đề xuất có thay đổi đề cương, CLO hoặc công thức điểm được duyệt cấp cuối (DX-10) | Bản mới chép từ bản Đã ban hành (`previousVersion`) rồi áp `ChangeItem`; `sourceRequest` = đề xuất; `revisionNumber` tăng 1 | `PUBLISHED` | Hệ thống | M-1, M-2, DEC-02, S-9 |
| DC-05 | `PUBLISHED` | Bản kế tiếp của cùng học phần được ban hành (DC-04) | — | `HISTORICAL` | Hệ thống | M-1, S-9 |

Bản Đã ban hành và bản Lịch sử đều bất biến. Bản nào **đang áp dụng** cho một chương trình không đọc từ `status` mà đọc từ `CurriculumItem.syllabus` của phiên bản chương trình tương ứng (xem S-9).

---

## 6. `Course`

```mermaid
stateDiagram-v2
    state "Đang sử dụng" as ACTIVE
    state "Ngừng mở lớp" as DISCONTINUED
    state "Đã hủy" as CANCELLED

    [*] --> ACTIVE : thêm học phần
    ACTIVE --> DISCONTINUED : ngừng mở lớp
    DISCONTINUED --> ACTIVE : mở lại
    ACTIVE --> CANCELLED : hủy
    DISCONTINUED --> CANCELLED : hủy
    CANCELLED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| HP-01 | `[*]` | Thêm học phần vào danh mục | `courseCode` chưa tồn tại; `credits` ≥ 0 (BR-01) | `ACTIVE` | R1 | FR-11, FR-15, UC-11 |
| HP-02 | `ACTIVE` | Ngừng mở lớp | Đã có `CourseRelation` loại QH5 từ học phần này tới một học phần Đang sử dụng | `DISCONTINUED` | R1 | FR-15, EC-12, EC-32, UC-12 |
| HP-03 | `DISCONTINUED` | Mở lại | — | `ACTIVE` | R1 | S-10 |
| HP-04 | `ACTIVE` · `DISCONTINUED` | Hủy | Học phần không nằm trong `CurriculumItem` của phiên bản nào đã rời Nháp và không có `AcademicResult`. Sai điều kiện thì chỉ được chuyển Ngừng mở lớp | `CANCELLED` | R1 | FR-15, EC-50, S-10 |

Không có thao tác xóa cứng học phần (EC-50). Đã hủy là trạng thái cuối.

---

## 7. `ApprovalDelegation`

```mermaid
stateDiagram-v2
    state "Hiệu lực" as ACTIVE
    state "Hết hạn" as EXPIRED
    state "Đã thu hồi" as REVOKED

    [*] --> ACTIVE : tạo ủy quyền
    ACTIVE --> EXPIRED : qua ngày kết thúc
    ACTIVE --> REVOKED : thu hồi sớm
    EXPIRED --> [*]
    REVOKED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| UQ-01 | `[*]` | Tạo ủy quyền | `delegate` khác `delegator` và đang Hoạt động; `validTo` không trước `validFrom`; người ủy quyền đang là người duyệt của cấp nêu ở `scope` | `ACTIVE` | R3, R4 cho chính mình; R1 cho bất kỳ ai | FR-09, EC-25, UC-08 |
| UQ-02 | `ACTIVE` | Qua `validTo` | — | `EXPIRED` | Hệ thống | FR-09 |
| UQ-03 | `ACTIVE` | Thu hồi sớm | Người thu hồi là `delegator` hoặc R1 | `REVOKED` | R3, R4, R1 | UC-08, S-11 |
| UQ-04 | `ACTIVE` | Một trong hai tài khoản chuyển Vô hiệu hóa | — | `REVOKED` | Hệ thống | EC-51, S-11 |

Ủy quyền ở trạng thái Hiệu lực chỉ dùng được khi ngày hiện tại nằm trong khoảng `validFrom`..`validTo` (S-11).

---

## 8. `ImportBatch`

Một lần nhập Excel, theo quy trình của SRS mục 6.3.

```mermaid
stateDiagram-v2
    state "Đang chạy thử" as VALIDATING
    state "Chạy thử" as DRY_RUN
    state "Đang ghi" as COMMITTING
    state "Đã ghi" as COMMITTED
    state "Không ghi do lỗi" as ABORTED

    [*] --> ABORTED : tệp sai định dạng
    [*] --> VALIDATING : tải tệp lên
    VALIDATING --> DRY_RUN : không có dòng lỗi
    VALIDATING --> ABORTED : có dòng lỗi, hoặc xử lý hỏng
    DRY_RUN --> COMMITTING : xác nhận ghi
    COMMITTING --> COMMITTED : kiểm tra lại không lỗi, đã ghi
    COMMITTING --> ABORTED : kiểm tra lại phát sinh lỗi, hoặc ghi hỏng
    COMMITTED --> [*]
    ABORTED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| NL-01 | `[*]` | Tải tệp lên | Tệp đúng định dạng mẫu: đủ cột bắt buộc, có dòng dữ liệu. Tệp được lưu, tác vụ nền bắt đầu chạy thử | `VALIDATING` | R1; R3 trong phạm vi phân công | FR-34, SRS mục 6.3, UC-72 |
| NL-02 | `[*]` | Tải tệp lên | Tệp sai định dạng (EC-47): báo ngay tên cột sai, không kiểm từng dòng. `errorReport` ghi lỗi định dạng | `ABORTED` | R1; R3 trong phạm vi phân công | FR-34, EC-47 |
| NL-03 | `VALIDATING` | Chạy thử xong | `errorRows` = 0. Dòng mức CẢNH BÁO, LƯU Ý không chặn. Chưa ghi dữ liệu nghiệp vụ | `DRY_RUN` | Hệ thống | FR-34 |
| NL-04 | `VALIDATING` | Chạy thử xong | `errorRows` > 0 (EC-45, EC-46, chu trình tiên quyết), hoặc tác vụ nền hỏng sau số lần thử lại. `errorReport` ghi từng dòng | `ABORTED` | Hệ thống | FR-34, FR-35, EC-45, EC-46 |
| NL-05 | `DRY_RUN` | Xác nhận ghi | Người đã chạy thử; tệp gốc còn lưu; với khung chương trình, phiên bản vẫn là bản nháp của chương trình chưa từng ban hành | `COMMITTING` | Người đã chạy thử | FR-35, UC-73 |
| NL-06 | `COMMITTING` | Ghi xong | Hệ thống kiểm tra lại toàn bộ tệp (UC-75) và vẫn không có lỗi; ghi toàn bộ trong một giao dịch | `COMMITTED` | Hệ thống | FR-35, FR-101 |
| NL-07 | `COMMITTING` | Ghi không thành | Kiểm tra lại phát sinh lỗi vì dữ liệu nền đã đổi sau lúc chạy thử, phiên bản không còn là bản nháp, hoặc việc ghi hỏng sau số lần thử lại; hoàn tác toàn bộ, `errorReport` ghi báo cáo mới | `ABORTED` | Hệ thống | FR-35, S-12 |
| NL-08 | `VALIDATING`, `COMMITTING` | Dọn hằng ngày | Phiên đứng ở trạng thái đang xử lý quá một giờ (tác vụ nền đã mất) | `ABORTED` | Hệ thống | F09-05 |

Phiên Chạy thử không được xác nhận thì giữ nguyên Chạy thử và vẫn nằm trong lịch sử phiên nhập (FR-101). Sau 30 ngày tệp gốc bị xóa; phiên vẫn còn nhưng không xác nhận ghi được nữa (F09-05).

---

## 9. `SyncLog`

Một lần đồng bộ với cơ sở dữ liệu có sẵn của Trường.

```mermaid
stateDiagram-v2
    state "Đang chạy" as RUNNING
    state "Thành công" as SUCCEEDED
    state "Thất bại" as FAILED

    [*] --> RUNNING : tới lịch đồng bộ
    RUNNING --> SUCCEEDED : ghi xong toàn bộ
    RUNNING --> FAILED : mất kết nối hoặc lỗi
    SUCCEEDED --> [*]
    FAILED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| DB-01 | `[*]` | Tới lịch đồng bộ, hoặc R1 bấm chạy ngay | Kết nối chỉ đọc đã cấu hình; không có lần đồng bộ nào khác Đang chạy | `RUNNING` | Hệ thống; R1 | FR-98, FR-99, UC-77 |
| DB-02 | `RUNNING` | Đọc và ghi xong toàn bộ | Bản ghi mâu thuẫn giữa hai nguồn được xử lý theo quy tắc ưu tiên của SRS mục 8.2 và đếm vào `conflictCount` | `SUCCEEDED` | Hệ thống | FR-100, EC-48, DEC-10 |
| DB-03 | `RUNNING` | Mất kết nối hoặc lỗi bất kỳ | Hoàn tác toàn bộ dữ liệu của lần chạy; ghi `errorMessage`; lần kế tiếp chạy theo lịch | `FAILED` | Hệ thống | EC-49 |
| DB-04 | `RUNNING` | Lần chạy bị treo quá thời hạn cấu hình | Phát hiện khi tới lịch kế tiếp | `FAILED` | Hệ thống | S-13 |

---

## 10. `ProgramEnrollment`

Sinh viên theo một chương trình ở một phiên bản cụ thể.

```mermaid
stateDiagram-v2
    state "Đang theo học" as ACTIVE
    state "Đã chuyển" as TRANSFERRED
    state "Đã kết thúc" as ENDED

    [*] --> ACTIVE : gắn sinh viên vào phiên bản
    ACTIVE --> TRANSFERRED : gắn sang phiên bản hoặc chương trình khác
    ACTIVE --> ENDED : tốt nghiệp hoặc thôi học
    TRANSFERRED --> [*]
    ENDED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| GD-01 | `[*]` | Gắn sinh viên vào phiên bản theo khóa | Có `CohortVersion` cho khóa của sinh viên; phiên bản không ở Nháp; sinh viên chưa có dòng Đang theo học của chương trình đó; `isException` = Không | `ACTIVE` | Hệ thống, khi nhập hoặc đồng bộ sinh viên | FR-74, BR-26, M-8, UC-65 |
| GD-02 | `[*]` | Gắn riêng một sinh viên | `isException` = Có; `basisDecision` bắt buộc; phiên bản không ở Nháp. Song ngành thì `enrollmentType` = `SECOND_MAJOR` (EC-34) | `ACTIVE` | R1 | BR-26, EC-33, EC-34, EC-35, UC-52 |
| GD-03 | `ACTIVE` | Sinh viên được gắn sang phiên bản khác của cùng chương trình, hoặc sang chương trình khác | Dòng mới (GD-01 hoặc GD-02) được tạo trong cùng giao dịch | `TRANSFERRED` | R1 | BR-26, EC-33, EC-35, E-9, UC-52 |
| GD-04 | `ACTIVE` | `Student.status` chuyển Thôi học hoặc Đã tốt nghiệp | — | `ENDED` | Hệ thống | E-10, S-14 |

Sinh viên Bảo lưu giữ nguyên dòng Đang theo học và phiên bản của khóa gốc (EC-37). Ban hành phiên bản mới không kích hoạt GD-03 (M-8).

---

## 11. `Student`

Trạng thái của sinh viên do nguồn dữ liệu quyết định (Excel hoặc cơ sở dữ liệu có sẵn). Hệ thống chỉ đọc và ghi lại, không tự quyết.

```mermaid
stateDiagram-v2
    state "Đang học" as STUDYING
    state "Bảo lưu" as ON_LEAVE
    state "Thôi học" as WITHDRAWN
    state "Đã tốt nghiệp" as GRADUATED

    [*] --> STUDYING : nhập hoặc đồng bộ danh sách
    STUDYING --> ON_LEAVE : nguồn báo bảo lưu
    ON_LEAVE --> STUDYING : nguồn báo nhập học lại
    STUDYING --> WITHDRAWN : nguồn báo thôi học
    ON_LEAVE --> WITHDRAWN : nguồn báo thôi học
    STUDYING --> GRADUATED : nguồn báo đã tốt nghiệp
    WITHDRAWN --> [*]
    GRADUATED --> [*]
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| SV-01 | `[*]` | Nhập danh sách sinh viên từ Excel hoặc đồng bộ | `studentCode` chưa tồn tại. Dòng mới nhận trạng thái mà nguồn ghi, mặc định Đang học | `STUDYING` | R1 qua Excel; E1 qua đồng bộ | FR-96, FR-98, E-10 |
| SV-02 | `STUDYING` | Nguồn ghi trạng thái bảo lưu | — | `ON_LEAVE` | R1 qua Excel; E1 | EC-37, E-10 |
| SV-03 | `ON_LEAVE` | Nguồn ghi trạng thái đang học | Giữ phiên bản của khóa gốc | `STUDYING` | R1 qua Excel; E1 | EC-37 |
| SV-04 | `STUDYING` · `ON_LEAVE` | Nguồn ghi trạng thái thôi học | Kéo theo GD-04 | `WITHDRAWN` | R1 qua Excel; E1 | E-10 |
| SV-05 | `STUDYING` | Nguồn ghi trạng thái đã tốt nghiệp | Kéo theo GD-04. Kết quả `GraduationAudit` = Đủ điều kiện **không** tự gây ra chuyển trạng thái này | `GRADUATED` | R1 qua Excel; E1 | E-10, S-14 |

Khi Excel và cơ sở dữ liệu có sẵn ghi hai trạng thái khác nhau cho cùng sinh viên, cơ sở dữ liệu có sẵn thắng (SRS mục 8.2, DEC-10) và lần đồng bộ ghi một cảnh báo (EC-48).

---

## 12. `AcademicResult`

Hệ thống không nhập điểm (SRS mục 12). Trạng thái của một dòng kết quả đi theo nguồn dữ liệu.

```mermaid
stateDiagram-v2
    state "Đang học" as IN_PROGRESS
    state "Đạt" as PASSED
    state "Không đạt" as FAILED
    state "Miễn" as EXEMPT

    [*] --> IN_PROGRESS : nguồn ghi lượt học chưa có điểm
    [*] --> PASSED : nguồn ghi điểm đạt
    [*] --> FAILED : nguồn ghi điểm không đạt
    [*] --> EXEMPT : nguồn ghi miễn học
    IN_PROGRESS --> PASSED : có điểm đạt
    IN_PROGRESS --> FAILED : có điểm không đạt
    PASSED --> FAILED : nguồn sửa điểm
    FAILED --> PASSED : nguồn sửa điểm
```

| # | Từ | Sự kiện | Điều kiện | Đến | Tác nhân | Nguồn |
|---|---|---|---|---|---|---|
| KQ-01 | `[*]` | Nhập hoặc đồng bộ một lượt học của một học phần trong một học kỳ | Chưa có dòng cho bộ (`student`, `course`, `semester`). Trạng thái lấy theo nguồn | `IN_PROGRESS` · `PASSED` · `FAILED` · `EXEMPT` | R1 qua Excel; E1 | FR-96, FR-98, DEC-11 |
| KQ-02 | `IN_PROGRESS` | Nguồn có điểm | Đạt hay Không đạt do nguồn ghi; hệ thống lưu ba thang điểm và không tự tính lại | `PASSED` · `FAILED` | R1 qua Excel; E1 | DEC-11, Q-03 |
| KQ-03 | `PASSED` · `FAILED` | Nguồn sửa điểm hồi tố | Nếu sinh viên đã có `GraduationAudit`, hệ thống xét lại, lưu một dòng kết quả mới và thông báo cho Phòng Đào tạo | `FAILED` · `PASSED` | R1 qua Excel; E1 | EC-43 |

Học lại hoặc học cải thiện tạo dòng mới ở học kỳ khác, không sửa dòng cũ; khi tính toán lấy điểm cao nhất (EC-36).

---

## 13. Thực thể chỉ có hai trạng thái

Không vẽ sơ đồ. Cả hai chiều chuyển đều được phép trừ khi bảng ghi khác.

| Thực thể | Thuộc tính | Hai trạng thái | Ai chuyển | Điều kiện, ghi chú | Nguồn |
|---|---|---|---|---|---|
| `OrgUnit` | `status` | `ACTIVE` Đang hoạt động · `INACTIVE` Ngừng hoạt động | R1 | Không xóa đơn vị đã có dữ liệu; ngừng thay cho xóa | FR-01, UC-02 |
| `SubjectGroup` | `status` | `ACTIVE` Đang sử dụng · `INACTIVE` Ngừng sử dụng | R1 | Ngừng thay cho xóa | FR-02, UC-02 |
| `User` | `status` | `ACTIVE` Hoạt động · `DISABLED` Vô hiệu hóa | R1 | Tài khoản đã phát sinh giao dịch chỉ được vô hiệu hóa, không xóa cứng. Vô hiệu hóa kéo theo UQ-04 | FR-06, EC-51, EC-29, UC-05 |
| `Program` | `status` | `ACTIVE` Đang sử dụng · `INACTIVE` Ngừng sử dụng | R1 | Chương trình đang có sinh viên chỉ được chuyển Ngừng sử dụng; cấm xóa cứng | EC-50 |
| `Notification` | `readStatus` | `UNREAD` Chưa đọc · `READ` Đã đọc | Người nhận | Một chiều: Chưa đọc → Đã đọc | FR-63, UC-47 |
| `IntegrationClient` | `status` | `ACTIVE` Hoạt động · `LOCKED` Đã khóa | R1 | Bên bị khóa thì mọi lời gọi API bị từ chối | FR-94, API-03 |

`GraduationAudit.conclusion` (Đủ điều kiện · Chưa đủ điều kiện) không phải vòng đời: mỗi lần xét tạo một dòng mới, dòng cũ không đổi (M-9).

---

## 14. Điểm còn hở

Các lựa chọn dưới đây là **tạm thời**. Cột "Ảnh hưởng" ghi những gì phải sửa nếu lựa chọn đổi.

| # | Vấn đề | Liên quan | Lựa chọn tạm | Ảnh hưởng nếu đổi |
|---|---|---|---|---|
| S-1 | **Ban lãnh đạo khoa có tạo đề xuất không.** Ma trận SRS mục 3.4 ghi R2 không có quyền "Tạo đề xuất thay đổi"; UC-09 và UC-37 lại liệt kê R2 là tác nhân | SRS mục 3.4, UC-09, UC-37, E-4 | Theo SRS: R2 không tạo đề xuất về dữ liệu đào tạo. R2 và R4 chỉ tạo được loại "Thay đổi tổ chức / phân công", loại này đi DX-06 thẳng tới Phòng Đào tạo | DX-01, DX-06; quyền trên màn hình tạo đề xuất |
| S-2 | **Xóa đề xuất nháp.** UC-37 cho xóa nháp; FR-67 đòi giữ lịch sử duyệt đầy đủ | UC-37, FR-67 | Chỉ xóa được nháp chưa từng gửi (`submissionRound` = 0). Nháp đã từng bị trả lại thì không xóa, chỉ để yên hoặc gửi lại | DX-03 |
| S-3 | **"Chưa có cấp nào phê duyệt" khi một cấp có nhiều người.** FR-60 không nói trường hợp một trong nhiều điều phối đã đồng ý nhưng cấp chưa xong | FR-60, EC-22 | Chặt hơn: chỉ cần một người đã bấm Đồng ý là không thu hồi được. Cấp bị bỏ qua không tính là đã phê duyệt | DX-14 |
| S-4 | **`ApprovalStep.action` thiếu giá trị cho cấp bị bỏ qua và cho dòng bị bỏ dở.** Danh sách hiện có: Chờ · Đồng ý · Trả lại · Từ chối | `ApprovalStep`, FR-61, FR-65 | Cấp bị bỏ qua ghi Đồng ý kèm `isSkipped` = Có. Dòng còn Chờ khi đề xuất bị trả lại, từ chối hoặc thu hồi thì giữ nguyên Chờ và bị loại khỏi hàng đợi bằng điều kiện `submissionRound` và trạng thái đề xuất | BD-02, DX-12; nếu thêm giá trị "Bỏ qua" và "Đã đóng" vào từ điển dữ liệu thì hai quy tắc này gọn hơn |
| S-5 | **Học kỳ hiệu lực đã bắt đầu hoặc chưa có ngày bắt đầu.** `Semester.startDate` được để trống; BR-16 cấm hồi tố | BR-16, BR-25, DEC-07, `Semester` | Khi duyệt cấp cuối, học kỳ hiệu lực phải có `startDate` và ngày đó chưa tới. Ngoại lệ duy nhất là ban hành khởi tạo (PB-04) | DX-10, DX-11, PB-06; tác vụ kích hoạt đầu học kỳ |
| S-6 | **Phòng Đào tạo không đồng ý sau khi hai cấp dưới đã đồng ý.** EC-26 viết "từ chối" nhưng kết quả là về Nháp; SRS mục 6.1 viết Từ chối là đóng | EC-26, C02, BR-29 | Hai nút riêng ở cả ba cấp: Trả lại → Nháp, Từ chối → Từ chối (đóng). EC-26 được hiểu là Trả lại | DX-12, DX-13 |
| S-7 | **Nạp các phiên bản đã có trước khi dùng hệ thống.** Ví dụ SRS mục 6.2.3 có ba phiên bản 1.0, 1.1, 2.0 cùng còn khóa đang học; H-1 chỉ cho ban hành khởi tạo một lần | H-1, SRS mục 6.2.3, BR-22 | Ban hành khởi tạo dùng cho phiên bản cũ nhất còn khóa đang học, cho phép học kỳ hiệu lực đã qua (PB-04). Các phiên bản sau đó nạp bằng đề xuất do Phòng Đào tạo tạo; riêng trong đợt nạp ban đầu, điều kiện "học kỳ chưa tới" của S-5 được Phòng Đào tạo bỏ qua có ghi nhật ký | PB-04, DX-10; có thể cần một thuộc tính đánh dấu "nạp dữ liệu lịch sử" trên `ChangeRequest` |
| S-8 | **Phiên bản đính chính có đi qua ba cấp duyệt không.** UC-53 ghi đi qua luồng duyệt; từ điển dữ liệu ghi `ProgramVersion.sourceRequest` trống ở bản đính chính; ma trận SRS chỉ cho R1 ban hành | UC-53, FR-75, DEC-08, `ProgramVersion` | R1 ban hành đính chính trực tiếp, bắt buộc `correctionReason`, không qua cấp 1 và 2. Bản đính chính tăng số Phụ. Bản bị đính chính chuyển Lịch sử, kể cả khi chưa kịp có hiệu lực (PB-09) | PB-08, PB-09; nếu phải qua ba cấp thì bản đính chính sinh từ DX-10 và `sourceRequest` có giá trị |
| S-9 | **Đề cương đã duyệt nhưng chưa tới học kỳ hiệu lực không có trạng thái riêng.** `Syllabus` chỉ có Nháp · Đã ban hành · Lịch sử, trong khi BR-16 nói công thức điểm mới chỉ áp dụng từ học kỳ kế tiếp | BR-16, DEC-07, C10, M-1 | Bản mới chuyển Đã ban hành ngay khi duyệt cấp cuối, bản trước chuyển Lịch sử cùng lúc. Bản đang áp dụng được xác định qua `CurriculumItem.syllabus` của phiên bản chương trình Đang hiệu lực, không qua `status` | DC-04, DC-05; màn hình và API tra cứu đề cương phải nhận ngữ cảnh chương trình hoặc học kỳ. Nếu thêm trạng thái "Chờ hiệu lực" cho đề cương thì sửa từ điển dữ liệu |
| S-10 | **Ý nghĩa của "Đã hủy" và việc mở lại học phần.** SRS chỉ liệt kê ba trạng thái, không nêu chuyển nào được phép | FR-15, EC-50 | Đã hủy dành cho học phần chưa từng nằm trong phiên bản đã ban hành và chưa có kết quả học tập; là trạng thái cuối. Ngừng mở lớp mở lại được | HP-03, HP-04 |
| S-11 | **Ủy quyền có ngày bắt đầu ở tương lai, và ủy quyền của tài khoản bị vô hiệu hóa.** Danh sách trạng thái không có "Chưa hiệu lực" | FR-09, `ApprovalDelegation` | Dòng nhận Hiệu lực ngay khi tạo; chỉ dùng được trong khoảng `validFrom`..`validTo`. Vô hiệu hóa một trong hai tài khoản thì ủy quyền tự chuyển Đã thu hồi | UQ-01, UQ-04 |
| S-12 | **Dữ liệu nền đổi giữa lúc chạy thử và lúc xác nhận.** SRS mục 6.3 không nói bước xác nhận có kiểm tra lại không | SRS mục 6.3, UC-73, UC-75 | Xác nhận luôn kiểm tra lại toàn bộ tệp; có lỗi thì không ghi gì và phiên chuyển Không ghi do lỗi | NL-03, NL-04 |
| S-13 | **Lần đồng bộ bị treo.** EC-49 chỉ nói trường hợp mất kết nối được phát hiện | EC-49, `SyncLog` | Lần chạy Đang chạy quá một thời hạn cấu hình được (NFR-24) thì bị đánh Thất bại khi tới lịch kế tiếp | DB-04; thêm một tham số cấu hình (E-7) |
| S-14 | **Ai đặt trạng thái "Đã tốt nghiệp".** Hệ thống xét điều kiện tốt nghiệp nhưng việc công nhận tốt nghiệp nằm ngoài phạm vi | SRS mục 12, E-10, FR-84 | Trạng thái sinh viên chỉ đổi theo nguồn dữ liệu. Kết quả xét Đủ điều kiện không tự đổi `Student.status` | SV-05, GD-04 |
