import request from 'supertest';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

export interface ReadyAssessmentOptions {
  componentCode?: string;
  componentName?: string;
}

interface DraftState {
  id: string;
  updatedAt: string;
  clos: { id: string }[];
  gradingFormula: {
    components: {
      id: string;
      mappings: { cloId: string; cloWeight: string | null }[];
    }[];
  };
}

async function readDraft(
  agent: Agent,
  courseId: string,
  syllabusId: string,
): Promise<DraftState> {
  const body = (
    await agent.get(`/api/courses/${courseId}/syllabus`).expect(200)
  ).body;
  const draft = body.draft as DraftState | null;
  if (!draft || draft.id !== syllabusId) {
    throw new Error(`Draft ${syllabusId} is not the Draft of ${courseId}`);
  }
  return draft;
}

// Gives a Draft one 100% component when it has none, then maps every CLO that no component assesses to the first
// component. A formula the test already stored is kept as it is.
export async function makeAssessmentReady(
  agent: Agent,
  courseId: string,
  syllabusId: string,
  options: ReadyAssessmentOptions = {},
): Promise<void> {
  let draft = await readDraft(agent, courseId, syllabusId);
  if (draft.gradingFormula.components.length === 0) {
    await agent
      .put(`/api/syllabi/${syllabusId}/grading-formula`)
      .set(CSRF)
      .send({
        expectedUpdatedAt: draft.updatedAt,
        failingScore: null,
        components: [
          {
            componentCode: options.componentCode ?? 'GK',
            componentName: options.componentName ?? 'Đánh giá chung',
            weight: '100',
            isConditional: false,
          },
        ],
      })
      .expect(200);
    draft = await readDraft(agent, courseId, syllabusId);
  }
  const components = draft.gradingFormula.components;
  const mappings = components.flatMap((component) =>
    component.mappings.map((mapping) => ({
      assessmentComponentId: component.id,
      cloId: mapping.cloId,
      cloWeight: mapping.cloWeight,
    })),
  );
  const covered = new Set(mappings.map((mapping) => mapping.cloId));
  const missing = draft.clos.filter((clo) => !covered.has(clo.id));
  if (missing.length === 0) return;
  await agent
    .put(`/api/syllabi/${syllabusId}/assessment-clo-mappings`)
    .set(CSRF)
    .send({
      expectedUpdatedAt: draft.updatedAt,
      mappings: [
        ...mappings,
        ...missing.map((clo) => ({
          assessmentComponentId: components[0]!.id,
          cloId: clo.id,
          cloWeight: null,
        })),
      ],
    })
    .expect(200);
}
