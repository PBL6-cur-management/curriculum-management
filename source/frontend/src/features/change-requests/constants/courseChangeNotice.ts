import type { ChangeRequestType } from '../api/changeRequests';

export const COURSE_CHANGE_NOTICE =
  'Phiên bản chương trình đã ban hành giữ nguyên tên, tín chỉ và tiên quyết đã chụp; thay đổi này vào khung khi tạo phiên bản sau. Riêng học phần thay thế áp dụng ngay cho mọi sinh viên.';

// Course fields and relations travel in COURSE_RELATION requests; no separate course-field type exists.
export const COURSE_CHANGE_TYPES: readonly ChangeRequestType[] = [
  'COURSE_RELATION',
];
