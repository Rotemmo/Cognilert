/**
 * Gait Analyzer
 *
 * Receives a GaitSession (from index.js) and returns a structured analysis:
 * stride statistics, episode detection, trend analysis, findings, and a
 * 1-5 risk score consistent with the rest of CogniLert's scoring system.
 *
 * Input: session.sessionCv / session.sessionMean are authoritative metrics
 * from the full walk session (as a real wearable would report). session.samples
 * is a recent stride window used for episode detection and visualization.
 *
 * All thresholds are calibrated for geriatric post-surgical patients.
 */

// --- Thresholds ---
const THRESHOLDS = {
  cv: {
    good:     2.0,  // < 2%  : excellent consistency             (base score 1)
    mild:     3.5,  // 2–3.5%: mild post-surgical variation      (base score 2)
    moderate: 6.0,  // 3.5–6%: clinical concern                 (base score 3)
    elevated: 9.0,  // 6–9%  : significant dysrhythmia          (base score 4)
                    // >= 9% : severe / critical                (base score 5)
  },
  freezing: {
    sigmas: 2.8,    // stride > mean + 2.8 SD = probable freezing event in window
  },
  trend: {
    worseningFactor: 1.6, // second-half CV > 1.6x first-half CV = deteriorating
  },
};

// --- Statistics ---

function computeSampleStats(samples) {
  const n = samples.length;
  const mean = samples.reduce((s, v) => s + v, 0) / n;
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;
  return {
    n,
    mean:   Math.round(mean   * 1000) / 1000,
    stdDev: Math.round(stdDev * 1000) / 1000,
    cv:     Math.round(cv     * 10)   / 10,
    min:    Math.round(Math.min(...samples) * 1000) / 1000,
    max:    Math.round(Math.max(...samples) * 1000) / 1000,
  };
}

function computeConsistencyScore(cv) {
  // Linear scale: 100 - cv * 8.2, floored at 2.
  // Empirically validated against Hausdorff et al. dataset samples.
  return Math.max(2, Math.min(100, Math.round(100 - cv * 8.2)));
}

// --- Episode detection (sample window) ---

function detectWindowFreezingEpisodes(samples, mean, stdDev) {
  const threshold = mean + THRESHOLDS.freezing.sigmas * stdDev;
  return samples
    .map((v, i) => ({ stride: i + 1, interval: v, excessMs: Math.round((v - mean) * 1000) }))
    .filter((s) => s.interval > threshold);
}

// --- Trend analysis (sample window) ---

function detectTrend(samples) {
  const half = Math.floor(samples.length / 2);
  const cvOf = (arr) => {
    const m = arr.reduce((s, v) => s + v, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    return (sd / m) * 100;
  };
  const cvFirst  = cvOf(samples.slice(0, half));
  const cvSecond = cvOf(samples.slice(half));
  return {
    cvFirst:   Math.round(cvFirst  * 10) / 10,
    cvSecond:  Math.round(cvSecond * 10) / 10,
    worsening: cvSecond > cvFirst * THRESHOLDS.trend.worseningFactor,
  };
}

// --- Findings ---

function generateFindings(sessionCv, freezingCount, windowFreezingEpisodes, trend) {
  const findings = [];

  // Primary variability finding — based on authoritative session CV
  if (sessionCv >= THRESHOLDS.cv.elevated) {
    findings.push({
      type:        'critical_variability',
      description: `Severe stride variability (CV ${sessionCv}%) — significant dysrhythmia`,
      severity:    4,
    });
  } else if (sessionCv >= THRESHOLDS.cv.moderate) {
    findings.push({
      type:        'elevated_variability',
      description: `Elevated stride variability (CV ${sessionCv}%) — disrupted motor rhythm`,
      severity:    3,
    });
  } else if (sessionCv >= THRESHOLDS.cv.mild) {
    findings.push({
      type:        'moderate_variability',
      description: `Moderate stride variability (CV ${sessionCv}%) — monitor post-surgical recovery`,
      severity:    2,
    });
  } else if (sessionCv >= THRESHOLDS.cv.good) {
    findings.push({
      type:        'mild_variability',
      description: `Mild stride variability (CV ${sessionCv}%) — within acceptable post-op range`,
      severity:    1,
    });
  }

  // Freezing episodes — session count from wearable (authoritative)
  if (freezingCount > 0) {
    findings.push({
      type:        'freezing_episode',
      description: `${freezingCount} freezing-of-gait episode${freezingCount > 1 ? 's' : ''} detected during session`,
      severity:    4,
    });
  }

  // Additional freezing in the sample window not already captured above
  const windowFreezeCount = windowFreezingEpisodes.length;
  if (windowFreezeCount > 0 && freezingCount === 0) {
    findings.push({
      type:        'freezing_episode',
      description: `${windowFreezeCount} probable freezing event${windowFreezeCount > 1 ? 's' : ''} detected in stride window (stride${windowFreezeCount > 1 ? 's' : ''} ${windowFreezingEpisodes.map((e) => e.stride).join(', ')})`,
      severity:    3,
    });
  }

  // Intra-session trend deterioration (sample window)
  if (trend.worsening) {
    findings.push({
      type:        'trend_deterioration',
      description: `Gait rhythm worsened during session — first-half CV ${trend.cvFirst}%, second-half CV ${trend.cvSecond}%`,
      severity:    2,
    });
  }

  return findings;
}

// --- Scoring ---

function cvToBaseScore(cv) {
  if (cv >= THRESHOLDS.cv.elevated) return 5;
  if (cv >= THRESHOLDS.cv.moderate) return 4;
  if (cv >= THRESHOLDS.cv.mild)     return 3;
  if (cv >= THRESHOLDS.cv.good)     return 2;
  return 1;
}

function mapFindingsToRiskScore(baseScore, findings) {
  // Additional non-variability findings (freezing, trend) push the score up by 1
  const extras = findings.filter(
    (f) => f.type !== 'critical_variability' &&
           f.type !== 'elevated_variability' &&
           f.type !== 'moderate_variability' &&
           f.type !== 'mild_variability'
  );
  return extras.length > 0 ? Math.min(5, baseScore + 1) : baseScore;
}

function riskLabel(score) {
  if (score >= 5) return 'CRITICAL';
  if (score >= 4) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  if (score >= 2) return 'GOOD';
  return 'EXCELLENT';
}

function buildInterpretation(sessionCv, findings) {
  const hasFreezing = findings.some((f) => f.type === 'freezing_episode');
  if (hasFreezing)                           return 'Gait dysrhythmia with freezing episode detected';
  if (sessionCv >= THRESHOLDS.cv.elevated)   return 'Severe gait dysrhythmia detected';
  if (sessionCv >= THRESHOLDS.cv.moderate)   return 'Elevated stride variability - irregular motor rhythm';
  if (sessionCv >= THRESHOLDS.cv.mild)       return 'Normal post-surgical stride variability - within safe range';
  return 'Highly regular stride pattern - no cognitive motor signature';
}

// --- Main export ---

/**
 * Analyze a single gait session.
 *
 * @param {GaitSession} session
 * @returns {GaitAnalysisResult}
 */
export function analyzeGaitSession(session) {
  const { samples, sessionCv, sessionMean, freezingCount, patientId, dayPostOp } = session;

  const sampleStats            = computeSampleStats(samples);
  const windowFreezingEpisodes = detectWindowFreezingEpisodes(samples, sampleStats.mean, sampleStats.stdDev);
  const trend                  = detectTrend(samples);
  const findings               = generateFindings(sessionCv, freezingCount, windowFreezingEpisodes, trend);
  const baseScore              = cvToBaseScore(sessionCv);
  const riskScore              = mapFindingsToRiskScore(baseScore, findings);
  const consistencyScore       = computeConsistencyScore(sessionCv);
  const label                  = riskLabel(riskScore);
  const interpretation         = buildInterpretation(sessionCv, findings);

  const primaryFreeze = findings.find((f) => f.type === 'freezing_episode') ?? null;
  const event = primaryFreeze ? primaryFreeze.description : null;

  return {
    patientId,
    dayPostOp,

    // Fields consumed by GaitVisualizer (same interface as the old static object)
    samples,
    mean:             sessionMean,
    cv:               sessionCv,
    consistencyScore,
    riskScore,
    riskLabel:        label,
    interpretation,
    event,

    // Full analysis detail
    sampleStats,
    findings,
    findingCount:     findings.length,
    windowFreezingEpisodes,
    trend,
    clean:            findings.length === 0,
    timestamp:        new Date().toISOString(),
  };
}
