# deploy/

Docker Compose + Caddy cho môi trường thật (project `ctdt-production`). Quy trình đầy đủ: `docs/operations/deployment.md`.

## Biến môi trường của `compose.yaml`

Đặt trong tệp `--env-file` nằm ngoài repository. Không commit giá trị bí mật.

| Biến | Ý nghĩa |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Tài khoản và tên cơ sở dữ liệu |
| `DATABASE_URL` | Chuỗi kết nối dùng bởi `migrate` và `api` |
| `SESSION_SECRET` | Khóa phiên, riêng cho môi trường, không dùng lại giá trị dev |
| `PUBLIC_HOST` | Tên miền Caddy phục vụ (HTTPS tự động) |
| `FILES_PATH` | Thư mục lưu tệp trên máy chủ |
| `LOG_LEVEL` | Một trong các mức hợp lệ trong `env.validation.ts` (mặc định `info`) |
| `NODE_IMAGE`, `POSTGRES_IMAGE`, `REDIS_IMAGE`, `CADDY_IMAGE`, `KUMA_IMAGE` | Image cố định phiên bản |
| `RELEASE_TAG` | Nhãn bản phát hành |
| `HEALTH_INTERVAL`, `HEALTH_TIMEOUT`, `HEALTH_RETRIES`, `HEALTH_START_PERIOD` | Tham số healthcheck |
| `DOCKER_LOG_MAX_SIZE`, `DOCKER_LOG_MAX_FILE` | Xoay vòng nhật ký container |

Biến của ứng dụng (sao lưu `BACKUP_*`, `SEED_ADMIN_PASSWORD`, ...) xem `source/backend/.env.example`.

## Lệnh thường dùng

```powershell
docker compose -f deploy/compose.yaml --env-file <env> config --quiet
docker compose -f deploy/compose.yaml --env-file <env> up -d --build
docker compose -f deploy/compose.yaml --env-file <env> --profile monitoring up -d uptime-kuma
```

Không chạy `down -v`, xóa volume hay reset trên môi trường thật. Caddy trả 404 cho `/api/docs*`.
