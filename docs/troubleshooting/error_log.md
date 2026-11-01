# Error Log

Append-only. Every real bug (crash, hang, wrong state, silent failure) gets an entry here
when it's fixed, per `ai-rules.md` Rule 11. Never edit or delete past entries. Newest
entries go at the bottom.

Format:
```
## [YYYY-MM-DD] Short title
**Symptom**: what was observed
**Possible cause**: the mechanism
**Resolution**: what changed
**How to avoid**: the general lesson
```

---

## [2026-10-15] `pnpm install` hỏng ở bước `prisma generate` khi chưa có biến `DATABASE_URL`
**Symptom**: `pnpm install` trong `source/backend` dừng ở `postinstall` với lỗi Prisma báo thiếu biến môi trường `DATABASE_URL`, dù `prisma generate` không cần kết nối cơ sở dữ liệu.
**Possible cause**: `prisma.config.ts` dùng `env('DATABASE_URL')` của `prisma/config`; hàm này ném lỗi ngay khi biến chưa đặt. `postinstall` chạy trên máy mới, trước khi ai kịp tạo tệp biến môi trường.
**Resolution**: `source/backend/prisma.config.ts` đọc `process.env.DATABASE_URL` trực tiếp (có thể `undefined`); lệnh cần kết nối thật (`migrate`) vẫn báo lỗi rõ khi thiếu.
**How to avoid**: Mọi tệp cấu hình được đọc trong lúc cài đặt hoặc sinh mã không được đòi biến môi trường chỉ cần lúc chạy. Kiểm bằng cách cài trên một bản sao sạch không có tệp biến môi trường.

## [2026-10-15] `REDIS_PORT` hợp lệ vẫn bị báo sai kiểu, ứng dụng không khởi động
**Symptom**: Đặt `REDIS_PORT=6379` thì ứng dụng dừng lúc khởi động với "REDIS_PORT must be an integer number".
**Possible cause**: `plainToInstance(..., { enableImplicitConversion: true })` đổi kiểu theo metadata `design:type`. Thuộc tính có giá trị mặc định nhưng không ghi kiểu (`REDIS_PORT = 6379`) được TypeScript phát metadata là `Object`, nên chuỗi `"6379"` không được đổi sang số và `@IsInt` thất bại. Không đặt biến thì giá trị mặc định là số nên lỗi chỉ hiện khi có biến.
**Resolution**: `source/backend/src/config/env.validation.ts` ghi kiểu tường minh cho mọi thuộc tính (`PORT: number = 3000`, `REDIS_PORT: number = 6379`); thêm chú thích giải thích tại chỗ.
**How to avoid**: Với class-transformer, mọi thuộc tính cần đổi kiểu ngầm phải có chú thích kiểu tường minh — kể cả khi đã có giá trị mặc định. Áp dụng cho DTO truy vấn (`?page=2`) như với lớp biến môi trường; kiểm thử phải đi qua nhánh có giá trị chuỗi, không chỉ nhánh mặc định.

## [2026-10-21] Form tài khoản hiện mã constraint thay vì thông báo lỗi tiếng Việt
**Symptom**: Khi tạo hoặc sửa tài khoản bị trùng tên đăng nhập hoặc mã người dùng, dưới trường hiện “unique” thay vì thông báo tiếng Việt; lỗi không có chi tiết trường bị bỏ qua, không có phản hồi cho người dùng.
**Possible cause**: `UserFormModal` ghép `details[].constraints` làm nội dung lỗi, dù máy chủ gửi câu tiếng Việt trong `message`. Mock unit test đặt câu tiếng Việt vào constraints nên che lỗi; nhánh catch không xử lý lỗi thiếu chi tiết trường.
**Resolution**: Dùng `applyFieldErrors(form, error)` để hiển thị message của máy chủ dưới trường; nếu không ánh xạ được thì hiện toast qua `errorMessage` với dự phòng “Không lưu được tài khoản.”. Sửa mock tên đăng nhập trùng cho đúng phản hồi thật, kiểm không hiện “unique”, bổ sung test toast dự phòng và cập nhật hai assertion Playwright cùng Expected Result tương ứng.
**How to avoid**: Lỗi gắn trường phải hiển thị `message` của máy chủ, không hiển thị mã `constraints`. Mock unit test phải khớp phản hồi thực tế của backend; nếu thay mã kỹ thuật bằng câu hiển thị, test có thể đạt ngay trên hành vi lỗi. Kiểm cả phản hồi nghiệp vụ có chi tiết trường và lỗi không thể gắn trường để tránh thất bại im lặng.

## [2026-10-22] Ô “CLO đạt được” không tìm được CLO theo mã
**Symptom**: Trong hộp thoại thêm/sửa tuần của đề cương, gõ `CLO1` vào ô đa chọn “CLO đạt được” thì danh sách hiện “Trống”, dù đề cương có CLO1.
**Possible cause**: `Select` của AntD mặc định lọc theo `value`. Lựa chọn dùng `value` là cuid của CLO và `label` là mã CLO, nên chuỗi gõ được so với cuid và không bao giờ khớp.
**Resolution**: `source/frontend/src/features/syllabi/components/WeeklyContentModal.tsx` thêm `optionFilterProp="label"` cho ô chọn CLO, giống `shared/org-units/OrgUnitSelect.tsx`.
**How to avoid**: Mọi `Select` có `value` là id và `label` là chữ người đọc phải đặt `optionFilterProp="label"` (hoặc `filterOption` riêng). Rà các `Select` dùng `options={...map((x) => ({ value: x.id, label: ... }))}` mà không có thuộc tính này.

## [2026-10-22] Phê duyệt cuối hiện mã thô `SYLLABUS_INCOMPLETE` ở cột Vấn đề
**Symptom**: Màn hình “Phê duyệt cuối và ban hành” liệt kê vấn đề đề cương dạng `<mã học phần>: SYLLABUS_INCOMPLETE` thay vì câu tiếng Việt và không nói thiếu gì.
**Possible cause**: `FinalApprovalPreview.tsx` ghép thẳng `issue.code` vào nội dung. Bảng nhãn `SYLLABUS_ISSUE_LABELS` chỉ có ở tính năng releases (`ReleaseCheckPanel.tsx`), và quy tắc cấm import chéo tính năng nên màn hình đề xuất không dùng lại được; `details` (điều kiện còn thiếu) bị bỏ qua.
**Resolution**: `source/frontend/src/features/change-requests/components/FinalApprovalPreview.tsx` thêm `SYLLABUS_ISSUE_LABELS` cục bộ và hàm `syllabusIssueText` hiển thị “mã học phần: nhãn — chi tiết”, dịch `details` qua `CONDITION_LABELS` sẵn có, giống `ReleaseCheckPanel.tsx`.
**How to avoid**: Mã lỗi từ API (`code`, `details`) không bao giờ được đưa thẳng ra giao diện. Khi hai tính năng cùng hiển thị một loại mã, rà cả hai chỗ hiển thị; nếu bảng nhãn bị nhân bản vì quy tắc import, cân nhắc đưa nó vào `src/shared/`.

## [2026-10-22] Xác nhận xóa ô trọng số tự đóng, không bấm được “Xóa”
**Symptom**: Ở ma trận học phần–PLO, xóa trắng ô có liên kết CLO rồi nhấn Enter: hộp xác nhận “Xóa ô học phần–PLO?” hiện lên rồi tự đóng ngay, ô vẫn giữ trọng số, không có yêu cầu DELETE.
**Possible cause**: `WeightCell` mở `modal.confirm` ngay trong trình xử lý keydown của Enter. Confirm lấy focus cho nút “Hủy” trước khi sự kiện phím kết thúc, nên hành động mặc định của Enter (kích hoạt nút đang focus) rơi vào “Hủy” và đóng hộp thoại. Ghi sự kiện DOM trên trình duyệt thấy `keydown Enter` ở input → `focusin` nút Hủy → `click` nút Hủy → modal bị gỡ. Giả thuyết Enter + blur gọi `commit` hai lần đã bị loại: khi chặn hành động mặc định mà không thêm chốt chống gọi lại, chỉ có một hộp thoại và nó ở lại.
**Resolution**: `source/frontend/src/features/outcomes/components/WeightCell.tsx` gọi `event.preventDefault()` trong `onPressEnter` trước `commit()`.
**How to avoid**: Không mở hộp thoại hoặc dời focus trong trình xử lý keydown của Enter/Space mà không `preventDefault()` — hành động mặc định của phím sẽ chạy trên phần tử vừa nhận focus. Test Playwright báo “element is not stable” rồi “detached” trên nút trong modal là dấu hiệu modal bị đóng ngoài ý muốn, không phải test chậm.

## [2026-10-26] API nhập Excel không khởi động vì import runtime multer ngoài dependency trực tiếp
**Symptom**: Orchestrator chạy e2e imports/permission-table với Testcontainers nhưng ứng dụng không boot: `ERR_MODULE_NOT_FOUND: Cannot find package 'multer'`, tại imports.controller.ts. Unit specs feature trước đó vẫn đạt vì không load controller/AppModule.
**Possible cause**: Controller import memoryStorage trực tiếp từ multer; dự án chỉ có @types/multer trực tiếp và multer là dependency của Nest platform. pnpm strict layout không cho ứng dụng resolve dependency bắc cầu như một dependency trực tiếp; có kiểu TypeScript không chứng minh có module runtime.
**Resolution**: Orchestrator đã xóa import memoryStorage và thuộc tính storage trong FileInterceptor, giữ limits và dùng memory storage mặc định như các controller upload hiện có. Lượt sửa tiếp nối giữ nguyên fix đó, không thêm dependency. Type-check/lint/unit không thay thế lần boot/e2e thật của orchestrator.
**How to avoid**: Không import package runtime chỉ vì @types hoặc dependency bắc cầu tồn tại. Tái sử dụng default của abstraction đang dùng nếu đáp ứng yêu cầu; khi cần import trực tiếp phải có dependency trực tiếp được phê duyệt. Kiểm đường boot của AppModule trên môi trường pnpm thật, không suy luận từ unit specs chỉ import service.

## [2026-10-26] Tắt ứng dụng bị treo ở queue nhập Excel khi Redis đã dừng
**Symptom**: Health e2e của orchestrator đạt 3/3 nhưng `afterAll` timeout 180 giây tại `await app.close()` sau khi dừng Redis. Bỏ ImportsModule thì hết; chỉ bỏ `queue.close()` khỏi ImportsProcessor vẫn treo.
**Possible cause**: Queue do `@nestjs/bullmq` 12.0.0 tạo có hook riêng gọi `await this.close()` tại `source/backend/node_modules/@nestjs/bullmq/dist/bull.providers.js:49`. BullMQ 6.3.15 gọi `QueueBase.close()` → `RedisQueueBackend.close(false)` → `RedisConnection.close(false)` và chờ `await this._client.quit()` tại `source/backend/node_modules/bullmq/dist/cjs/classes/redis-connection.js:515`; khi Redis không trả lời, hook không hoàn tất. `forceDisconnectOnShutdown` cũng chỉ chạy sau bước close này. Scheduler dùng chung backend queue, còn ImportsService inject cùng queue, không có kết nối riêng cần xóa.
**Resolution**: Giữ grace tối đa 10 giây cho job đang chạy và `worker.close(true)`; thay `queue.close()` trong ImportsProcessor bằng API công khai `queue.getBackend().close(true)`. Backend đóng cưỡng bức kết nối sở hữu mà không gửi QUIT; hook đóng queue tự động sau đó dùng lại promise đã hoàn tất. Không đổi QueueModule, lịch cleanup, attempts/backoff, giao dịch hay kiểm trạng thái chống retry ghi trùng. Bổ sung unit kiểm grace đầy đủ, hoàn tất sớm, thứ tự đóng worker/backend và scheduler còn chờ không chặn shutdown. Chưa chạy lại health e2e trong sandbox; orchestrator xác nhận với Redis thật.
**How to avoid**: Khi kiểm shutdown phải lần theo cả hook feature lẫn hook queue tự sinh của Nest và mã thư viện đúng phiên bản đang cài. Bỏ close cục bộ hoặc bật forceDisconnectOnShutdown không đủ nếu hook vẫn chờ close mềm trước; không thay bằng disconnect phải chờ kết nối sẵn sàng khi Redis chưa từng kết nối. Kiểm Redis mất sau khởi động và scheduler còn chờ, đồng thời giữ grace, lịch dọn dẹp và tính an toàn khi job chạy lại.

## [2026-10-29] Fixture ban hành dùng chung không còn đạt release-check sau F-12
**Symptom**: Playwright của orchestrator hỏng F17-TC_001..004 (10 đạt/4 hỏng) và năm ca F-16 (9 đạt/5 hỏng), cùng dừng ở assertion canRelease của buildReleaseProgram trong fixtures/change-requests.ts.
**Possible cause**: F-12 thêm assessmentIssues vào điều kiện ban hành đề cương, nhưng shared builder vẫn chỉ tạo mô tả/mục tiêu, không có công thức điểm và ánh xạ thành phần–CLO. Spec F-12 dùng createSyllabus thay vì buildReleaseProgram nên không bắt được hồi quy của fixture ban hành.
**Resolution**: Tái sử dụng createClo mà F-12 đang dùng; mỗi đề cương của builder có CLO1 tổng hợp, thành phần CK 100%, không điều kiện, ngưỡng và điểm liệt null, ánh xạ CK–CLO1 trọng số 100%. Dùng PUT grading-formula và assessment-clo-mappings với updatedAt đọc lại trước mỗi lần lưu. Thêm JSON issues vào assertion release-check. Không đổi điều kiện backend; không chạy Playwright trong lượt sửa, browser được orchestrator xác nhận riêng.
**How to avoid**: Mọi điều kiện publish/release mới phải kiểm trên tất cả shared e2e builder đi tới ban hành, không chỉ spec riêng của feature thêm điều kiện. Giữ chi tiết issues trong assertion và không suy luận release-check xanh từ type-check hoặc unit test.

**Symptom (tiếp nối 2026-10-29)**: F15-TC_001 gặp 409 ASSESSMENT_NOT_READY / ASSESSMENT_FORMULA_EMPTY khi submit; lượt Playwright của orchestrator bị cắt vì thiếu bộ nhớ.
**Possible cause (bổ sung)**: Submit cũng kiểm assessment. Đề cương bổ sung trong F15-TC_001 và setup MVP không qua buildReleaseProgram nên chưa có công thức/ánh xạ.
**Resolution (bổ sung)**: Tách/export prepareSyllabusAssessment; builder, F15-TC_001 và MVP dùng chung helper tạo CLO1, CK 100%, mapping 100%, token mới trước mỗi PUT. Giữ mô tả/mục tiêu trống của F15-TC_001, thiếu syllabus của F15-TC_008 và các ca công thức chưa sẵn sàng của F-12. Rà soát F-13/F-14 submit bản sao, F-16 qua prepareApprovedRelease và F-17 qua studentWorld: đều nhận assessment từ builder. Prettier ba file e2e và E2E tsc đạt exit 0; Playwright chưa chạy lại.
**How to avoid (bổ sung)**: Rà mọi đường tạo dữ liệu tới cả submit và release, kể cả setup serial MVP và course bổ sung trực tiếp trong spec. Không tự sửa dữ liệu trong submit/factory nháp tổng quát vì sẽ che test âm; ghi disposition từng đường gọi và chờ kiểm chứng browser thật.

## [2026-10-29] Mốc kết thúc lượt theo học thiếu ngày bị hiểu thành khoảng mở
**Symptom**: Lỗi tiềm ẩn được phát hiện bằng static review khi xác minh prerequisite F-18, không phải báo cáo sự cố từ người dùng hoặc reproduction đã chạy. Reader có thể coi một enrollment có học kỳ kết thúc nhưng startDate null là còn hiệu lực; SQL picker lại không coi interval đó là bao phủ học kỳ truy vấn. From start thiếu ngày cũng bị lọc trước khi resolver báo lỗi interval.
**Possible cause**: updateSemester chỉ bảo vệ ngày hiệu lực của phiên bản ACTIVE/HISTORICAL, chưa kiểm tra ProgramEnrollment.fromSemesterId/untilSemesterId. Writer yêu cầu ngày đã biết nhưng thao tác sửa lịch sau đó có thể xóa ngày. Reader dùng untilSemester?.startDate ?? null nên mất phân biệt giữa không có học kỳ kết thúc và có học kỳ kết thúc thiếu ngày.
**Resolution**: Theo quyết định ngày 2026-10-29, updateSemester dùng thêm count trên cả hai khóa tham chiếu enrollment trong cùng transaction, trả SEMESTER_IN_USE trước khi ghi khi ngày thay đổi. PeriodRow giữ nguyên sự tồn tại của untilSemester; hasKnownEnrollmentBoundaries tập trung nghĩa của nullable boundary. StudentAppliedVersionReader báo INVALID_ENROLLMENT_INTERVAL trước khi chọn interval thiếu from/end start; AcademicResultsReader dùng coversSemester trả false cho interval thiếu ngày, giữ chính sách STUDENT_NOT_FOUND của R3. Cập nhật toàn bộ caller của coversSemester: resolver, academic reader và predicate spec; không đổi enrollmentCoversWhere. Thêm unit specs và một backend e2e trong releases.e2e-spec.ts kiểm tra không xóa được ngày của end semester và dữ liệu giữ nguyên. Chưa chạy Vitest hoặc backend e2e trong sandbox; không gán Passed cho các regression này.
**How to avoid**: Nullable boundary dùng bởi cả JS predicate và SQL predicate phải được quy về một nghĩa tại một nơi, giữ phân biệt null relation với relation có ngày null. Thao tác xóa hoặc sửa ngày đang được tham chiếu phải kiểm tra mọi referrer, không chỉ referrer của feature tạo ra thao tác sửa. Khi thay shared predicate, liệt kê và cập nhật mọi caller trước khi kiểm chứng parity.

## [2026-10-30] Xác nhận đợt xét tốt nghiệp lỗi gây unhandled promise rejection
**Symptom**: Mỗi lần xác nhận đợt xét thất bại trên MH-54 (ví dụ 409 roster lệch), test frontend ghi nhận unhandled promise rejection.
**Possible cause**: `onOk` của `modal.confirm` trong `GraduationBatchesPage.tsx` ném lại lỗi. ActionButton của AntD reject lại promise đó mà không ai await, nên lỗi rơi ra ngoài thành unhandled rejection.
**Resolution**: `onOk` tự xử lý lỗi (đưa vào state của trang để hiển thị) và đóng dialog trong `finally`; không ném lại. Phát hiện và sửa trong lượt build F-19, kiểm bằng `GraduationBatchesPage.test.tsx` (Vitest 85/85).
**How to avoid**: Không để `onOk` của AntD `modal.confirm` reject, trừ khi chủ ý dùng chế độ im lặng; hiển thị lỗi qua state. Rà các `modal.confirm` khác có `onOk` async ném lại lỗi.

## 2026-10-30 — Dump dữ liệu Trường bị commit lên repo public

- **Triệu chứng**: commit `dd78389` đưa 43 file `source/current-data-dut/` (hồ sơ SV/GV có CMND, SĐT, địa chỉ, cột `Matkhau`, học phí, điểm) lên `origin/main`; repo GitHub đang PUBLIC.
- **Xử lý**: ngừng theo dõi thư mục, thêm vào `.gitignore` (nhánh `chore/remove-school-dump`). File trên đĩa giữ nguyên cho pipeline seed.
- **Còn mở**: lịch sử git vẫn chứa dump. Xử lý dứt điểm cần chuyển repo sang Private và viết lại lịch sử (`git filter-repo`) — người dùng chọn chưa làm.

## [2026-10-31] EnrollmentReconciliationProcessor báo "Dữ liệu gán khóa chưa hợp lệ" trên dữ liệu DUT
**Symptom**: Trên `ctdt_real`, worker đối soát lượt theo học ghi lỗi `INVALID_COHORT_ASSIGNMENT` ("Dữ liệu gán khóa chưa hợp lệ; cần kiểm tra trước khi xác định phiên bản áp dụng."). Truy vấn chỉ đọc cho thấy 38/62 dòng `CohortVersion` trỏ tới phiên bản ACTIVE/HISTORICAL có `decisionNumber` null.
**Possible cause**: `seed-programs.ts` (`pnpm prisma:seed:dut`) tạo phiên bản đã ban hành mà không đặt `decisionNumber`, vì nguồn DUT không có số quyết định. `issuedVersionFact` coi phiên bản thiếu số quyết định là chưa ban hành, nên `normalizeAssignment` từ chối mọi bản gán khóa vào phiên bản đó. Các số `QĐ-EP…` hiện có thuộc thế giới e2e, không phải dữ liệu DUT.
**Resolution**: Seed DUT ghi số giữ chỗ `DUT-<mã CTĐT>-<phiên bản>` cho phiên bản đã ban hành (`dutDecisionPlaceholder`). Khi chạy lại trên DB cũ, seed điền các số còn trống của chương trình đã có, không đổi số đã nhập tay. Chạy lại `pnpm prisma:seed:dut` trên `ctdt_real`: đã điền 41 số, còn 0 bản gán khóa trỏ tới phiên bản thiếu số. Spec mới: `prisma/seed-data/dut/load/seed-programs.spec.ts`.
**How to avoid**: Dữ liệu nhập từ nguồn ngoài phải thỏa cùng điều kiện "đã ban hành" mà luồng phát hành dùng (`issuedVersionFact`): số phiên bản, số quyết định, ngày ban hành, học kỳ hiệu lực. Số giữ chỗ chờ Khoa thay bằng số quyết định thật (nợ C9/C10).

## [2026-10-31] Giảng viên (R5) và sinh viên thấy "Chờ tôi duyệt" và nhóm "Quản trị"
**Symptom**: Đăng nhập R5 vẫn thấy mục "Chờ tôi duyệt" và nhóm menu "Quản trị". Sinh viên R6 cũng thấy nhóm "Quản trị".
**Possible cause**:
- "Chờ tôi duyệt" chỉ kiểm `changeRequest.view`, quyền mà R5 cũng có (để xem đề xuất của mình). Quyền duyệt không phải một mã quyền: người duyệt là R4 và R3 (suy ra từ phân công điều phối nhóm và chủ nhiệm CTĐT), R1 ở cấp 3, cộng người đang nhận ủy quyền.
- Mục "Trạng thái hệ thống" không yêu cầu quyền nào, nên nhóm "Quản trị" luôn có ít nhất một mục hiển thị với mọi vai.
**Resolution**:
- `MeDto.canApprove` = có vai R1/R3/R4 hoặc có ủy quyền còn hiệu lực hôm nay (`usableGrants`). Menu ẩn "Chờ tôi duyệt" khi `canApprove` là false.
- "Trạng thái hệ thống" chỉ hiện cho người có `user.manage`, `permission.view` hoặc `backup.view`.
- Kiểm chứng: spec `me.dto.spec.ts` (3 ca), `menuItems.test.tsx` (2 ca mới); FE 693/693; BE e2e auth 9/9.
**How to avoid**: Mục menu nào cũng phải có điều kiện hiển thị, vì một mục không điều kiện làm cả nhóm hiện ra. Khi một khả năng được quyết định bằng dữ liệu (phân công, ủy quyền) chứ không bằng mã quyền, đưa cờ đã tính sẵn vào `/api/auth/me` thay vì suy từ mã quyền gần giống.

## [2026-11-01] Bảng khung rỗng che hộp thoại "Thêm học phần vào khung"
**Symptom**: Playwright báo `<div class="ant-table-expanded-row-fixed"> ... intercepts pointer events` khi bấm "Lưu" trong "Thêm học phần vào khung" trên khung rỗng; người dùng cũng không bấm được nút.
**Root cause**: `SortableRow` nhận hàng giữ chỗ không khóa của bảng AntD rỗng với id `undefined`; dnd-kit so với `active?.id` (cũng `undefined`) nên coi là đang kéo và nâng z-index 9999. Phần tử sticky `.ant-table-expanded-row-fixed` nằm đè lên hộp thoại.
**Resolution**: PR #47: hàng không khóa render `<tr>` thường, hàng đang kéo dùng z-index 1; thêm `SortableRow.test.tsx`.
**How to avoid**: Component dùng id làm khóa dnd-kit phải xử lý hàng không có khóa; đừng so sánh hai giá trị `undefined`.

## [2026-11-01] Chạy Playwright dài gặp hàng loạt SESSION_REQUIRED
**Symptom**: Lượt chạy đầy đủ 1,2 giờ có 100 ca lỗi `SESSION_REQUIRED`.
**Root cause**: Phiên máy chủ hết hạn sau 60 phút không hoạt động; trạng thái đăng nhập dựng ở setup đã chết khi các spec sau chạy.
**Resolution**: Chạy Playwright theo nhóm spec, mỗi nhóm dưới 60 phút (kết quả ở progress_log 2026-11-01).
**How to avoid**: Không chạy toàn bộ bộ e2e một lượt; chia nhóm hoặc dựng lại phiên giữa các nhóm.
