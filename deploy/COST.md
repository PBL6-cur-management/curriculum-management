# Chi phí hạ tầng demo

**Tổng hằng tháng: 0 đ**, ngoài tên miền `oguri-lab.io.vn` bạn đã trả ở tenten.vn. Số liệu kiểm ngày 2026-11-01; Oracle có thể đổi hạn mức, xem lại [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) trước khi tăng cấu hình.

## Đang dùng

| Hạng mục | Dùng | Hạn mức miễn phí | Chi phí |
|---|---|---|---|
| VM Ampere A1 (`VM.Standard.A1.Flex`) | 2 OCPU, 12 GB | 2 OCPU + 12 GB **tổng** cho cả tenancy (Always Free, home region) | 0 đ |
| Boot volume | 100 GB | 200 GB tổng boot + block | 0 đ |
| Băng thông ra | vài GB/tháng | 10 TB/tháng | 0 đ |
| VCN, subnet, Internet Gateway, Security List | 1 bộ | Miễn phí | 0 đ |
| IP public tạm thời (mặc định) | 1 | Miễn phí, mất khi xóa VM | 0 đ |
| Budget + cảnh báo email | 1 | Miễn phí | 0 đ |
| Chứng chỉ HTTPS (Let's Encrypt qua Caddy) | 1 | Miễn phí; giới hạn 5 lần cấp lại trùng tên/tuần | 0 đ |
| Terraform, state lưu local | — | Mã nguồn mở | 0 đ |
| GitHub Actions | ~4 phút/CI, ~10 phút/deploy | 2000 phút/tháng (repo private, gói Free) | 0 đ |
| Tên miền `oguri-lab.io.vn` | 1 | — | Đã trả ở tenten; **ghi ngày hết hạn**, quên gia hạn thì link chết |

Ước tính GitHub Actions: 50 PR + 30 lần deploy/tháng ≈ 50×4 + 30×10 = 500 phút, dư nhiều so với 2000.

## Điều làm phát sinh tiền — tránh

| Hành động | Vì sao tốn |
|---|---|
| Nâng tài khoản lên **Pay As You Go** rồi tạo tài nguyên ngoài Always Free | Bị tính theo giá thường. Chỉ nâng khi thật cần (hết máy ARM mãi), và chỉ tạo đúng những gì Terraform ở đây tạo |
| Đặt `ocpus` > 2 hoặc `memory_gb` > 12, tạo VM A1 thứ hai | Vượt hạn mức A1 tổng. Terraform đã có validation chặn |
| Tổng boot + block volume > 200 GB, thêm volume backup quá hạn mức | Vượt hạn mức lưu trữ |
| Load Balancer, Autonomous DB/PostgreSQL managed, OKE, NAT Gateway | Không cần cho demo; một số có bản free nhưng dễ nhầm sang bản trả tiền |
| `use_reserved_ip = true` | Nguồn bên thứ ba ghi 1 IP reserved miễn phí mỗi region, vượt thì ~0,01 USD/giờ (~7,3 USD/tháng) và tính cả khi không gắn; **chưa xác nhận từ bảng giá Oracle** → kiểm [Cloud Price List](https://www.oracle.com/cloud/price-list/) trước khi bật |

## Lưới an toàn

- Terraform tạo **budget 1 USD/tháng** cho cả tenancy, gửi email khi có **bất kỳ** chi phí thật (ngưỡng 1% = 0,01 USD) — điền `budget_alert_email` trong `terraform.tfvars`.
- Tài khoản để ở **Free Tier** (chưa PAYG): hết 300 USD/30 ngày dùng thử, tài nguyên không thuộc Always Free bị dừng chứ không bị tính tiền.
- Hết demo: `terraform destroy` → không còn gì để tính.

## Rủi ro không phải tiền

- Oracle có thể **thu hồi VM Always Free nhàn rỗi** (CPU, mạng, bộ nhớ đều dưới 20% suốt 7 ngày) của tài khoản chưa PAYG. Dữ liệu gốc vẫn ở máy bạn; dựng lại bằng `terraform apply` + `restore-demo-data.sh`.
