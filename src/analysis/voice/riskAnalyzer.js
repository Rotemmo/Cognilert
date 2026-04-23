/**
 * Voice Risk Analyzer
 * 
 * Analyzes voice metrics from check-in responses and returns structured findings.
 * Data is stored separately in patient.risks.voice for later aggregation.
 * 
 * Usage:
 *   import { analyzeVoiceMetrics } from './voice/riskAnalyzer';
 *   const analysis = analyzeVoiceMetrics(voiceMetricsArray);
 *   patient.risks.voice = analysis;
 */

// ─────────────────────────────────────────────
// THRESHOLDS for Voice Metrics
// ─────────────────────────────────────────────
const THRESHOLDS = {
  speechRate: {
    min: 80,      // Words per minute - too slow indicates cognitive decline
    max: 150,     // Too fast might indicate anxiety
  },
  hesitations: {
    pauseCountMax: 5,        // Max acceptable pauses per response
    pauseDurationMax: 2,     // Max acceptable pause duration in seconds
  },
  energy: {
    minDb: -30,   // Minimum voice energy level (-30dB is quite low)
  },
  duration: {
    minSeconds: 5,  // Minimum response duration
  },
};

/**
 * Check voice metrics against thresholds and generate findings
 * @param {Array} voiceMetricsArray - array of {duration, speechRate, hesitations, energy, ...}
 * @returns {Object} {findings, count, severity}
 */
function generateFindings(voiceMetricsArray) {
  const findings = [];
  
  if (!voiceMetricsArray || voiceMetricsArray.length === 0) {
    return { findings, count: 0, severity: 1 };
  }

  // Analyze each response for patterns
  for (let i = 0; i < voiceMetricsArray.length; i++) {
    const m = voiceMetricsArray[i];
    
    // Check speech rate
    if (m.speechRate?.wordsPerMinute < THRESHOLDS.speechRate.min) {
      findings.push({
        type: "slow_speech",
        questionNumber: i + 1,
        value: m.speechRate.wordsPerMinute,
        threshold: THRESHOLDS.speechRate.min,
        severity: 1,
        description: `Q${i + 1}: Speech rate very slow (${m.speechRate.wordsPerMinute} WPM)`
      });
    }
    
    // Check hesitations/pauses
    if (m.hesitations?.pauseCount > THRESHOLDS.hesitations.pauseCountMax) {
      findings.push({
        type: "high_hesitations",
        questionNumber: i + 1,
        value: m.hesitations.pauseCount,
        threshold: THRESHOLDS.hesitations.pauseCountMax,
        severity: 1,
        description: `Q${i + 1}: Excessive pauses detected (${m.hesitations.pauseCount} pauses)`
      });
    }
    
    // Check energy level
    if (m.energy?.decibels < THRESHOLDS.energy.minDb) {
      findings.push({
        type: "low_energy",
        questionNumber: i + 1,
        value: m.energy.decibels,
        threshold: THRESHOLDS.energy.minDb,
        severity: 1,
        description: `Q${i + 1}: Voice energy very low (${m.energy.decibels} dB)`
      });
    }
    
    // Check response duration
    if (m.duration < THRESHOLDS.duration.minSeconds) {
      findings.push({
        type: "short_response",
        questionNumber: i + 1,
        value: m.duration,
        threshold: THRESHOLDS.duration.minSeconds,
        severity: 1,
        description: `Q${i + 1}: Response too brief (${m.duration.toFixed(1)}s)`
      });
    }
  }
  
  // Check for trends across responses (e.g., getting worse)
  if (voiceMetricsArray.length >= 2) {
    const first = voiceMetricsArray[0];
    const last = voiceMetricsArray[voiceMetricsArray.length - 1];
    
    if (first.speechRate?.wordsPerMinute && last.speechRate?.wordsPerMinute) {
      const decline = first.speechRate.wordsPerMinute - last.speechRate.wordsPerMinute;
      if (decline > 20) {
        findings.push({
          type: "trend_deteriorating",
          description: `Speech pace declined across session (${decline.toFixed(0)} WPM drop)`,
          severity: 2
        });
      }
    }
  }
  
  return { 
    findings, 
    count: findings.length,
    severity: Math.min(5, Math.ceil(findings.length / 2)) // Scale: 0 findings=1, 2+=2, 4+=3, etc.
  };
}

/**
 * Map finding count to risk severity (1-5)
 * @param {number} findingCount
 * @returns {number} severity 1-5
 */
function mapFindingsToSeverity(findingCount) {
  if (findingCount === 0) return 1;      // 1 = LOW
  if (findingCount === 1) return 2;      // 2 = MODERATE
  if (findingCount === 2) return 3;      // 3 = MODERATE
  if (findingCount === 3) return 4;      // 4 = HIGH
  return 5;                              // 5 = CRITICAL (4+ findings)
}

/**
 * Map severity score to risk label
 * @param {number} severity
 * @returns {string} "LOW" | "MODERATE" | "HIGH"
 */
function mapSeverityToLabel(severity) {
  if (severity >= 4) return "HIGH";
  if (severity >= 2) return "MODERATE";
  return "LOW";
}

/**
 * Calculate summary statistics from voice metrics
 * @param {Array} voiceMetricsArray
 * @returns {Object} summary stats
 */
function calculateSummaryMetrics(voiceMetricsArray) {
  if (!voiceMetricsArray || voiceMetricsArray.length === 0) {
    return {
      totalDuration: 0,
      avgSpeechRate: 0,
      totalPauses: 0,
      avgEnergy: 0,
      responseCount: 0
    };
  }

  const totalDuration = voiceMetricsArray.reduce((sum, m) => sum + m.duration, 0);
  const avgSpeechRate = voiceMetricsArray.reduce((sum, m) => sum + (m.speechRate?.wordsPerMinute || 0), 0) / voiceMetricsArray.length;
  const totalPauses = voiceMetricsArray.reduce((sum, m) => sum + (m.hesitations?.pauseCount || 0), 0);
  const avgEnergy = voiceMetricsArray.reduce((sum, m) => sum + (m.energy?.decibels || 0), 0) / voiceMetricsArray.length;

  return {
    totalDuration: Math.round(totalDuration * 10) / 10,
    avgSpeechRate: Math.round(avgSpeechRate),
    totalPauses,
    avgEnergy: Math.round(avgEnergy * 10) / 10,
    responseCount: voiceMetricsArray.length
  };
}

/**
 * Main analysis function - analyzes voice metrics and returns structured result
 * 
 * @param {Array} voiceMetricsArray - array of voice metric objects from 4 Q&A responses
 * @returns {Object} analysis result with findings, risk score, and label
 */
export function analyzeVoiceMetrics(voiceMetricsArray) {
  // Generate findings from threshold checks
  const { findings, count } = generateFindings(voiceMetricsArray);
  
  // Map findings to severity score (1-5)
  const riskScore = mapFindingsToSeverity(count);
  
  // Map severity to label
  const riskLabel = mapSeverityToLabel(riskScore);
  
  // Calculate summary statistics
  const metrics = calculateSummaryMetrics(voiceMetricsArray);
  
  return {
    riskScore,           // 1-5
    riskLabel,           // "LOW" | "MODERATE" | "HIGH"
    findings,            // Array of finding objects
    findingCount: count,
    metrics,             // Summary statistics
    timestamp: new Date().toISOString(),
    thresholds: THRESHOLDS
  };
}

/**
 * Legacy function for multi-day analysis (if needed later)
 * @param {Array} dailyAnalysis
 * @returns {Object} aggregated analysis
 */
export function analyzeVoiceHistory(dailyAnalysis) {
  if (!dailyAnalysis || dailyAnalysis.length === 0) {
    return null;
  }

  // For now, just return the most recent
  return dailyAnalysis[dailyAnalysis.length - 1];
}
