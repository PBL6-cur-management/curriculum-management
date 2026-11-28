import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CourseRelationType,
  SubjectGroupMemberRole,
} from '../../generated/prisma/client.js';
import {
  AUTHORED_OPERATION,
  COURSE_REQUEST_FIELDS,
  type AuthoredOperation,
  type CourseRequestField,
} from '../../shared/change-requests/authored-item.types.js';
import {
  SCORE10_MESSAGE,
  SCORE10_PATTERN,
} from '../../shared/decimal/decimal.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';
import { CHANGE_REQUEST_LIMITS } from './change-request.constants.js';

// One class per operation; the `operation` property picks the class (class-transformer discriminator).
export abstract class AuthoredItemInputBase {
  @ApiProperty({ enum: Object.values(AUTHORED_OPERATION) })
  @IsIn(Object.values(AUTHORED_OPERATION))
  operation!: AuthoredOperation;
}

export class SetCourseFieldInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.SET_COURSE_FIELD;
  @ApiProperty({ enum: COURSE_REQUEST_FIELDS })
  @IsIn(COURSE_REQUEST_FIELDS)
  field!: CourseRequestField;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(CHANGE_REQUEST_LIMITS.COURSE_NAME_MAX)
  value!: string | null;
}

export class AddRelationInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.ADD_RELATION;
  @ApiProperty() @IsString() sourceCourseId!: string;
  @ApiProperty() @IsString() targetCourseId!: string;
  @ApiProperty({ enum: CourseRelationType, enumName: 'CourseRelationType' })
  @IsEnum(CourseRelationType)
  relationType!: CourseRelationType;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Matches(SCORE10_PATTERN, { message: SCORE10_MESSAGE })
  minScore!: string | null;
}

export class UpdateRelationInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.UPDATE_RELATION;
  @ApiProperty() @IsString() relationId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Matches(SCORE10_PATTERN, { message: SCORE10_MESSAGE })
  minScore!: string | null;
}

export class RemoveRelationInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.REMOVE_RELATION;
  @ApiProperty() @IsString() relationId!: string;
}

export class AddMemberInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.ADD_MEMBER;
  @ApiProperty() @IsString() lecturerId!: string;
  @ApiProperty({
    enum: SubjectGroupMemberRole,
    enumName: 'SubjectGroupMemberRole',
  })
  @IsEnum(SubjectGroupMemberRole)
  memberRole!: SubjectGroupMemberRole;
  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  validFrom!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  validTo!: string | null;
}

export class EndMembershipInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.END_MEMBERSHIP;
  @ApiProperty() @IsString() memberRowId!: string;
  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  validTo!: string;
}

export class AssignDirectorInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.ASSIGN_DIRECTOR;
  @ApiProperty() @IsString() directorId!: string;
  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  validFrom!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  validTo!: string | null;
}

export class EndDirectorInput extends AuthoredItemInputBase {
  declare operation: typeof AUTHORED_OPERATION.END_DIRECTOR;
  @ApiProperty() @IsString() assignmentId!: string;
  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  validTo!: string;
}

export type AuthoredItemInput =
  | SetCourseFieldInput
  | AddRelationInput
  | UpdateRelationInput
  | RemoveRelationInput
  | AddMemberInput
  | EndMembershipInput
  | AssignDirectorInput
  | EndDirectorInput;

export class ReplaceAuthoredItemsDto {
  @ApiProperty({
    type: [AuthoredItemInputBase],
    description: 'The whole list: items not sent are removed',
  })
  @IsArray()
  @ArrayMaxSize(CHANGE_REQUEST_LIMITS.AUTHORED_ITEMS_MAX)
  @ValidateNested({ each: true })
  @Type(() => AuthoredItemInputBase, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'operation',
      subTypes: [
        {
          value: SetCourseFieldInput,
          name: AUTHORED_OPERATION.SET_COURSE_FIELD,
        },
        { value: AddRelationInput, name: AUTHORED_OPERATION.ADD_RELATION },
        {
          value: UpdateRelationInput,
          name: AUTHORED_OPERATION.UPDATE_RELATION,
        },
        {
          value: RemoveRelationInput,
          name: AUTHORED_OPERATION.REMOVE_RELATION,
        },
        { value: AddMemberInput, name: AUTHORED_OPERATION.ADD_MEMBER },
        { value: EndMembershipInput, name: AUTHORED_OPERATION.END_MEMBERSHIP },
        {
          value: AssignDirectorInput,
          name: AUTHORED_OPERATION.ASSIGN_DIRECTOR,
        },
        { value: EndDirectorInput, name: AUTHORED_OPERATION.END_DIRECTOR },
      ],
    },
  })
  items!: AuthoredItemInput[];
}

export class UserOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userCode!: string;
  @ApiProperty() fullName!: string;
}

export class UserOptionQueryDto {
  @ApiPropertyOptional({ maxLength: CHANGE_REQUEST_LIMITS.QUERY_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(CHANGE_REQUEST_LIMITS.QUERY_MAX)
  q?: string;
}
