/**
 * Voice Risk Analyzer
 * Analyzes session-level voice metrics (averages across all responses).
 * Checks each signal type once — not once per question — to avoid inflation.
 */

const THRESHOLDS = {
  speechRate:   { minWpm: 60   },  // <60 WPM is abnormally slow
  hesitations:  { maxAvgPauses: 8 }, // >8 pauses per response on average
  energy:       { minDb: -45   },  // <-45 dB is very quiet / mumbling
  duration:     { minAvgSec: 2.5 }, // <2.5s average response is too brief
  trendDrop:    { wpmDrop: 30  },  // >30 WPM decline from Q1 to Q4
};

function generateFindings(voiceMetricsArray) {
  const findings = [];
  if (!voiceMetricsArray?.length) return { findings, count: 0 };

  const n = voiceMetricsArray.length;

  // Session-level averages
  const avgWpm      = voiceMetricsArray.reduce((s, m) => s + (m.speechRate?.wordsPerMinute || 0), 0) / n;
  const avgPauses   = voiceMetricsArray.reduce((s, m) => s + (m.hesitations?.pauseCount    || 0), 0) / n;
  const avgEnergy   = voiceMetricsArray.reduce((s, m) => s + (m.energy?.decibels           || 0), 0) / n;
  const avgDuration = voiceMetricsArray.reduce((s, m) => s + (m.duration                   || 0), 0) / n;

  if (avgWpm > 0 && avgWpm < THRESHOLDS.speechRate.minWpm) {
    findings.push({
      type: "slow_speech",
      description: `Very slow speech — avg ${Math.round(avgWpm)} WPM (normal: 100–160)`,
      severity: 1,
    });
  }

  if (avgPauses > THRESHOLDS.hesitations.maxAvgPauses) {
    findings.push({
      type: "high_hesitations",
      description: `Frequent hesitations — avg ${avgPauses.toFixed(1)} pauses/response`,
      severity: 1,
    });
  }

  if (avgEnergy < THRESHOLDS.energy.minDb) {
    findings.push({
      type: "low_energy",
      description: `Voice energy very low — avg ${avgEnergy.toFixed(1)} dB`,
      severity: 1,
    });
  }

  if (avgDuration < THRESHOLDS.duration.minAvgSec) {
    findings.push({
      type: "short_response",
      description: `Responses very brief — avg ${avgDuration.toFixed(1)}s`,
      severity: 1,
    });
  }

  // Trend: speech rate declining over the session
  if (n >= 2) {
    const firstWpm = voiceMetricsArray[0].speechRate?.wordsPerMinute || 0;
    const lastWpm  = voiceMetricsArray[n - 1].speechRate?.wordsPerMinute || 0;
    const drop = firstWpm - lastWpm;
    if (firstWpm > 0 && drop > THRESHOLDS.trendDrop.wpmDrop) {
      findings.push({
        type: "trend_deteriorating",
        description: `Speech pace declined during session (−${Math.round(drop)} WPM from Q1 to Q${n})`,
        severity: 2,
      });
    }
  }

  return { findings, count: findings.length };
}

function mapFindingsToRiskScore(count) {
  if (count === 0) return 1;
  if (count === 1) return 2;
  if (count === 2) return 3;
  if (count === 3) return 4;
  return 5;
}

function riskLabel(score) {
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MODERATE";
  return "LOW";
}

function calculateSummaryMetrics(voiceMetricsArray) {
  if (!voiceMetricsArray?.length) {
    return { totalDuration: 0, avgSpeechRate: 0, totalPauses: 0, avgEnergy: 0, responseCount: 0 };
  }
  const n = voiceMetricsArray.length;
  return {
    totalDuration:  Math.round(voiceMetricsArray.reduce((s, m) => s + m.duration, 0) * 10) / 10,
    avgSpeechRate:  Math.round(voiceMetricsArray.reduce((s, m) => s + (m.speechRate?.wordsPerMinute || 0), 0) / n),
    totalPauses:    voiceMetricsArray.reduce((s, m) => s + (m.hesitations?.pauseCount || 0), 0),
    avgEnergy:      Math.round(voiceMetricsArray.reduce((s, m) => s + (m.energy?.decibels || 0), 0) / n * 10) / 10,
    responseCount:  n,
  };
}

export function analyzeVoiceMetrics(voiceMetricsArray) {
  const { findings, count } = generateFindings(voiceMetricsArray);
  const riskScore = mapFindingsToRiskScore(count);

  return {
    riskScore,
    riskLabel:    riskLabel(riskScore),
    findings,
    findingCount: count,
    metrics:      calculateSummaryMetrics(voiceMetricsArray),
    timestamp:    new Date().toISOString(),
    thresholds:   THRESHOLDS,
  };
}

export function analyzeVoiceHistory(dailyAnalysis) {
  if (!dailyAnalysis?.length) return null;
  return dailyAnalysis[dailyAnalysis.length - 1];
}
