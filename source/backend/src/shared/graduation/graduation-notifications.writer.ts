import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { activeAcademicOfficeWhere } from '../change-requests/academic-office.js';
import { todayDate } from '../time/today.js';
import type {
  GraduationConclusion,
  GraduationContextValue,
} from './graduation.types.js';

const CONCLUSION_LABELS: Record<GraduationConclusion, string> = {
  ELIGIBLE: 'Đủ điều kiện',
  NOT_ELIGIBLE: 'Chưa đủ điều kiện',
};

@Injectable()
export class GraduationNotificationsWriter {
  private readonly logger = new Logger(GraduationNotificationsWriter.name);

  async conclusionChanged(
    tx: Prisma.TransactionClient,
    input: {
      auditId: string;
      context: GraduationContextValue;
      previous: GraduationConclusion;
      next: GraduationConclusion;
    },
  ): Promise<number> {
    if (input.previous === input.next) return 0;
    const assignments = await tx.roleAssignment.findMany({
      where: activeAcademicOfficeWhere(todayDate()),
      select: { userId: true },
    });
    const recipients = [...new Set(assignments.map(({ userId }) => userId))];
    if (!recipients.length) {
      this.logger.warn(
        'Không có người nhận thông báo đổi kết luận tốt nghiệp: 0.',
      );
      return 0;
    }
    const { context, previous, next } = input;
    const content = `Kết luận tốt nghiệp của sinh viên ${context.studentCode} — ${context.fullName}, chương trình ${context.programCode}, học kỳ ${context.semesterCode} đã đổi từ “${CONCLUSION_LABELS[previous]}” sang “${CONCLUSION_LABELS[next]}”.`;
    const { count } = await tx.notification.createMany({
      data: recipients.map((recipientId) => ({
        recipientId,
        notificationType: 'GRADUATION_CONCLUSION_CHANGED',
        changeRequestId: null,
        content,
      })),
    });
    if (count === 0) {
      this.logger.warn('Số thông báo đổi kết luận tốt nghiệp được ghi: 0.');
    }
    return count;
  }
}
