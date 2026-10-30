# F-24 — Test cases: đồ thị, PDF, dòng thời gian, sức khỏe chương trình

| ID | US / MH | Tình huống | Kỳ vọng | Tự động |
|---|---|---|---|---|
| TC-F24-01 | US-110 / MH-20 | Mở đồ thị của một phiên bản | Mỗi học kỳ một cột, nút theo thứ tự khung; quan hệ thay thế không vẽ | BE e2e, FE vitest |
| TC-F24-02 | US-110 | Học phần điều kiện nằm ngoài khung | Nút riêng ở cột "Ngoài khung" + cảnh báo trên trang | BE unit, FE vitest |
| TC-F24-03 | US-110 | Chọn một học phần | Liệt kê "Cần học trước", "Phụ thuộc vào học phần này", "Song hành"; vòng lặp không treo | FE vitest |
| TC-F24-04 | US-110 | Gọi đồ thị với phiên bản thuộc chương trình khác | 404 | BE e2e |
| TC-F24-05 | US-112 / MH-46 | Mở dòng thời gian | Chỉ phiên bản đã ban hành, theo ngày hiệu lực rồi ngày ban hành; mỗi phiên bản có khóa được gán và liên kết so sánh với phiên bản trước | BE unit, BE e2e, FE vitest |
| TC-F24-06 | US-113 / MH-28 | Mở bảng sức khỏe | 9 nhóm đều đã chạy; lỗi trước cảnh báo; mỗi dòng có liên kết "Sửa ở" đúng màn hình | BE e2e, FE vitest |
| TC-F24-07 | US-113 | Một nhóm kiểm tra chưa chạy được (`complete: false`) | Hiện "Báo cáo chưa đầy đủ", không bao giờ hiện "Không có cảnh báo" | FE vitest |
| TC-F24-08 | US-111 | Xuất PDF | 202 QUEUED → READY; file `application/pdf` bắt đầu `%PDF-`; tải tự động | BE e2e, thử tay |
| TC-F24-09 | US-111 | Người khác hỏi trạng thái / tải file của job | 404 cả hai | BE e2e |
| TC-F24-10 | US-111 | Xuất PDF phiên bản Nháp | Mọi trang có dấu "BẢN NHÁP"; nút báo trước cho người dùng | BE unit, thử tay |
| TC-F24-11 | US-111 | Dữ liệu chứa `<script>` hay ký tự HTML | Bị thoát; HTML không có `<script>` hay URL ngoài | BE unit |
| TC-F24-12 | US-111 | Tải file sau 1 giờ | 410 PDF_EXPORT_EXPIRED | Thủ công |
