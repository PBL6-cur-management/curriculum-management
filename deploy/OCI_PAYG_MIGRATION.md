# Hướng dẫn Chuyển Oracle Cloud sang PAYG (1 VM Always Free A1 — $0/tháng)

> **Trạng thái sau dọn dẹp ngày `2026-11-28`** (`ap-singapore-1`, tenancy `nguyenthanhhieu17022005`):
> - **Đã backup đầy đủ về máy (`D:\oci-demo-backup\`)**: `ctdt_real_*.dump` (4.2 MB), `files_*.tgz` (508 KB), `demo_*.env`, và `terraform.tfstate.before-cleanup` (nằm hoàn toàn ngoài repo git).
> - **Đã xóa sạch 100% hạ tầng scale-out / trả phí thừa trên OCI**:
>   - `ctdt-demo-api-autoscale` (Autoscaling) — **ĐÃ XÓA**
>   - `ctdt-demo-api-pool` & `inst-w0ham-ctdt-demo-api-pool` (Instance Pool + VM E5.Flex) — **ĐÃ XÓA**
>   - `ctdt-demo-lb` (Flexible Load Balancer `161.118.243.20`) — **ĐÃ XÓA**
>   - `ctdt-demo-api2` (Golden VM E5.Flex + boot volume 50 GB) — **ĐÃ XÓA**
>   - `ctdt-demo-api-config-*` (Instance Configuration) & `ctdt-demo-api-image-*` (Custom Image 50 GB) — **ĐÃ XÓA**
>   - `ctdt-demo-vm1` Dynamic Group & `ctdt-demo-vm1-rebake` Policy — **ĐÃ XÓA**
> - **Đã cập nhật Terraform & GitHub Actions CI/CD** về mô hình **1 VM duy nhất** (xóa `scale.tf`, `autoscale.tf`, `rebake.tf`, `routing.tf`, `deploy/scale-out/`, gỡ `ci-pool.sh` khỏi `.github/workflows/ci-cd.yml`, `deploy-release.sh`, `deploy-direct.sh`).
> - **Hiện chỉ còn 1 VM duy nhất** (`ctdt-demo-trial-x86`, IP `129.221.248.234`, boot volume 50 GB) cùng VCN miễn phí + Budget Alert `$1/tháng`.

---

## Việc bạn cần làm khi nâng PAYG (chỉ 3 bước — ~5 phút)

### Bước 1 — Nâng tài khoản lên Pay As You Go (PAYG)
1. Vào OCI Console → **Billing & Cost Management** → **Upgrade and Manage Payment** → **Upgrade to Paid Account**.
2. Dùng thẻ Visa/Mastercard chuẩn (Oracle giữ tạm ~$100 USD để xác thực rồi hoàn sau 3–5 ngày làm việc).
3. **Lưu ý chi phí:** Vì hiện chỉ còn 1 VM `ctdt-demo-trial-x86` (`E5.Flex`, ~$0.055/giờ ≈ $1.32/ngày), hãy chạy **Bước 2 ngay sau khi PAYG kích hoạt** để thay thế nó bằng **1 VM Always Free A1 ($0/tháng)**! *(Nếu muốn chắc chắn $0.00 trước cả khi nâng PAYG, bạn có thể chạy `bash deploy/scripts/oci-teardown-paid.sh ../cm-demo/deploy/terraform/oci` hoặc Stop VM này trên Console trước rồi nâng PAYG).*

### Bước 2 — Chạy 1 lệnh chuyển sang 1 VM Always Free A1 (`2 OCPU / 12 GB` — $0/tháng)
Sau khi tài khoản báo trạng thái **Pay As You Go**, mở Git Bash ở thư mục gốc repo và chạy:

```bash
bash deploy/scripts/oci-switch-to-a1.sh
```

Script sẽ tự động:
1. Tạo **1 VM Always Free `VM.Standard.A1.Flex`** (`2 OCPU / 12 GB RAM`, `100 GB` boot volume) và **xóa `ctdt-demo-trial-x86` (`E5.Flex`)**.
2. Đợi `cloud-init` cài xong Docker + firewall + `/srv/ctdt`.
3. Upload sẵn `demo.env`, `ctdt_real.dump` và `files.tgz` từ `D:\oci-demo-backup\` cùng bản release code mới nhất lên VM mới.

### Bước 3 — Trỏ DNS & Restore dữ liệu + Cập nhật GitHub CI/CD Secret
1. Tại panel DNS **tenten.vn**, cập nhật bản ghi `A` của `ctdt.oguri-lab.io.vn` sang `NEW_IP` mà script in ra.
2. Chạy 2 lệnh cuối script in ra để restore CSDL + khởi động Caddy HTTPS và cập nhật secret GitHub Actions `demo`:
   ```bash
   ssh -i ~/.ssh/oci_ctdt ubuntu@$NEW_IP "/srv/ctdt/releases/$(git rev-parse HEAD)/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump /srv/ctdt/incoming/files.tgz"
   DEMO_HOST=$NEW_IP bash deploy/scripts/set-ci-secrets.sh
   ```
3. Kiểm tra **OCI Console → Cost Analysis** sau 24–48h: xác nhận **$0.00** (đã có Budget Alert `$1/tháng` gửi mail `nguyenthanhhieu17022005@gmail.com`).
