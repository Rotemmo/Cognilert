/**
 * Heart Rate Analysis — public API
 *
 * Usage:
 *   import { runHRAnalysis } from './heartRate';
 *
 *   const { sessions, analysisResults, alerts } = runHRAnalysis(patient, 7);
 */

export { generateHRSession, generateHRHistory } from './simulator.js';
export { analyzeHRSession, analyzeHRHistory } from './analyzer.js';
export {
  generateAlerts,
  generateAlertHistory,
  filterByMinSeverity,
  summarizeAlerts,
} from './alerts.js';

import { generateHRHistory } from './simulator.js';
import { analyzeHRHistory } from './analyzer.js';
import { generateAlertHistory, summarizeAlerts } from './alerts.js';

/**
 * Full pipeline: simulate → analyze → generate alerts.
 *
 * @param {object} patient - { id, name, riskLevel, age }
 * @param {number} days    - days of history to generate
 * @returns {{ sessions, analysisResults, alerts, summary }}
 */
export function runHRAnalysis(patient, days = 7) {
  const sessions = generateHRHistory(patient, days);
  const analysisResults = analyzeHRHistory(sessions);
  const alerts = generateAlertHistory(analysisResults, patient);
  const summary = summarizeAlerts(alerts);

  return { sessions, analysisResults, alerts, summary };
}
