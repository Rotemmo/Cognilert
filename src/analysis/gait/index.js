/**
 * Gait Analysis — public API
 *
 * Usage:
 *   import { runGaitAnalysis } from './gait';
 *
 *   const { result, alerts, summary } = runGaitAnalysis(patient);
 *
 * The patient object must have:
 *   patient.gait.samples       — stride interval array (seconds)
 *   patient.gait.sessionCv     — CV% from full session (authoritative, from wearable)
 *   patient.gait.sessionMean   — mean stride from full session (authoritative)
 *   patient.gait.freezingCount — freezing-of-gait events in full session (default 0)
 */

export { analyzeGaitSession } from './analyzer.js';
export {
  generateAlerts,
  generateAlertHistory,
  filterByMinSeverity,
  summarizeAlerts,
} from './alerts.js';

import { analyzeGaitSession } from './analyzer.js';
import { generateAlerts, summarizeAlerts } from './alerts.js';

/**
 * Build a GaitSession object from a patient record.
 * Mirrors the role of generateHRSession() in the HR pipeline.
 */
function createGaitSession(patient) {
  return {
    patientId:     patient.id,
    dayPostOp:     patient.dayPost,
    samples:       patient.gait.samples,
    sessionCv:     patient.gait.sessionCv,
    sessionMean:   patient.gait.sessionMean,
    freezingCount: patient.gait.freezingCount ?? 0,
  };
}

/**
 * Full pipeline: package session → analyze → generate alerts.
 *
 * @param {object} patient
 * @returns {{ result, alerts, summary }}
 */
export function runGaitAnalysis(patient) {
  const session = createGaitSession(patient);
  const result  = analyzeGaitSession(session);
  const alerts  = generateAlerts(result, patient);
  const summary = summarizeAlerts(alerts);

  return { result, alerts, summary };
}
