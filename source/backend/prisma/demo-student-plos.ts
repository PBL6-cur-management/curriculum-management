import type { Prisma } from '../src/generated/prisma/client.js';

const KNOWLEDGE = 'Kiến thức';
const SKILLS = 'Kỹ năng';
const AUTONOMY = 'Năng lực tự chủ và trách nhiệm';

// Synthetic outcomes for the demo only; the school database holds no PLOs.
const DEMO_PLOS: { description: string; competencyGroup: string }[] = [
  {
    competencyGroup: KNOWLEDGE,
    description:
      'Vận dụng kiến thức toán, khoa học tự nhiên và khoa học xã hội làm nền tảng cho ngành Công nghệ thông tin.',
  },
  {
    competencyGroup: KNOWLEDGE,
    description:
      'Vận dụng kiến thức cơ sở ngành về lập trình, cấu trúc dữ liệu, cơ sở dữ liệu và mạng máy tính.',
  },
  {
    competencyGroup: KNOWLEDGE,
    description:
      'Vận dụng kiến thức chuyên ngành để phân tích, thiết kế và đánh giá hệ thống phần mềm.',
  },
  {
    competencyGroup: SKILLS,
    description:
      'Phân tích yêu cầu và mô hình hóa bài toán thực tế thành giải pháp tính toán phù hợp.',
  },
  {
    competencyGroup: SKILLS,
    description:
      'Thiết kế, cài đặt, kiểm thử và triển khai sản phẩm phần mềm theo quy trình kỹ thuật.',
  },
  {
    competencyGroup: SKILLS,
    description:
      'Làm việc nhóm, giao tiếp và trình bày kỹ thuật hiệu quả, sử dụng tiếng Anh chuyên ngành.',
  },
  {
    competencyGroup: AUTONOMY,
    description:
      'Tự học, tự nghiên cứu và cập nhật công nghệ mới trong suốt quá trình làm nghề.',
  },
  {
    competencyGroup: AUTONOMY,
    description:
      'Tuân thủ đạo đức nghề nghiệp, pháp luật và có trách nhiệm với cộng đồng.',
  },
];

// Only fills a version with no PLOs, so outcomes the Faculty entered are never overwritten.
export async function seedDemoPlos(
  tx: Prisma.TransactionClient,
  versionId: string,
): Promise<number> {
  const existing = await tx.pLO.count({ where: { versionId } });
  if (existing > 0) return 0;
  const created = await tx.pLO.createMany({
    data: DEMO_PLOS.map((plo, index) => ({
      versionId,
      ploCode: `PLO${index + 1}`,
      sortOrder: index + 1,
      ...plo,
    })),
  });
  return created.count;
}
