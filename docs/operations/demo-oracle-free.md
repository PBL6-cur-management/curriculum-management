# Dựng demo trên Oracle Cloud Always Free — lần đầu

Tổng quan: [deploy/DEPLOY_INFRA.md](../../deploy/DEPLOY_INFRA.md). Lệnh vận hành sau này: [deploy/COMMANDS.md](../../deploy/COMMANDS.md). Chi phí: [deploy/COST.md](../../deploy/COST.md).

Kết quả: `https://ctdt.oguri-lab.io.vn` chạy bản sao `ctdt_real`, tự deploy khi merge `main`.

## 1. Tài khoản Oracle (đã xong 2026-11-01)

Đăng ký tại https://signup.oracle.com: tắt VPN, họ tên và địa chỉ khớp thẻ Visa/Mastercard, số điện thoại +84 nhận SMS. Home region của tài khoản này là **ap-singapore-1** (không đổi được). Bật MFA. **Không** nâng Pay As You Go.

Kiểm tra: Console → menu region trên thanh trên cùng → region có nhãn *Home region*.

## 2. Khóa

```powershell
# API key cho Terraform: Console → Profile → My profile → API keys → Add API key → Generate API key pair
#   tải private key về C:\Users\<bạn>\.oci\oci_api_key.pem
#   chép "Configuration file preview" vào C:\Users\<bạn>\.oci\config, sửa key_file cho đúng đường dẫn
ssh-keygen -t ed25519 -f $HOME\.ssh\oci_ctdt        # khóa của bạn (nên đặt passphrase)
ssh-keygen -t ed25519 -f $HOME\.ssh\ctdt_ci -N '""' # khóa riêng cho GitHub Actions, không passphrase
```

## 3. Terraform

```bash
cd deploy/terraform/oci
cp terraform.tfvars.example terraform.tfvars   # điền tenancy_ocid (dòng tenancy= trong ~/.oci/config), budget_alert_email
terraform init
terraform plan        # đọc kỹ: chỉ VCN, internet gateway, route table, security list, subnet, 1 VM A1, budget
terraform apply
terraform output
```

`Out of host capacity` (Singapore hay hết máy ARM): `../../scripts/apply-until-capacity.sh` (1 lần gọi mỗi 120–150 s, chạy tới khi có máy), hoặc `ocpus = 1`, `memory_gb = 6`.

Chờ cloud-init: `ssh -i ~/.ssh/oci_ctdt ubuntu@<IP> cloud-init status --wait` → `status: done`.

## 4. DNS ở tenten.vn

Trang quản trị tenten → tên miền `oguri-lab.io.vn` → Quản lý DNS → thêm bản ghi theo `terraform output dns_record`:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| A | `ctdt` | IP từ `terraform output public_ip` | 300 |

Chờ đến khi `nslookup ctdt.oguri-lab.io.vn 8.8.8.8` trả đúng IP rồi mới sang bước 6 (Caddy xin chứng chỉ ngay khi chạy).

## 5. Biến môi trường trên VM

```bash
ssh -i ~/.ssh/oci_ctdt ubuntu@<IP>
PG=$(openssl rand -hex 24); SS=$(openssl rand -base64 48 | tr -d '\n')
install -m 600 /dev/null /srv/ctdt/demo.env
# dán nội dung deploy/demo.env.example vào /srv/ctdt/demo.env, thay <hex> bằng $PG và SESSION_SECRET bằng $SS
nano /srv/ctdt/demo.env
```

Bí mật sinh và nằm trên VM, không đi qua chat hay repo.

## 6. Mã và dữ liệu lần đầu

Mã: CD sẽ ship mỗi lần merge; lần đầu ship tay từ máy bạn (cùng lệnh CD dùng):

```bash
SHA=$(git rev-parse origin/main)
git -c core.autocrlf=false archive --format=tar.gz "$SHA" | ssh -i ~/.ssh/oci_ctdt ubuntu@<IP> \
  "d=/srv/ctdt/releases/$SHA; mkdir -p \$d && tar -xz -C \$d && chmod +x \$d/deploy/scripts/*.sh"
```

Dữ liệu (PowerShell, máy dev đang chạy `pnpm services:up`):

```powershell
pwsh deploy/scripts/export-demo-data.ps1 -VmHost <IP>
```

Trên VM:

```bash
/srv/ctdt/releases/<SHA>/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump /srv/ctdt/incoming/files.tgz
```

Script nạp CSDL, chép tệp, rồi gọi `deploy-release.sh` (build ~5–10 phút lần đầu, migrate, bật api + caddy, kiểm health qua HTTPS).

## 7. An toàn trước khi gửi link

- Đăng nhập `admin`, đổi mật khẩu.
- Khóa mọi tài khoản `e2e.*` (COMMANDS.md §5).
- Mỗi vai trò thầy cô cần xem (R1 Phòng Đào tạo, R3, R4, R5, sinh viên — xem `docs/ACCOUNTS.md`) chọn một tài khoản, đặt mật khẩu demo riêng, gửi riêng từng người.

## 8. Bật CD

```bash
unset GITHUB_TOKEN                   # biến này trên máy đang chứa token hỏng; gh dùng keyring thay thế
deploy/scripts/set-ci-secrets.sh     # tạo environment "demo" + 3 secret
```

Cần **quyền admin** trên repo `4UT15T1Ck/curriculum-management` (tài khoản `flyingdoggoo` hiện chỉ có quyền push, kiểm 2026-11-01). Nhờ admin của org chạy script, hoặc cấp quyền admin cho bạn.

Org `4UT15T1Ck` phải cho phép GitHub Actions (Settings → Actions). Từ đây mỗi lần merge vào `main` có đụng mã/compose là tự deploy.

## 9. Kiểm tra

### Tài khoản sinh viên tổng hợp cho F-28

Ứng dụng mô phỏng dDUT nằm ở repo riêng `dut_curriculum_app`, chỉ dùng trình diễn API hiện có bằng phiên cookie; không thay thế dDUT của Trường. Web student portal dùng được cùng tài khoản.

Sau khi dữ liệu thật đã được dựng/khôi phục, người vận hành chủ động chạy trong thư mục backend (hoặc trong container backend có môi trường tương ứng):

```powershell
pnpm db:demo-student
```

- Mặc định đăng nhập `demo.sinhvien` / `demo`, mã sinh viên `DEMOSV001`, tên `Sinh viên Demo`; mật khẩu ngắn công khai, chỉ dùng trên CSDL demo, không dùng ở hệ thống có người dùng thật phụ thuộc.
- Biến môi trường tùy chọn: `DEMO_STUDENT_USERNAME`, `DEMO_STUDENT_PASSWORD`, `DEMO_STUDENT_PROGRAM_CODE`, `DEMO_STUDENT_COHORT_CODE`. Hai biến mã lọc chính xác chương trình/khóa; khi có lọc tường minh chỉ cần ít nhất một học kỳ thường đã bắt đầu.
- Không chỉ định mã: chọn đăng ký ACTIVE PRIMARY không ngoại lệ, có ít nhất 4 học kỳ thường đã bắt đầu; ưu tiên mã chứa `CNTT`, rồi khóa đông sinh viên nhất trong chương trình, hòa thì theo mã chương trình/khóa. Script in chương trình, khóa, phiên bản và số kết quả; nếu không có mẫu sẽ báo các mã chương trình hiện có.
- Chỉ sao chép các ID và `major` theo đăng ký mẫu, không đọc tên/mã/email hay điểm sinh viên thật. Kết quả tổng hợp: một môn bắt buộc ở kỳ đầu bị trượt, các môn bắt buộc kỳ trước đã đạt, kỳ thường mới nhất đã bắt đầu đang học; tự chọn và kỳ tương lai không có kết quả. Học kỳ hè không được tính.
- Chạy lại thay toàn bộ đăng ký và kết quả của sinh viên demo trong một transaction. Nếu bản xét tốt nghiệp đã lưu hoặc lịch sử thay đổi kết quả đang tham chiếu, script báo lỗi và rollback; nhờ cán bộ kiểm tra, không tự xóa dữ liệu tham chiếu.
- Chạy lại sau mỗi `db:rebuild:real` hoặc khôi phục bản sao chưa có tài khoản; mã mặc định không khớp mẫu dọn của `db:demo-curate`. Nếu đổi username sau lần tạo đầu, mã tài khoản cố định có thể xung đột: giữ username đã dùng hoặc nhờ cán bộ kiểm tra, không ghi đè tài khoản khác.
- Sau khi chạy, tự kiểm tra đăng nhập, `GET /api/portal/me` có chương trình, các API registration-eligibility và graduation trả dữ liệu (có thể có chẩn đoán `CANNOT_AUDIT` khi chương trình thiếu đầu vào). Chạy script hai lần để kiểm tra số lượng ổn định. Các bước này chưa được chạy trong đợt triển khai chỉ kiểm tra tĩnh.

### Kiểm tra demo công khai

- `curl https://ctdt.oguri-lab.io.vn/api/health` → `{"status":"ok"...}`, chứng chỉ Let's Encrypt hợp lệ.
- `curl -I https://ctdt.oguri-lab.io.vn/api/docs` → 404.
- Đăng nhập từng tài khoản demo, mở CTĐT, xuất PDF, tải một tệp đính kèm.
- `sudo reboot` → vài phút sau link sống lại.
