// Atom: Liên kết quay lại trang cha, đặt ngay trên PageHeader. Một kiểu duy nhất: "← <nhãn>".
//
//   <BackLink to={ROUTES.programs}>Chương trình 7480201</BackLink>

import { Link } from 'react-router';
import type { ReactNode } from 'react';

interface BackLinkProps {
  to: string;
  children: ReactNode;
}

export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link to={to} style={{ alignSelf: 'flex-start' }}>
      ← {children}
    </Link>
  );
}
