# Giám sát và bằng chứng sẵn sàng (F-27)

## Nguồn tín hiệu

`GET /api/health` trả `200` với `{ status: "ok", database: "up", redis: "up" }` khi hệ thống khỏe, `503` khi một thành phần hỏng. Chỉ mẫu **200 và đủ ok/up/up** được tính là UP; lỗi mạng, hết thời gian, JSON hỏng hay thiếu trường đều là DOWN, không bao giờ là UP.

## Hai lớp theo dõi

1. **Uptime Kuma** (profile `monitoring` trong `deploy/compose.yaml`): cảnh báo theo thời gian thực. Cần chạy trên máy khác với máy đang được giám sát để quan sát được sự cố của chính máy chủ. Bật bằng `docker compose --profile monitoring up -d uptime-kuma`. Đây là phần mềm bên thứ ba, cần được duyệt trước khi triển khai thật.
2. **`scripts/monitoring/collect-health.mjs`**: bằng chứng bổ sung, mỗi phút một dòng JSONL, chỉ dùng thư viện có sẵn của Node.

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

## Việc chưa làm

- Cầu nối pino cho nhật ký có cấu trúc (BE-02) cần thêm thư viện chưa được duyệt, nên chưa thực hiện. `LOG_LEVEL` đã được kiểm tra trong `env.validation.ts`.
- Lịch giờ làm việc chính thức chưa được xác nhận bởi nhà trường.
