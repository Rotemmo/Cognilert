/**
 * Gait Session Simulator
 *
 * Picks a 30-stride window from the patient's full real-sensor dataset.
 * Each seed yields a different window, simulating a new measurement arriving
 * from the wearable — same way the HR simulator generates a fresh day's data.
 *
 * Seed 0 always returns the first 30 strides (the patient's "baseline"
 * window, matching the samples previously hardcoded in PATIENTS).
 * Higher seeds slide through the dataset using a prime-step offset so
 * consecutive clicks feel varied rather than sequential.
 */

import { STRIDE_DATA, PATIENT_DATASET } from './strideData.js';

const WINDOW = 30;
const STEP   = 17; // prime — spreads windows non-linearly across the dataset

/**
 * Compute mean + CV for a slice of strides.
 */
function windowStats(samples) {
  const n    = samples.length;
  const mean = samples.reduce((s, v) => s + v, 0) / n;
  const sd   = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return {
    mean: Math.round(mean * 1000) / 1000,
    cv:   Math.round((sd / mean) * 1000) / 10,  // one decimal place
  };
}

/**
 * Build a GaitSession from a patient record and a seed.
 *
 * @param {object} patient  — must have patient.id and patient.gait.freezingCount
 * @param {number} seed     — 0 = baseline window; increments give new windows
 * @returns {GaitSession}
 */
export function generateGaitSession(patient, seed = 0) {
  const key     = PATIENT_DATASET[patient.id];
  const dataset = STRIDE_DATA[key];

  if (!dataset) {
    // Fallback: use whatever is stored in patient.gait.samples
    return {
      patientId:     patient.id,
      dayPostOp:     patient.dayPost,
      samples:       patient.gait.samples,
      sessionCv:     patient.gait.sessionCv,
      sessionMean:   patient.gait.sessionMean,
      freezingCount: patient.gait.freezingCount ?? 0,
    };
  }

  const maxOffset = dataset.length - WINDOW;
  const offset    = (seed * STEP) % (maxOffset + 1);
  const samples   = dataset.slice(offset, offset + WINDOW);
  const { mean, cv } = windowStats(samples);

  return {
    patientId:     patient.id,
    dayPostOp:     patient.dayPost,
    samples,
    sessionCv:     cv,
    sessionMean:   mean,
    // Freezing count stays at the session level — it doesn't change per window
    freezingCount: patient.gait.freezingCount ?? 0,
  };
}
