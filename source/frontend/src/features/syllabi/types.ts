import type { AttachmentRules, Syllabus } from './api/syllabi';

// What every tab of the editor receives.
export interface EditorTabProps {
  courseId: string;
  syllabus: Syllabus;
  attachmentRules: AttachmentRules;
  // A Draft exists and the caller edits CLOs on it directly (clo.edit).
  canEditClos: boolean;
  // The caller edits the syllabus text, weekly rows and files on this Draft directly (syllabus.edit).
  canEditContent: boolean;
  // A Draft exists and the caller edits its grade formula and mappings directly (gradingFormula.edit).
  canEditGradingFormula: boolean;
  // Tabs that hold unsaved input report it so the page can confirm before leaving them.
  onDirtyChange?: (dirty: boolean) => void;
  onNavigateTab?: (tabKey: string) => void;
}
