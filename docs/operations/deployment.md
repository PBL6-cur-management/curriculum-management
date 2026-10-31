# Triển khai, nâng cấp và thử tải (F-27)

## Cài đặt lần đầu

1. Máy chủ có Docker Engine với Compose v2. Node 24 chỉ cần khi build ngoài Docker (`.nvmrc` = 24).
2. Tạo tệp môi trường cho `deploy/compose.yaml` (ngoài repository, không commit): chuỗi kết nối Postgres, `SESSION_SECRET` riêng, `SEED_ADMIN_PASSWORD`, tên miền cho Caddy, `CADDY_IMAGE`. Danh sách biến xem `deploy/README.md`.
3. `docker compose -f deploy/compose.yaml --env-file <env> config --quiet` để kiểm tra cấu hình.
4. `docker compose -f deploy/compose.yaml --env-file <env> up -d --build`. Dịch vụ `migrate` chạy migration rồi thoát; `api` chỉ chạy khi `migrate` thành công.
5. Đổi mật khẩu quản trị ở lần đăng nhập đầu. Không dùng tài khoản `e2e.*` trên môi trường thật.

## Nâng cấp

1. Chạy sao lưu và kiểm tra bản mới nhất (`docs/technical/backup-restore-runbook.md`).
2. Lấy mã mới, chạy lại lệnh `up -d --build`. Migration chạy trước khi `api` khởi động lại.
3. Kiểm tra `GET /api/health` trả 200 ok/up/up.
4. Lỗi: khôi phục theo runbook sao lưu. **Không** chạy `down -v`, xóa volume hay reset trên môi trường thật.

## Thử tải

Chỉ trên môi trường cô lập với dữ liệu tổng hợp, không bao giờ trên dữ liệu thật.

```powershell
scripts\load\Invoke-LoadTest.ps1 -Profile canonical -BaseUrl https://host -Manifest m.json -Credentials c.json -Output D:\evidence\k6
```

- `canonical`: 160 phiên sinh viên và 40 phiên nhân sự trong 15 phút, chỉ đọc. Ngưỡng: tra cứu tối đa 2 giây, kiểm tra đủ điều kiện tối đa 3 giây, không lỗi, không ghi dữ liệu.
- `staff-smoke`: 10 tài khoản nhân sự, 30 giây. Chỉ là kiểm tra khói, kết quả gắn nhãn `SMOKE_ONLY`, **không** thay cho nghiệm thu.
- Chưa có dữ liệu sinh viên tổng hợp (phụ thuộc các tính năng cổng sinh viên): chế độ `canonical` dừng với thông báo "Thiếu dữ liệu thử tải sinh viên; chưa thể nghiệm thu F-27."
- Cấu trúc tệp manifest: `scripts/load/fixture-contract.example.json`. Mật khẩu để ở tệp credentials riêng.

## Vai trò vận hành

| Việc | Người thực hiện |
|---|---|
| Cài đặt, nâng cấp, sao lưu | Quản trị hệ thống (R1 + quyền máy chủ) |
| Xem sao lưu trong giao diện | R1 |
| Duyệt Uptime Kuma, pino, lịch giờ làm việc | Chủ dự án / nhà trường |

## Ma trận hồi quy F-27

| Hạng mục | Kiểm tra | Trạng thái |
|---|---|---|
| Compose hợp lệ | `docker compose config --quiet` | Đã chạy (placeholder) |
| Caddy: `/api/docs*` 404, SPA fallback | Chạy stack thật | Chưa chạy |
| `health-evidence.test.mjs`, `manifest.test.mjs` | `node --test scripts` | Chưa chạy (hoãn đến cuối) |
| `env.validation.spec` LOG_LEVEL | `pnpm test` | Chưa chạy |
| Thử tải canonical | k6 | Bị chặn: thiếu fixture sinh viên |
| Bằng chứng uptime | collector | Cần chạy thật nhiều ngày |
