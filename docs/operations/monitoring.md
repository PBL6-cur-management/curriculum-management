# Giám sát và bằng chứng sẵn sàng (F-27)

## Nguồn tín hiệu

`GET /api/health` trả `200` với `{ status: "ok", database: "up", redis: "up" }` khi hệ thống khỏe, `503` khi một thành phần hỏng. Chỉ mẫu **200 và đủ ok/up/up** được tính là UP; lỗi mạng, hết thời gian, JSON hỏng hay thiếu trường đều là DOWN, không bao giờ là UP.

## Bộ thu health

Không dùng Uptime Kuma (chủ dự án quyết định ngày 2026-10-31: không thêm phần mềm ngoài stack). `scripts/monitoring/collect-health.mjs` là nguồn bằng chứng duy nhất: mỗi phút một dòng JSONL, chỉ dùng thư viện có sẵn của Node. Chạy trên máy khác với máy chủ được giám sát để ghi được cả sự cố của chính máy chủ.

```powershell
node scripts/monitoring/collect-health.mjs --base-url https://ctdt.example.edu.vn --output D:\evidence\health.jsonl
```

Bộ thu chỉ chấp nhận HTTPS, không theo chuyển hướng, không ghi nội dung phản hồi, và bám lưới phút tuyệt đối nên một lần thăm dò chậm không làm lệch lịch.

## Tính độ sẵn sàng

`summarizeAvailability` trong `health-evidence.mjs`:

- Mục tiêu: `TARGET_AVAILABILITY` (xem hằng số trong tệp).
- Phút thiếu mẫu là **unknown** và vẫn nằm trong mẫu số, không được coi là UP.
- Hai mẫu cùng phút được gộp nếu cùng kết luận; mâu thuẫn thì báo lỗi.
- Khi chưa có lịch giờ làm việc đã xác nhận (`calendar.confirmed`), kết quả chỉ là chẩn đoán 24/7, **không** là bằng chứng giờ hành chính (`businessHoursVerified = false`).
- Mẫu số bằng 0 cho `null`, không bao giờ 100%.

## Nhật ký

Khi `NODE_ENV=production`, backend ghi nhật ký JSON ra stdout, mỗi dòng một bản ghi, mức theo `LOG_LEVEL`. Có hai loại bản ghi:

- Mỗi request một bản ghi `http.completed` (hoặc `http.aborted`), chỉ gồm method, mẫu route, mã trạng thái, thời gian xử lý và mã request do máy chủ sinh. Không ghi query, header, cookie hay nội dung.
- Lỗi chỉ ghi kiểu lỗi và mã an toàn, không ghi thông điệp gốc.

Docker xoay vòng tệp nhật ký (`DOCKER_LOG_MAX_SIZE`, `DOCKER_LOG_MAX_FILE`). Không dùng pino: logger tự viết ở `src/shared/logging/`. Khi chạy dev, nhật ký giữ dạng console của Nest.

## Việc chưa làm

- Lịch giờ làm việc chính thức chưa được xác nhận bởi nhà trường.
