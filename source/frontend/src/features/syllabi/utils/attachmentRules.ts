import type { AttachmentRules } from '../api/syllabi';
import {
  ACCEPTED_EXTENSIONS,
  ATTACHMENT_TYPE_LABELS,
} from '../constants/syllabusLabels';

const BYTES_PER_MB = 1024 * 1024;

export function attachmentHint(rules: AttachmentRules): string {
  const types = rules.fileTypes
    .map((type) => ATTACHMENT_TYPE_LABELS[type])
    .join(', ');
  return `Nhận tệp ${types}; tối đa ${rules.maxBytes / BYTES_PER_MB} MB mỗi tệp.`;
}

export function acceptedExtensions(rules: AttachmentRules): string[] {
  return rules.fileTypes.flatMap((type) => [...ACCEPTED_EXTENSIONS[type]]);
}

// Mirrors the server check to refuse invalid files before uploading; the server still decides.
export function checkAttachment(
  file: Pick<File, 'name' | 'size'>,
  rules: AttachmentRules,
): string | null {
  const dot = file.name.lastIndexOf('.');
  const extension = dot < 0 ? '' : file.name.slice(dot).toLowerCase();
  if (
    !acceptedExtensions(rules).includes(extension) ||
    file.size > rules.maxBytes
  )
    return `Không nhận tệp "${file.name}". ${attachmentHint(rules)}`;
  return null;
}
