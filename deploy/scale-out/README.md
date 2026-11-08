# Scale-out: 2 máy API sau Load Balancer

Làm ngày 2026-11-06 sau đợt test hiệu năng: 200 user đồng thời thì container API (Node một luồng) ghim 100% một core,
p95 trang khung chương trình lên 2,07 s (NFR-01 yêu cầu < 2 s), throughput dừng ở khoảng 95 req/s.

## Bức tranh (đối chiếu AWS)

```
Người dùng ──HTTPS──► OCI Flexible LB (≈ ALB, giữ chứng chỉ TLS, 10–100 Mbps)
                         │ HTTP :8080, LEAST_CONNECTIONS, health /api/health
              ┌──────────┴──────────┐
              ▼                     ▼
   VM1 10.0.1.3 (≈ EC2 #1)    VM2 10.0.1.174 (≈ EC2 #2)
   caddy :443 + :8080          caddy :8080
   api (CÓ worker BullMQ)      api (QUEUE_WORKERS_ENABLED=false)
   postgres, redis  ◄──────────┘ (qua IP nội bộ)
   /srv/ctdt/files  ──NFS──►  /srv/ctdt/files
```

- DB vẫn ở VM1 (không dùng dịch vụ quản lý kiểu RDS: OCI Database with PostgreSQL tốn khoảng $70–100/tháng).
- Session lưu trong PostgreSQL nên không cần sticky session.
- Chỉ VM1 chạy worker, đúng ràng buộc "một worker" trong `deploy/compose.yaml`.

## Chi phí ước tính (trừ vào credit $300, hết khoảng 01/12/2026)

| Thành phần | Giá |
|---|---|
| VM2 E5.Flex 1 OCPU / 6 GB | ≈ $0.042/giờ ≈ $31/tháng |
| Flexible LB 10–100 Mbps | ≈ $0.011/giờ + băng thông ≈ $10–15/tháng |

## File

| File | Ở đâu trên máy |
|---|---|
| `compose.vm1.override.yaml` | VM1 `/srv/ctdt/scale-out/` (đã thay IP). `deploy-release.sh` tự thêm `-f` nếu file tồn tại |
| `Caddyfile.vm1` | VM1 `/srv/ctdt/scale-out/` = site gốc + site `:8080` |
| `compose.vm2.yaml`, `Caddyfile.vm2` | VM2 `/srv/ctdt/releases/<tag>/deploy/scale-out/` |
| Terraform | `deploy/terraform/oci/scale.tf` (biến `scale_out`, luôn apply bằng `-target`) |

## Cập nhật VM2 khi có release mới

CD hiện chỉ deploy VM1. Sau mỗi lần deploy VM1 có đổi backend, build lại VM2 từ cùng commit:

```bash
# máy dev
git archive <sha> source/backend source/frontend deploy/scale-out | ssh ubuntu@<api2_public_ip> \
  "mkdir -p /srv/ctdt/releases/<sha> && tar -x -C /srv/ctdt/releases/<sha>"
# VM2: sửa RELEASE_TAG trong /srv/ctdt/demo.env rồi
cd /srv/ctdt/releases/<sha>/deploy/scale-out
sudo docker compose -f compose.vm2.yaml --env-file /srv/ctdt/demo.env up -d --build --wait
```

Nếu VM2 chạy mã cũ hơn schema DB, health check `/api/health` vẫn có thể xanh; nên làm bước trên ngay sau deploy.

## Autoscale (thêm ngày 2026-11-06)

`deploy/terraform/oci/autoscale.tf`, bật bằng `-var autoscale=true` (cùng `scale_out=true`, luôn `-target`).

| OCI | AWS |
|---|---|
| Custom image chụp từ VM2 | AMI |
| Instance configuration | Launch template |
| Instance pool gắn backend set của LB | Auto Scaling Group + target group |
| Autoscaling policy threshold | Step scaling theo CPU |

- Mặc định 2 máy API: VM1 + 1 máy trong pool. CPU trung bình pool > 70% thì thêm 1 máy (tối đa 3 máy pool),
  < 30% thì bớt; cooldown 300 s. OCI đo CPU khoảng 5 phút một lần nên không đỡ được spike vài giây.
- VM2 giờ là **máy mẫu**: đã gỡ khỏi LB và ở trạng thái STOPPED (không tính tiền OCPU).
- Mỗi máy pool thêm ≈ $0.042/giờ. Tối đa 4 máy API ≈ $125/tháng nếu ghim max cả tháng (thực tế chỉ lên khi có tải).

Cập nhật pool khi có release mới: bật VM2 (`state = RUNNING` hoặc console), làm bước "Cập nhật VM2" ở trên,
rồi `terraform apply -replace=oci_core_image.api[0] -target=oci_core_instance_pool.api ...`; sau đó
cho pool thay máy (console: Instance pool → Detach/Terminate từng máy cũ, pool tự tạo máy mới từ image mới).

## Quay lại 1 máy (rollback)

1. DNS: trỏ bản ghi A `ctdt` về IP public của VM1 (Route 53). Site chạy ngay, VM1 vẫn giữ :443.
2. `terraform destroy -target=oci_autoscaling_auto_scaling_configuration.api -target=oci_core_instance_pool.api -target=oci_load_balancer_load_balancer.web -target=oci_core_instance.api2` (hoặc `scale_out=false` + `-target`).
3. VM1: `rm -r /srv/ctdt/scale-out` rồi `up -d --no-deps postgres redis caddy` với compose gốc.

## Lưu ý

- Chứng chỉ trên LB là bản Let's Encrypt chép từ Caddy VM1, hạn 30/01/2027. Caddy vẫn tự gia hạn trên VM1,
  nhưng LB không tự cập nhật: trước hạn phải chép lại và `terraform apply -target=oci_load_balancer_certificate.web ...`.
- Không mở 5432/6379/8080/2049 ra Internet: security list và iptables chỉ cho 10.0.1.0/24.

## Sau mỗi lần deploy: đồng bộ pool (thêm ngày 2026-11-07)

Sự cố 2026-11-07: CD deploy `c562367` lên VM1, máy pool vẫn chạy bản cũ. Load Balancer gửi `index.html` từ VM1
nhưng file JS từ máy pool (404), nên trang trắng. Cùng lúc vòng săn A1 (máy khác, state cũ) chạy Terraform và xoá
luật VCN-internal, máy pool mất kết nối PostgreSQL/Redis, Load Balancer trả 502.

Đã sửa:

1. `deploy/terraform/oci/routing.tf`: trang web (mọi path không phải `/api/`) chỉ lấy từ VM1 (backend set
   `web-vm1`); `/api/*` chia cho VM1 + pool (`caddy-8080`). Lệch phiên bản giữa các máy không làm trắng trang nữa.
   AWS: ALB listener rule `path /api/* -> api TG`, default -> web TG.
2. `deploy/scale-out/update-pool.sh`: chạy trên máy dev ngay sau mỗi lần CD deploy VM1, hoặc khi autoscale vừa
   thêm máy (image có thể cũ). Cập nhật cuốn chiếu từng máy: drain → build đúng commit VM1 đang chạy → health →
   gắn lại. Trong lúc chưa merge nhánh scale-out, truyền thêm phần worker-switch:
   `OVERLAY="source/backend/src/shared/queue/queue.module.ts source/backend/src/shared/queue/worker-switch.service.ts source/backend/src/shared/config/env.validation.ts" deploy/scale-out/update-pool.sh`
3. Luật VCN-internal trong `main.tf` không còn phụ thuộc biến: phải merge vào main, nếu không mọi
   `terraform apply` từ main (kể cả vòng săn A1) lại xoá nó.

Không chạy Terraform song song từ hai máy: vòng săn A1 dùng state chép ngày 2026-11-01, đã lỗi thời.

## CD tự đồng bộ pool (thêm ngày 2026-11-08)

Sự cố 2026-11-08: CD deploy commit mới của frontend + backend lên VM1, pool vẫn chạy API cũ. `/api/*` chia cho
cả hai máy, nên trang mới thỉnh thoảng nhận phản hồi từ API cũ thiếu trường mới (`releasedVersions`) và vỡ
("Cannot read properties of undefined (reading 'length')"); F5 hết vì lần sau rơi vào VM1.

Từ nay job `deploy` trong `.github/workflows/ci-cd.yml` gọi `deploy/scale-out/ci-pool.sh`:

1. `build`: trước khi VM1 đổi bản, chép release và build image trên từng máy pool (container cũ vẫn phục vụ).
   Build lỗi thì CD dừng trước khi VM1 đổi, hai bên không bao giờ lệch.
2. Deploy VM1 như cũ.
3. `switch`: dựng lại container pool từ image đã build (khoảng 20 giây).

Máy pool được tìm bằng cách quét subnet 10.0.1.0/24 từ VM1 (`:8080/api/health`), nên máy autoscale thêm vào cũng
được cập nhật. `update-pool.sh` vẫn dùng khi cần cập nhật tay (ví dụ máy vừa autoscale từ image cũ).
## Máy autoscale tự đồng bộ khi khởi động (thêm ngày 2026-11-08)

Máy pool khởi động từ image chụp sẵn, nên sớm muộn cũng cũ hơn VM1. Giờ mỗi lần khởi động:

1. `ctdt-pool-gate.service` (chạy trước docker) chặn :8080 với subnet bằng iptables (bảng raw), Load Balancer
   thấy health hỏng nên không gửi request.
2. `ctdt-pool-sync.service` gắn NFS chỉ-đọc `10.0.1.3:/srv/ctdt/release-export`, đọc `current.sha`, giải nén
   `release-<sha>.tgz`, build với `compose.vm2.yaml`, chờ health rồi mở chặn. Lỗi thì thử lại 10 phút; vẫn lỗi
   thì giữ chặn, máy cũ không bao giờ nhận traffic.

`deploy-release.sh` ghi gói release vào `/srv/ctdt/release-export` sau mỗi lần deploy VM1 thành công.
Script và unit nằm trong `pool-sync.sh` + `pool-cloud-init.yaml` (user_data của instance configuration); image
`ctdt-demo-api-image` cũng đã cài sẵn chúng để bộ chặn chạy trước docker ngay lần khởi động đầu.

Cài trên VM1 (một lần, đã làm 2026-11-08): `mkdir /srv/ctdt/release-export` (chủ ubuntu) và thêm
`/srv/ctdt/release-export 10.0.1.0/24(ro,sync,no_subtree_check,root_squash)` vào `/etc/exports.d/ctdt.exports`.

Chụp lại image (khi cần): bật api2, `sudo systemctl start ctdt-pool-sync`, tắt api2, rồi
`terraform apply -replace='oci_core_image.api[0]' -target=oci_core_instance_pool.api ...`.

CI: job `terraform` lưu cache provider theo lock file và thử init 3 lần; job `deploy` không còn phụ thuộc
job `terraform` (2026-11-08 GitHub Releases trả 504 làm chặn deploy dù deploy không chạy terraform).
