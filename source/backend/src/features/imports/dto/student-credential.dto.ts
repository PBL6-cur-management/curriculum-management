import { ApiProperty } from '@nestjs/swagger';

export class StudentCredentialStatusDto {
  @ApiProperty() available!: boolean;
  @ApiProperty() accountCount!: number;
  @ApiProperty({ type: String, nullable: true }) expiresAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) downloadedAt!: string | null;
}
