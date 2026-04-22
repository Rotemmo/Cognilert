/**
 * Heart Rate Alert Generator
 *
 * Converts AnalysisResult objects (from analyzer.js) into structured Alert
 * objects for the doctor dashboard. Each alert has a severity on the 1–5
 * scale used by the rest of CogniLert (1 = informational, 5 = critical).
 *
 * Alert types and their default severities:
 *   TACHY_MILD      — sustained HR 100–115 bpm              → 2
 *   TACHY_MODERATE  — sustained HR 115–130 bpm              → 3
 *   TACHY_SEVERE    — sustained HR > 130 bpm                → 4–5
 *   BRADY           — sustained HR < 50 bpm                 → 3–4
 *   BASELINE_HIGH   — resting avg > 20% above baseline      → 2
 *   BASELINE_LOW    — resting avg > 20% below baseline      → 3
 *   HIGH_HRV        — unusually high beat-to-beat variation → 2
 *   LOW_HRV         — autonomic rigidity signal             → 3
 */

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Map a tachycardia episode to a severity level.
 */
function tachySeverity(peakBpm, durationMinutes) {
  if (peakBpm > 130 || durationMinutes > 30) return 4;
  if (peakBpm > 115 || durationMinutes > 15) return 3;
  return 2;
}

/**
 * Map a bradycardia episode to a severity level.
 */
function bradySeverity(peakBpm) {
  if (peakBpm < 40) return 4;
  return 3;
}

/**
 * Format a timestamp to HH:MM for display.
 */
function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format a date to YYYY-MM-DD.
 */
function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Generate Alert objects from a single AnalysisResult.
 *
 * @param {AnalysisResult} result
 * @param {object}         patient - must have { id, name, riskLevel }
 * @returns {Alert[]}
 */
export function generateAlerts(result, patient) {
  const alerts = [];
  const dateStr = fmtDate(result.date);

  // --- Episode-based alerts (tachycardia / bradycardia) ---
  for (const ep of result.episodes) {
    if (ep.type === 'tachycardia') {
      const severity = tachySeverity(ep.peakBpm, ep.durationMinutes);
      const label =
        severity >= 4 ? 'Severe Tachycardia' :
        severity === 3 ? 'Moderate Tachycardia' : 'Mild Tachycardia';

      alerts.push({
        id: makeId(),
        patientId: patient.id,
        patientName: patient.name,
        timestamp: ep.startTimestamp,
        type: 'TACHYCARDIA',
        severity,
        title: label,
        description:
          `HR reached ${ep.peakBpm} bpm (avg ${ep.avgBpm} bpm) for ${ep.durationMinutes} min ` +
          `starting at ${fmtTime(ep.startTimestamp)} on ${dateStr}.`,
        data: {
          peakBpm: ep.peakBpm,
          avgBpm: ep.avgBpm,
          durationMinutes: ep.durationMinutes,
          startTime: ep.startTimestamp,
          endTime: ep.endTimestamp,
          context: 'episode',
        },
        dayPostOp: result.dayPostOp,
        acknowledged: false,
      });
    }

    if (ep.type === 'bradycardia') {
      const severity = bradySeverity(ep.peakBpm);
      alerts.push({
        id: makeId(),
        patientId: patient.id,
        patientName: patient.name,
        timestamp: ep.startTimestamp,
        type: 'BRADYCARDIA',
        severity,
        title: 'Bradycardia Detected',
        description:
          `HR dropped to ${ep.peakBpm} bpm for ${ep.durationMinutes} min ` +
          `starting at ${fmtTime(ep.startTimestamp)} on ${dateStr}.`,
        data: {
          lowestBpm: ep.peakBpm,
          avgBpm: ep.avgBpm,
          durationMinutes: ep.durationMinutes,
          startTime: ep.startTimestamp,
          endTime: ep.endTimestamp,
          context: 'episode',
        },
        dayPostOp: result.dayPostOp,
        acknowledged: false,
      });
    }
  }

  // --- Baseline deviation alerts ---
  const dev = result.baselineDeviationPct;
  if (dev !== null && Math.abs(dev) >= 20) {
    const isHigh = dev > 0;
    alerts.push({
      id: makeId(),
      patientId: patient.id,
      patientName: patient.name,
      timestamp: result.date,
      type: isHigh ? 'BASELINE_HIGH' : 'BASELINE_LOW',
      severity: isHigh ? 2 : 3,
      title: isHigh ? 'Elevated Resting HR vs. Baseline' : 'Depressed Resting HR vs. Baseline',
      description:
        `Resting HR on ${dateStr} was ${Math.abs(dev)}% ${isHigh ? 'above' : 'below'} ` +
        `personal baseline (${result.contextAverages.rest} vs expected ${
          isHigh
            ? result.contextAverages.rest - Math.round((dev / 100) * result.contextAverages.rest)
            : result.contextAverages.rest + Math.round((Math.abs(dev) / 100) * result.contextAverages.rest)
        } bpm).`,
      data: {
        observedRestingBpm: result.contextAverages.rest,
        deviationPct: dev,
        context: 'daily_average',
      },
      dayPostOp: result.dayPostOp,
      acknowledged: false,
    });
  }

  // --- HRV alerts ---
  if (result.findings.includes('high_hrv')) {
    alerts.push({
      id: makeId(),
      patientId: patient.id,
      patientName: patient.name,
      timestamp: result.date,
      type: 'HIGH_HRV',
      severity: 2,
      title: 'High Heart Rate Variability',
      description:
        `Minute-to-minute HR variability (${result.hrv} bpm RMSSD) is elevated on ${dateStr}, ` +
        `potentially indicating autonomic stress or arrhythmia.`,
      data: { hrv: result.hrv, context: 'daily_average' },
      dayPostOp: result.dayPostOp,
      acknowledged: false,
    });
  }

  if (result.findings.includes('low_hrv')) {
    alerts.push({
      id: makeId(),
      patientId: patient.id,
      patientName: patient.name,
      timestamp: result.date,
      type: 'LOW_HRV',
      severity: 3,
      title: 'Low Heart Rate Variability',
      description:
        `Minute-to-minute HR variability (${result.hrv} bpm RMSSD) is unusually low on ${dateStr}. ` +
        `Autonomic rigidity may indicate reduced cardiac adaptability post-surgery.`,
      data: { hrv: result.hrv, context: 'daily_average' },
      dayPostOp: result.dayPostOp,
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Generate alerts for a multi-day history.
 *
 * @param {AnalysisResult[]} results
 * @param {object}           patient
 * @returns {Alert[]}        sorted newest-first, then by severity descending
 */
export function generateAlertHistory(results, patient) {
  const all = results.flatMap((r) => generateAlerts(r, patient));
  return all.sort((a, b) => {
    const dateDiff = new Date(b.timestamp) - new Date(a.timestamp);
    if (dateDiff !== 0) return dateDiff;
    return b.severity - a.severity;
  });
}

/**
 * Return only alerts at or above a given severity threshold.
 *
 * @param {Alert[]} alerts
 * @param {number}  minSeverity - default 3 (matches CogniLert alert threshold)
 */
export function filterByMinSeverity(alerts, minSeverity = 3) {
  return alerts.filter((a) => a.severity >= minSeverity);
}

/**
 * Summarize a list of alerts into counts by type and severity.
 */
export function summarizeAlerts(alerts) {
  const byType = {};
  const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const a of alerts) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }

  return {
    total: alerts.length,
    byType,
    bySeverity,
    critical: alerts.filter((a) => a.severity >= 4).length,
  };
}
