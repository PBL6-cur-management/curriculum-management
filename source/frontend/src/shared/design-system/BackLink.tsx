// Atom: Liên kết quay lại trang cha, đặt ngay trên PageHeader. Một kiểu duy nhất: "← <nhãn>".
// Mũi tên chỉ để nhìn (aria-hidden): tên truy cập của liên kết là đúng nhãn.
// Quay về đúng URL người dùng đã để lại ở trang cha (bộ lọc, trang, từ khóa) nếu trang đó vừa được mở.
// `preferHistory`: trang mở được từ nhiều nơi (vd. Tạo đề xuất) quay lại đúng trang trước đó trong
// lịch sử; chỉ dùng `to` khi trang được mở trực tiếp (dán link, tải lại).
//
//   <BackLink to={ROUTES.programs}>Chương trình 7480201</BackLink>

import { Link, useNavigate } from 'react-router';
import type { MouseEvent, ReactNode } from 'react';
import { resolveBackTarget } from '../layout/navigationMemory';

interface BackLinkProps {
  to: string;
  children: ReactNode;
  preferHistory?: boolean;
}

// React Router numbers its history entries; idx 0 is the first page of this tab.
const hasPreviousEntry = () =>
  typeof window !== 'undefined' &&
  ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

export function BackLink({ to, children, preferHistory }: BackLinkProps) {
  const navigate = useNavigate();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!preferHistory || !hasPreviousEntry()) return;
    event.preventDefault();
    void navigate(-1);
  };
  return (
    <Link
      to={resolveBackTarget(to)}
      onClick={onClick}
      style={{ alignSelf: 'flex-start' }}
    >
      <span aria-hidden="true">← </span>
      {children}
    </Link>
  );
}
