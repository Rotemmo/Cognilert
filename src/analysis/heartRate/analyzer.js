/**
 * Heart Rate Analyzer
 *
 * Receives an HRSession (from simulator.js or a real wearable API)
 * and returns a structured analysis: episode detection, HRV metrics,
 * and a deviation score relative to the patient's personal baseline.
 *
 * All thresholds are calibrated for geriatric post-op patients.
 */

// --- Thresholds ---
const THRESHOLDS = {
  tachy: 100,          // bpm above which a reading is considered elevated
  brady: 50,           // bpm below which a reading is considered low
  tachyMinDuration: 5, // consecutive readings (minutes) to declare an episode
  bradyMinDuration: 3,
  baselineDeviationPct: 0.20, // 20% above/below personal baseline triggers alert
  highHRV: 20,         // stdDev bpm — unusually high variability
  lowHRV: 5,           // unusually low (too rigid, autonomic dysfunction)
};

/**
 * Find sustained episodes where bpm crosses a threshold for N+ consecutive minutes.
 *
 * @param {Reading[]} readings
 * @param {function}  testFn      - (bpm) => boolean
 * @param {number}    minDuration - consecutive readings required
 * @param {string}    type
 * @returns {Episode[]}
 */
function findEpisodes(readings, testFn, minDuration, type) {
  const episodes = [];
  let runStart = null;
  let runReadings = [];

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (testFn(r.bpm)) {
      if (runStart === null) {
        runStart = i;
        runReadings = [];
      }
      runReadings.push(r.bpm);
    } else {
      if (runStart !== null && runReadings.length >= minDuration) {
        const avg = runReadings.reduce((a, b) => a + b, 0) / runReadings.length;
        episodes.push({
          type,
          startMinute: runStart,
          endMinute: i - 1,
          durationMinutes: runReadings.length,
          avgBpm: Math.round(avg * 10) / 10,
          peakBpm:
            type === 'tachycardia'
              ? Math.max(...runReadings)
              : Math.min(...runReadings),
          startTimestamp: readings[runStart].timestamp,
          endTimestamp: readings[i - 1].timestamp,
        });
      }
      runStart = null;
      runReadings = [];
    }
  }

  // Flush open run at end of day
  if (runStart !== null && runReadings.length >= minDuration) {
    const avg = runReadings.reduce((a, b) => a + b, 0) / runReadings.length;
    episodes.push({
      type,
      startMinute: runStart,
      endMinute: readings.length - 1,
      durationMinutes: runReadings.length,
      avgBpm: Math.round(avg * 10) / 10,
      peakBpm:
        type === 'tachycardia'
          ? Math.max(...runReadings)
          : Math.min(...runReadings),
      startTimestamp: readings[runStart].timestamp,
      endTimestamp: readings[readings.length - 1].timestamp,
    });
  }

  return episodes;
}

/**
 * Compute average HR by context group.
 */
function avgByContext(readings, context) {
  const subset = readings.filter((r) => r.context === context);
  if (subset.length === 0) return null;
  return subset.reduce((sum, r) => sum + r.bpm, 0) / subset.length;
}

/**
 * Compute RMSSD-style HRV approximation from consecutive bpm differences.
 * True HRV requires RR intervals; we approximate using minute-to-minute deltas.
 */
function computeHRV(readings) {
  if (readings.length < 2) return null;
  const squaredDiffs = [];
  for (let i = 1; i < readings.length; i++) {
    squaredDiffs.push((readings[i].bpm - readings[i - 1].bpm) ** 2);
  }
  const rmssd = Math.sqrt(
    squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length
  );
  return Math.round(rmssd * 10) / 10;
}

/**
 * Determine if the patient's average resting HR has deviated significantly
 * from their personal pre-op baseline.
 */
function baselineDeviation(avgResting, baselineResting) {
  if (!baselineResting || baselineResting === 0) return null;
  return (avgResting - baselineResting) / baselineResting;
}

/**
 * Main analysis function.
 *
 * @param {HRSession} session - output of generateHRSession()
 * @returns {AnalysisResult}
 */
export function analyzeHRSession(session) {
  const { readings, baseline, summary, patientId, date, dayPostOp } = session;

  const tachycardiaEpisodes = findEpisodes(
    readings,
    (bpm) => bpm >= THRESHOLDS.tachy,
    THRESHOLDS.tachyMinDuration,
    'tachycardia'
  );

  const bradycardiaEpisodes = findEpisodes(
    readings,
    (bpm) => bpm <= THRESHOLDS.brady,
    THRESHOLDS.bradyMinDuration,
    'bradycardia'
  );

  const avgResting = avgByContext(readings, 'rest');
  const avgActivity = avgByContext(readings, 'activity');
  const avgSleep = avgByContext(readings, 'sleep');

  const hrv = computeHRV(readings);
  const deviation = baselineDeviation(avgResting, baseline.resting);

  const findings = [];
  if (tachycardiaEpisodes.length > 0) findings.push('tachycardia');
  if (bradycardiaEpisodes.length > 0) findings.push('bradycardia');
  if (deviation !== null && Math.abs(deviation) >= THRESHOLDS.baselineDeviationPct)
    findings.push('baseline_deviation');
  if (hrv !== null && hrv > THRESHOLDS.highHRV) findings.push('high_hrv');
  if (hrv !== null && hrv < THRESHOLDS.lowHRV) findings.push('low_hrv');

  return {
    patientId,
    date,
    dayPostOp,
    summary,
    contextAverages: {
      rest: avgResting ? Math.round(avgResting * 10) / 10 : null,
      activity: avgActivity ? Math.round(avgActivity * 10) / 10 : null,
      sleep: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
    },
    hrv,
    baselineDeviationPct: deviation !== null ? Math.round(deviation * 1000) / 10 : null,
    episodes: [...tachycardiaEpisodes, ...bradycardiaEpisodes].sort(
      (a, b) => a.startMinute - b.startMinute
    ),
    findings,
    clean: findings.length === 0,
  };
}

/**
 * Analyze a multi-day history and return per-day results.
 *
 * @param {HRSession[]} sessions
 * @returns {AnalysisResult[]}
 */
export function analyzeHRHistory(sessions) {
  return sessions.map(analyzeHRSession);
}
