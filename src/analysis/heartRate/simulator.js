/**
 * Heart Rate Simulator
 *
 * Generates synthetic post-operative HR data per patient.
 * Each patient has a personal baseline and a recovery trajectory
 * determined by their risk profile. High-risk patients show slower
 * normalization and more anomaly injections.
 *
 * Data resolution: one reading per minute (1440 readings/day).
 * Context phases: sleep (22:00–06:00), activity (07:00–09:00, 17:00–19:00),
 * rest (all other times).
 */

// Seeded pseudo-random for reproducible per-patient data
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Normal distribution via Box-Muller
function randomNormal(rng, mean, std) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Baseline HR profile per risk level.
 * Resting baseline reflects pre-surgery steady state.
 * High-risk patients start with elevated post-op HR and recover slowly.
 */
const RISK_PROFILES = {
  HIGH: {
    baselineResting: 78,
    baselineActivity: 105,
    baselineSleep: 62,
    postOpMultiplier: 1.22, // initial elevation above baseline
    recoveryRate: 0.04,     // fractional return to baseline per day
    noiseStd: 6,
    anomalyChance: 0.18,    // chance of injecting an anomaly episode per day
  },
  MODERATE: {
    baselineResting: 72,
    baselineActivity: 98,
    baselineSleep: 58,
    postOpMultiplier: 1.12,
    recoveryRate: 0.10,
    noiseStd: 4,
    anomalyChance: 0.07,
  },
  LOW: {
    baselineResting: 68,
    baselineActivity: 94,
    baselineSleep: 55,
    postOpMultiplier: 1.05,
    recoveryRate: 0.18,
    noiseStd: 3,
    anomalyChance: 0.02,
  },
};

/**
 * Determine HR context for a given minute-of-day (0–1439).
 */
function getContext(minuteOfDay) {
  const hour = Math.floor(minuteOfDay / 60);
  if (hour >= 22 || hour < 6) return 'sleep';
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 'activity';
  return 'rest';
}

/**
 * Compute the expected (noiseless) HR for a given minute, day post-op,
 * and patient profile.
 */
function expectedHR(minuteOfDay, dayPostOp, profile) {
  const context = getContext(minuteOfDay);
  const baselineMap = {
    rest: profile.baselineResting,
    activity: profile.baselineActivity,
    sleep: profile.baselineSleep,
  };
  const baseline = baselineMap[context];

  // Recovery: multiplier decays toward 1.0 over days
  const recoveryFactor = Math.max(
    1.0,
    profile.postOpMultiplier - profile.recoveryRate * dayPostOp
  );

  return baseline * recoveryFactor;
}

/**
 * Inject a tachycardia episode (sustained elevated HR) starting at a random
 * minute. Episodes last 15–45 minutes.
 */
function injectTachycardiaEpisode(readings, rng) {
  const start = Math.floor(rng() * 1300) + 60; // avoid edges
  const duration = Math.floor(rng() * 30) + 15;
  const peakBpm = 105 + Math.floor(rng() * 25); // 105–130
  for (let i = start; i < Math.min(start + duration, readings.length); i++) {
    readings[i].bpm = Math.round(Math.max(readings[i].bpm, peakBpm - rng() * 5));
    readings[i].anomaly = 'tachycardia';
  }
}

/**
 * Inject a bradycardia episode.
 */
function injectBradycardiaEpisode(readings, rng) {
  const start = Math.floor(rng() * 1300) + 60;
  const duration = Math.floor(rng() * 20) + 8;
  const lowBpm = 42 + Math.floor(rng() * 8); // 42–50
  for (let i = start; i < Math.min(start + duration, readings.length); i++) {
    readings[i].bpm = Math.round(Math.min(readings[i].bpm, lowBpm + rng() * 3));
    readings[i].anomaly = 'bradycardia';
  }
}

/**
 * Generate a full day of HR readings for one patient.
 *
 * @param {object} patient  - must have: id, riskLevel, age
 * @param {number} dayPostOp - 0 = surgery day, 1 = first day after, etc.
 * @param {Date}   date
 * @returns {{ patientId, date, dayPostOp, baseline, readings, summary }}
 */
export function generateHRSession(patient, dayPostOp, date = new Date()) {
  const profile = RISK_PROFILES[patient.riskLevel] ?? RISK_PROFILES.MODERATE;

  // Unique seed per patient+day so results are reproducible
  const seed = patient.id * 10000 + dayPostOp * 31 + patient.age;
  const rng = seededRandom(seed);

  const readings = [];
  for (let minute = 0; minute < 1440; minute++) {
    const context = getContext(minute);
    const base = expectedHR(minute, dayPostOp, profile);
    const bpm = Math.round(
      Math.max(35, Math.min(180, randomNormal(rng, base, profile.noiseStd)))
    );
    const timestamp = new Date(date);
    timestamp.setHours(0, minute, 0, 0);

    readings.push({ timestamp, minute, bpm, context, anomaly: null });
  }

  // Randomly inject anomaly episodes based on risk profile
  if (rng() < profile.anomalyChance) {
    const type = rng() < 0.7 ? 'tachycardia' : 'bradycardia';
    if (type === 'tachycardia') injectTachycardiaEpisode(readings, rng);
    else injectBradycardiaEpisode(readings, rng);
  }

  const bpms = readings.map((r) => r.bpm);
  const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length;
  const stdDev = Math.sqrt(
    bpms.reduce((sum, b) => sum + (b - avg) ** 2, 0) / bpms.length
  );

  return {
    patientId: patient.id,
    date,
    dayPostOp,
    baseline: {
      resting: profile.baselineResting,
      activity: profile.baselineActivity,
      sleep: profile.baselineSleep,
    },
    readings,
    summary: {
      min: Math.min(...bpms),
      max: Math.max(...bpms),
      avg: Math.round(avg * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
    },
  };
}

/**
 * Generate multi-day HR history for a patient.
 *
 * @param {object} patient
 * @param {number} days - how many days post-op to generate (default 7)
 * @returns {HRSession[]}
 */
export function generateHRHistory(patient, days = 7) {
  const sessions = [];
  const today = new Date();
  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - d));
    sessions.push(generateHRSession(patient, d, date));
  }
  return sessions;
}
