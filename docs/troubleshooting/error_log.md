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
