/**
 * Quick demo — run with:  node src/analysis/heartRate/demo.mjs
 *
 * Shows: 7-day HR analysis + generated alerts for three synthetic patients.
 */

import { generateHRHistory } from './simulator.js';
import { analyzeHRHistory } from './analyzer.js';
import { generateAlertHistory, summarizeAlerts } from './alerts.js';

const PATIENTS = [
  { id: 1, name: 'Ruth Cohen',    riskLevel: 'HIGH',     age: 78 },
  { id: 2, name: 'David Levy',    riskLevel: 'MODERATE', age: 72 },
  { id: 3, name: 'Sara Mizrahi',  riskLevel: 'LOW',      age: 68 },
];

for (const patient of PATIENTS) {
  console.log('\n' + '='.repeat(60));
  console.log(`Patient: ${patient.name} | Risk: ${patient.riskLevel} | Age: ${patient.age}`);
  console.log('='.repeat(60));

  const sessions = generateHRHistory(patient, 7);
  const results  = analyzeHRHistory(sessions);
  const alerts   = generateAlertHistory(results, patient);
  const summary  = summarizeAlerts(alerts);

  // Per-day summary
  console.log('\nDay-by-day HR summary:');
  for (const r of results) {
    const flagged = r.findings.length > 0 ? ` ⚠  [${r.findings.join(', ')}]` : '  ✓ clean';
    console.log(
      `  Day ${String(r.dayPostOp).padStart(2)}: ` +
      `avg=${r.summary.avg} bpm  min=${r.summary.min}  max=${r.summary.max}  ` +
      `HRV=${r.hrv}  dev=${r.baselineDeviationPct ?? 'N/A'}%` +
      flagged
    );
  }

  // Alerts
  console.log(`\nAlerts generated: ${summary.total} total, ${summary.critical} critical`);
  console.log('  By type:', summary.byType);
  console.log('  By severity:', summary.bySeverity);

  if (alerts.length > 0) {
    console.log('\nTop alerts:');
    alerts.slice(0, 3).forEach((a) => {
      console.log(`  [sev ${a.severity}] ${a.title}`);
      console.log(`    ${a.description}`);
    });
  }
}
