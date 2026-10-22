import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// A reporter (identified by the long random key their device stores) can close or
// reopen their own report. Everyone else is refused, so public reports stay trustworthy.
const ALLOWED_ACTIONS = ['resolve', 'reopen'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try {
      payload = await req.json();
    } catch (e) {
      payload = {};
    }

    const reportId = typeof payload.reportId === 'string' ? payload.reportId.trim() : '';
    const reporterKey = typeof payload.reporterKey === 'string' ? payload.reporterKey.trim() : '';
    const action = typeof payload.action === 'string' ? payload.action : '';

    if (!reportId || !reporterKey || !ALLOWED_ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const report = await base44.asServiceRole.entities.Report.get(reportId);
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    if (report.reporter_key !== reporterKey) {
      return Response.json({ error: 'Only the reporter can change this report' }, { status: 403 });
    }

    const status = action === 'resolve' ? 'resolved' : 'pending';
    const updated = await base44.asServiceRole.entities.Report.update(reportId, { status });

    return Response.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}