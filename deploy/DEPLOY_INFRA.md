# Hạ tầng demo — tổng quan

Một link HTTPS (`https://ctdt.oguri-lab.io.vn`) để thầy cô xem demo hệ thống CTĐT. Chi phí 0 đ ngoài tên miền (xem [COST.md](COST.md)). Lệnh thao tác: [COMMANDS.md](COMMANDS.md). Hướng dẫn từng bước lần đầu: [docs/operations/demo-oracle-free.md](../docs/operations/demo-oracle-free.md).

## 1. Bức tranh

```
                  Thầy cô (trình duyệt)
                          │ https://ctdt.oguri-lab.io.vn
                          ▼
   DNS tenten.vn: A ctdt → IP public của VM (thêm tay 1 lần)
                          │
┌─────────────── Oracle Cloud, region ap-singapore-1 (Always Free) ───────────────┐
│ VCN 10.0.0.0/16 → subnet public → Security List: 22 (chỉ khóa SSH), 80, 443      │
│                                                                                   │
│  VM Ubuntu 24.04 ARM  (VM.Standard.A1.Flex, 2 OCPU / 12 GB, đĩa 100 GB)           │
│  iptables mở 80/443 · Docker Compose project "ctdt-production"                   │
│                                                                                   │
│   caddy :80/:443 ──┬── /            → SPA React (file tĩnh trong image)           │
│   (Let's Encrypt)  └── /api/*       → api:3000  (NestJS + worker BullMQ)          │
│                                          │           │            │               │
│                                    postgres:5432  redis:6379  /srv/ctdt/files     │
│                                    (volume, ICU    (volume,    (tệp đính kèm,     │
│                                     vi-VN)          AOF)        bind mount)       │
│   migrate (chạy prisma migrate deploy rồi thoát, trước mỗi lần thay api)          │
└───────────────────────────────────────────────────────────────────────────────────┘
                          ▲ SSH (khóa CI)
   GitHub Actions: PR → CI nhỏ · push main → ship mã → deploy-release.sh trên VM
```

**Một máy chạy tất cả 5 container.** Không Load Balancer, không DB managed, không container registry: image build ngay trên VM. Mức tải demo dùng khoảng 1–2 GB trên 12 GB RAM.

## 2. Ai quản lý cái gì

| Lớp | Công cụ | Ở đâu trong repo | Chạy khi nào |
|---|---|---|---|
| Mạng, VM, budget | Terraform (`oracle/oci`) | `deploy/terraform/oci/` | Tay, trên máy bạn: `terraform apply` |
| Cấu hình VM lần đầu (Docker, iptables, `/srv/ctdt`, tắt SSH mật khẩu) | cloud-init | `deploy/terraform/oci/cloud-init.yaml` | Tự động, đúng 1 lần khi VM boot lần đầu |
| DNS | Bảng quản trị tenten.vn | — | Tay, 1 lần (theo `terraform output dns_record`) |
| Container | Docker Compose | `deploy/compose.yaml`, `deploy/Caddyfile`, `source/*/Dockerfile` | Mỗi lần deploy |
| Biến môi trường, bí mật ứng dụng | `/srv/ctdt/demo.env` (chỉ trên VM) | mẫu: `deploy/demo.env.example` | Tạo tay 1 lần |
| Dữ liệu | `pg_dump` / `pg_restore` | `deploy/scripts/export-demo-data.ps1`, `restore-demo-data.sh` | Tay, khi muốn nạp lại dữ liệu |
| CI/CD | GitHub Actions | `.github/workflows/ci-cd.yml`, `deploy/scripts/deploy-release.sh` | PR và push `main` |

## 3. Vòng đời

1. **Đăng ký Oracle** (xong 2026-11-01), tạo API key, SSH key.
2. **`terraform apply`** → VCN + VM + budget. Hết máy ARM ở Singapore → `deploy/scripts/apply-until-capacity.sh` thử lại mỗi 5 phút.
3. **DNS**: thêm bản ghi A ở tenten → chờ `nslookup ctdt.oguri-lab.io.vn` đúng IP.
4. **Bí mật**: tạo `/srv/ctdt/demo.env` trên VM; `deploy/scripts/set-ci-secrets.sh` đẩy 3 secret SSH lên GitHub environment `demo`.
5. **Dữ liệu**: `export-demo-data.ps1 -VmHost <ip>` → trên VM `restore-demo-data.sh` → stack lên, Caddy xin chứng chỉ.
6. **Hằng ngày**: merge vào `main` → CI → deploy tự động. Health đỏ → tự quay về release trước.
7. **Kết thúc demo**: `terraform destroy` (xóa sạch VM, dữ liệu, mạng) và xóa bản ghi A.

## 4. CI/CD

| Job | Khi nào | Làm gì |
|---|---|---|
| `backend` | PR/push đụng `source/backend` | type check, lint, **3 file test** (cấu hình, đăng nhập, PDF) |
| `frontend` | PR/push đụng `source/frontend` | `pnpm build`, lint, **1 file test** (trang đăng nhập) |
| `terraform` | PR/push đụng `deploy/terraform` | `fmt -check`, `validate` — không apply |
| `deploy` | push `main` đụng mã/compose, hoặc bấm tay | `git archive` → VM → `deploy-release.sh`: build → migrate → thay api + caddy → kiểm `/api/health` qua Caddy → giữ 3 release |

Bộ test đầy đủ (≈1800 unit backend, 680 e2e, 700 frontend) vẫn chạy ở máy dev; CI cố ý chỉ chạy ít để nhanh và không tốn phút.

## 5. Bí mật nằm ở đâu

| Bí mật | Vị trí | Không bao giờ ở |
|---|---|---|
| API key Oracle | `~/.oci/` trên máy bạn | repo, GitHub |
| State Terraform (có IP, OCID) | `deploy/terraform/oci/terraform.tfstate` trên máy bạn (gitignore) | repo |
| `SESSION_SECRET`, mật khẩu Postgres | `/srv/ctdt/demo.env` trên VM (chmod 600) | repo, chat |
| Khóa SSH của CI, IP VM, host key | GitHub environment `demo` | repo |
| Dữ liệu cá nhân (CSDL, tệp) | máy bạn → scp → VM | repo, GitHub |

## 6. Giới hạn đã biết

- **Một máy, không dự phòng**: VM chết thì demo chết đến khi dựng lại. Không có sao lưu tự động (`BACKUP_ENABLED=false`); dữ liệu gốc vẫn ở máy bạn, nạp lại bằng `restore-demo-data.sh`.
- **Tài khoản Always Free có thể bị Oracle thu hồi VM nhàn rỗi** (CPU < 20% suốt 7 ngày).
- **IP tạm thời** (mặc định, chắc chắn miễn phí): tạo lại VM thì IP đổi → sửa bản ghi A. Bật `use_reserved_ip = true` để giữ IP cố định (kiểm giá trước, xem COST.md).
- **Rollback chỉ quay lại mã**: migration đã chạy thì không đảo ngược.
- Email, nhắc hạn, đồng bộ CSDL Trường, sao lưu: **tắt** trên demo.
- `/api/docs` bị Caddy chặn (404) — đúng thiết kế F-27.
