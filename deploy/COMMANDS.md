# Lệnh vận hành demo

Tổng quan hạ tầng: [DEPLOY_INFRA.md](DEPLOY_INFRA.md). Lệnh **local** chạy trong Git Bash ở gốc repo; lệnh **VM** chạy sau khi SSH vào.

## 0. Lệnh cấm trên VM

| Đừng chạy | Hậu quả |
|---|---|
| `dc down -v`, `docker volume prune`, `docker system prune --volumes` | Xóa volume Postgres/Redis → mất toàn bộ dữ liệu demo |
| `pnpm prisma migrate reset`, `prisma db push` | Xóa/lệch schema |
| `sudo rm -rf /srv/ctdt/files` | Mất tệp đính kèm |
| `terraform destroy` khi còn demo | Xóa VM và dữ liệu |

`docker image prune -f` (không `-a`, không `--volumes`) thì an toàn.

## 1. Terraform (local, `deploy/terraform/oci/`)

```bash
cd deploy/terraform/oci
terraform init                      # lần đầu, hoặc sau khi đổi provider
terraform plan                      # xem trước; chỉ được thấy VM A1, VCN, subnet, security list, budget
terraform apply                     # tạo/cập nhật
terraform output                    # IP, public_host, dns_record, lệnh ssh
terraform output -raw public_ip
terraform destroy                   # HẾT DEMO: xóa sạch (nhớ xóa bản ghi A ở tenten)
../../scripts/apply-until-capacity.sh 15 12  # "Out of host capacity": mỗi vòng thử 3 fault domain × (2/12 rồi 1/6), nghỉ 15 s, tối đa 12 giờ
```

- Hết máy mãi: trong `terraform.tfvars` đặt `ocpus = 1`, `memory_gb = 6` rồi `apply`.
- Mất `terraform.tfstate`: `terraform import oci_core_instance.demo <instance-ocid>` (tương tự cho VCN, subnet...) hoặc xóa tay trên Console rồi `apply` lại.
- `cloud-init.yaml` sửa sau khi VM đã có **không** áp dụng lại (cố ý); làm tay trên VM.

## 2. Kết nối

```bash
ssh -i ~/.ssh/oci_ctdt ubuntu@<IP>
```

Trên VM, thêm alias một lần vào `~/.bashrc`:

```bash
cat >> ~/.bashrc <<'EOF'
dc() { RELEASE_TAG="$(basename "$(readlink -f /srv/ctdt/current)")" docker compose -p ctdt-production -f /srv/ctdt/current/deploy/compose.yaml --env-file /srv/ctdt/demo.env "$@"; }
EOF
source ~/.bashrc
```

## 3. Trạng thái và log (VM)

```bash
dc ps                                   # 4 container chạy (migrate đã thoát), api "healthy"
dc logs -f --tail 200 api               # log ứng dụng (JSON)
dc logs --tail 100 caddy                # HTTPS, proxy
dc logs --tail 100 postgres
curl -s https://ctdt.oguri-lab.io.vn/api/health    # {"status":"ok",...}
docker stats --no-stream                # CPU/RAM từng container
free -h; df -h /; du -sh /srv/ctdt/*    # RAM, đĩa
readlink -f /srv/ctdt/current           # release đang chạy (SHA)
ls -1t /srv/ctdt/releases               # 3 release gần nhất
cloud-init status --long                # boot đầu đã xong chưa
```

## 4. Deploy và rollback

```bash
# local
gh run list --workflow ci-cd.yml --limit 5
gh run watch                            # theo dõi run đang chạy
gh workflow run ci-cd.yml --ref main    # deploy lại main bằng tay

# VM: deploy lại / quay về một release còn trong /srv/ctdt/releases
/srv/ctdt/releases/<sha>/deploy/scripts/deploy-release.sh
dc restart api                          # khởi động lại api, không build
dc run --rm migrate                     # chạy migration tay
```

Rollback chỉ đổi mã; migration đã chạy thì **không** đảo ngược. Muốn quay cả dữ liệu: nạp lại dump (mục 5).

## 5. CSDL (VM)

```bash
dc exec postgres psql -U ctdt -d ctdt_real
```

```sql
-- Locale phải là: i | vi-VN
SELECT datlocprovider, datlocale FROM pg_database WHERE datname = current_database();
SELECT status, count(*) FROM "User" GROUP BY status;
SELECT username, "fullName", status, "mustChangePassword" FROM "User" ORDER BY username LIMIT 50;
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
-- Khẩn: khóa tài khoản e2e còn sót, đăng xuất mọi người
UPDATE "User" SET status = 'DISABLED' WHERE username LIKE 'e2e.%';
DELETE FROM session;
```

```bash
# Dump nhanh trước thao tác rủi ro
dc exec -T postgres pg_dump -U ctdt -d ctdt_real -Fc > /srv/ctdt/incoming/before-$(date +%F-%H%M).dump

# Nạp lại dữ liệu từ máy dev (local, PowerShell)
pwsh deploy/scripts/export-demo-data.ps1 -VmHost <IP>
# rồi trên VM
/srv/ctdt/current/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump /srv/ctdt/incoming/files.tgz
```

## 6. Redis / BullMQ (VM)

```bash
dc exec redis redis-cli INFO memory | grep used_memory_human
dc exec redis redis-cli --scan --pattern 'bull:*' | cut -d: -f2 | sort | uniq -c   # khóa theo hàng đợi
dc exec redis redis-cli CONFIG GET maxmemory-policy                                # phải là noeviction
```

## 7. Mạng và HTTPS

```bash
# local
nslookup ctdt.oguri-lab.io.vn 8.8.8.8          # phải ra IP của VM
curl -sv https://ctdt.oguri-lab.io.vn/api/health 2>&1 | grep -E 'subject|issuer|HTTP/'
curl -sI https://ctdt.oguri-lab.io.vn/api/docs  # 404 là đúng

# VM
sudo iptables -L INPUT -n --line-numbers        # 80, 443 ACCEPT phải nằm trước REJECT
sudo /usr/local/sbin/ctdt-open-web-ports        # mở lại nếu mất
dc logs caddy | grep -iE 'acme|certificate|error'   # lỗi xin chứng chỉ
```

Chứng chỉ lỗi: kiểm DNS trỏ đúng IP, cổng 80 mở từ ngoài (Let's Encrypt cần), không có bản ghi CAA chặn `letsencrypt.org`. Let's Encrypt giới hạn số lần cấp — sửa xong nguyên nhân rồi mới `dc restart caddy`.

## 8. Tài khoản demo

- Đổi mật khẩu, đặt lại mật khẩu, khóa tài khoản: qua màn **Quản trị** bằng tài khoản `admin`.
- Gửi mật khẩu demo riêng cho từng thầy cô; không ghi vào repo hay tài liệu.

## 9. Bí mật CI

```bash
deploy/scripts/set-ci-secrets.sh        # local: IP + khóa CI + host key → GitHub environment "demo"
gh secret list --env demo
```

Chạy lại sau khi IP VM đổi (VM tạo lại mà không dùng `use_reserved_ip`). Cần quyền admin trên repo. `gh` báo *Bad credentials* → `unset GITHUB_TOKEN` (token hỏng trong biến môi trường che mất token keyring).
