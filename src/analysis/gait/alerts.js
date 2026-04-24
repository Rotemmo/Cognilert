/**
 * Gait Alert Generator
 *
 * Converts GaitAnalysisResult objects into structured Alert objects
 * for the doctor dashboard. Alert shape and severity scale (1–5) are
 * identical to the heart rate alert system.
 *
 * Alert types and default severities:
 *   CRITICAL_VARIABILITY  — CV >= 9% (session)                → 4
 *   ELEVATED_VARIABILITY  — CV >= 6% (session)                → 3
 *   MODERATE_VARIABILITY  — CV >= 3.5% (session)              → 2
 *   MILD_VARIABILITY      — CV >= 2% (session)                → 1
 *   FREEZING_EPISODE      — freezing-of-gait detected         → 4
 *   TREND_DETERIORATION   — intra-session worsening           → 2
 */

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const FINDING_TYPE_TO_ALERT = {
  critical_variability: { type: 'CRITICAL_VARIABILITY', title: 'Critical Gait Dysrhythmia' },
  elevated_variability: { type: 'ELEVATED_VARIABILITY', title: 'Elevated Stride Variability' },
  moderate_variability: { type: 'MODERATE_VARIABILITY', title: 'Moderate Stride Variability' },
  mild_variability:     { type: 'MILD_VARIABILITY',     title: 'Mild Stride Variability' },
  freezing_episode:     { type: 'FREEZING_EPISODE',     title: 'Freezing-of-Gait Episode' },
  trend_deterioration:  { type: 'TREND_DETERIORATION',  title: 'Gait Trend Deteriorating' },
};

/**
 * Generate Alert objects from a single GaitAnalysisResult.
 *
 * @param {GaitAnalysisResult} result
 * @param {object}             patient - { id, name, riskLevel }
 * @returns {Alert[]}
 */
export function generateAlerts(result, patient) {
  const alerts = [];
  const dateStr = new Date(result.timestamp).toISOString().slice(0, 10);

  for (const finding of result.findings) {
    const meta = FINDING_TYPE_TO_ALERT[finding.type];
    if (!meta) continue;

    alerts.push({
      id:          makeId(),
      patientId:   patient.id,
      patientName: patient.name,
      timestamp:   result.timestamp,
      type:        meta.type,
      severity:    finding.severity,
      title:       meta.title,
      description: finding.description,
      data: {
        cv:               result.cv,
        consistencyScore: result.consistencyScore,
        riskScore:        result.riskScore,
        findingType:      finding.type,
      },
      dayPostOp:    result.dayPostOp,
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Generate alerts for a list of analysis results.
 * Returns sorted newest-first, then severity descending.
 */
export function generateAlertHistory(results, patient) {
  const all = results.flatMap((r) => generateAlerts(r, patient));
  return all.sort((a, b) => {
    const dateDiff = new Date(b.timestamp) - new Date(a.timestamp);
    if (dateDiff !== 0) return dateDiff;
    return b.severity - a.severity;
  });
}

export function filterByMinSeverity(alerts, minSeverity = 3) {
  return alerts.filter((a) => a.severity >= minSeverity);
}

export function summarizeAlerts(alerts) {
  const byType = {};
  const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const a of alerts) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }
  return {
    total:    alerts.length,
    byType,
    bySeverity,
    critical: alerts.filter((a) => a.severity >= 4).length,
  };
}
