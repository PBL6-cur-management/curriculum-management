import type request from 'supertest';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  graduationHarness,
  seedGraduationFixture,
  type GraduationFixture,
} from './fixtures/graduation.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

function bytes(call: request.Test) {
  return call.buffer(true).parse((stream, callback) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', callback);
    stream.on('end', () => callback(null, Buffer.concat(chunks)));
  });
}

describe('Graphs, PDF, timeline and health (F-24)', () => {
  const harness = graduationHarness();
  let fixture: GraduationFixture;
  const base = () =>
    `/api/programs/${fixture.programId}/versions/${fixture.versionId}`;

  beforeAll(async () => {
    fixture = await seedGraduationFixture(harness.app, harness.office);
  });

  it('projects the frame as a semester graph and refuses a version of another program (US-110)', async () => {
    const graph = await harness.office
      .get(`${base()}/course-graph`)
      .expect(200);
    expect(graph.body.version).toMatchObject({ id: fixture.versionId });
    expect(graph.body.nodes).toHaveLength(4);
    expect(
      (graph.body.nodes as { semester: number; external: boolean }[]).every(
        (node) => node.semester === 1 && !node.external,
      ),
    ).toBe(true);
    await harness.office
      .get(`/api/programs/other/versions/${fixture.versionId}/course-graph`)
      .expect(404);
  });

  it('lists issued versions with their cohort assignments (US-112)', async () => {
    const timeline = await harness.office
      .get(`/api/programs/${fixture.programId}/version-timeline`)
      .expect(200);
    expect(timeline.body.events).toHaveLength(1);
    expect(timeline.body.events[0]).toMatchObject({
      versionId: fixture.versionId,
      status: expect.stringMatching(/PENDING|ACTIVE|HISTORICAL/),
    });
    expect(timeline.body.events[0].assignments).toHaveLength(1);
  });

  it('reports every health category as checked (US-113)', async () => {
    const health = await harness.office.get(`${base()}/health`).expect(200);
    expect(health.body.complete).toBe(true);
    expect(health.body.categories).toHaveLength(9);
    expect(
      (health.body.categories as { checked: boolean }[]).every(
        (row) => row.checked,
      ),
    ).toBe(true);
  });

  it('renders a PDF in the worker and hands it only to its owner (US-111)', async () => {
    const created = await harness.office
      .post(`${base()}/pdf-exports`)
      .set(CSRF)
      .expect(202);
    expect(created.body).toMatchObject({ state: 'QUEUED', draft: false });
    const id = created.body.id as string;
    let state = 'QUEUED';
    for (
      let attempt = 0;
      attempt < 60 && !['READY', 'FAILED'].includes(state);
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      state = (
        await harness.office.get(`/api/program-pdf-exports/${id}`).expect(200)
      ).body.state as string;
    }
    expect(state).toBe('READY');
    const file = await bytes(
      harness.office.get(`/api/program-pdf-exports/${id}/file`),
    )
      .expect(200)
      .expect('Content-Type', 'application/pdf');
    expect((file.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const other = await loginAgent(
      harness.app,
      await createAccount(harness.app, 'pdfother', 'R1'),
    );
    await other.get(`/api/program-pdf-exports/${id}`).expect(404);
    await other.get(`/api/program-pdf-exports/${id}/file`).expect(404);
  }, 90_000);
});
