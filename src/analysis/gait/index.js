/**
 * Gait Analysis — public API
 *
 * Usage:
 *   import { runGaitAnalysis } from './gait';
 *
 *   const { result, alerts, summary } = runGaitAnalysis(patient, seed);
 *
 * seed = 0 (default): baseline window (first 30 strides of the dataset)
 * seed > 0:           new 30-stride window from the full sensor dataset,
 *                     simulating a fresh measurement from the wearable
 */

export { analyzeGaitSession }    from './analyzer.js';
export { generateGaitSession }   from './simulator.js';
export {
  generateAlerts,
  generateAlertHistory,
  filterByMinSeverity,
  summarizeAlerts,
} from './alerts.js';

import { analyzeGaitSession }  from './analyzer.js';
import { generateGaitSession } from './simulator.js';
import { generateAlerts, summarizeAlerts } from './alerts.js';

/**
 * Full pipeline: generate session window → analyze → alerts.
 *
 * @param {object} patient
 * @param {number} seed    — 0 = baseline; increment for new measurement window
 * @returns {{ result, alerts, summary }}
 */
export function runGaitAnalysis(patient, seed = 0) {
  const session = generateGaitSession(patient, seed);
  const result  = analyzeGaitSession(session);
  const alerts  = generateAlerts(result, patient);
  const summary = summarizeAlerts(alerts);

  return { result, alerts, summary };
}
