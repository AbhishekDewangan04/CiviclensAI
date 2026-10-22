import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    hotspots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          issue: { type: 'string' },
          severity: { type: 'string' },
          signal: { type: 'string' }
        },
        required: ['area', 'issue', 'severity', 'signal']
      }
    },
    recommendations: { type: 'array', items: { type: 'string' } }
  },
  required: ['headline', 'summary', 'hotspots', 'recommendations']
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const [total, resolvedCount, criticalCount, pendingCount] = await Promise.all([
      base44.asServiceRole.entities.Report.count({}),
      base44.asServiceRole.entities.Report.count({ status: 'resolved' }),
      base44.asServiceRole.entities.Report.count({ severity: 'critical' }),
      base44.asServiceRole.entities.Report.count({ status: 'pending' })
    ]);

    if (!total) {
      return Response.json({ empty: true, total: 0 });
    }

    // One bounded page drives both the sample list and the tallies the model reads.
    const { items } = await base44.asServiceRole.entities.Report.filter({}, { sort: '-created_date', limit: 100 });
    const tally = (field) =>
      items.reduce((acc, r) => {
        const key = String(r[field] || 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const samples = items.slice(0, 40).map((r) => ({
      title: String(r.title || '').slice(0, 110),
      category: r.category,
      status: r.status,
      severity: r.severity,
      area: String(r.address || '').slice(0, 70),
      note: String(r.description || '').slice(0, 160),
      filed: r.created_date
    }));

    const data = {
      total_reports: total,
      resolved_reports: resolvedCount,
      pending_reports: pendingCount,
      critical_reports: criticalCount,
      recent_tallies: {
        sample_size: items.length,
        by_status: tally('status'),
        by_category: tally('category'),
        by_severity: tally('severity')
      },
      recent_reports: samples
    };

    const prompt = `You are a civic intelligence analyst for CiviCLens, a public platform where citizens report city issues.

Below is aggregated, publicly filed report data for the city. Write a short intelligence briefing.

Rules:
- Use only the data given. Never invent areas, numbers, or events.
- Area names are citizen-typed addresses; reuse them exactly as given.
- "total_reports" and the "resolved/pending/critical_reports" counters cover every report ever filed; "recent_tallies" and "recent_reports" cover only the most recently filed reports.
- Highlight genuine patterns, clusters and the most urgent signals in the data.
- Write plainly, for a general public reader. No jargon, no filler.

DATA (JSON):
${JSON.stringify(data)}

Return a JSON object with these fields:
- headline: a punchy briefing title, max 10 words
- summary: 3-4 sentences describing the city's current civic signals
- hotspots: 2-4 items. Each: "area" (verbatim from the data), "issue" (short phrase), "severity" (one of "critical", "high", "medium", "low"), "signal" (one sentence on why it matters)
- recommendations: 3-5 short, concrete actions a city team could take this week`;

    const insight = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: INSIGHT_SCHEMA
    });

    return Response.json({
      generated_at: new Date().toISOString(),
      total,
      insight
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}