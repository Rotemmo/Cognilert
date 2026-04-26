import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { runHRAnalysis }   from "./src/analysis/heartRate/index.js";
import { runGaitAnalysis } from "./src/analysis/gait/index.js";
import { VoiceCheckIn } from "./src/components/VoiceCheckIn";
import { analyzeVoiceMetrics } from "./src/analysis/voice/riskAnalyzer.js";
import { saveVoiceAnalysis } from "./data/voiceStorage.js";
import {
  AlertTriangle, CheckCircle, Heart, Activity, Brain, Mic,
  User, Bell, Battery, Wifi, Stethoscope, Home
} from "lucide-react";

// ─────────────────────────────────────────────
// PATIENT DATA
// Risk score: 1 = good condition, 5 = immediate critical
// Gait samples: real stride-interval data (seconds) from
// Hausdorff et al. "Gait in Aging and Disease" database
// ─────────────────────────────────────────────
const PATIENTS = [
  {
    id: 1,
    name: "Ruth Cohen",
    age: 72,
    surgery: "Hip Replacement",
    dayPost: 5,
    riskScore: 5,
    riskLevel: "HIGH",
    alert: true,
    alertMessage: "Speech incoherence detected - possible early delirium",
    risks: { voice: null, heartRate: null },
    gait: {
      // Source: pd3-si.txt - Parkinson's subject (66F), Hausdorff et al.
      samples: [1.373,1.383,1.283,1.407,1.310,1.373,1.330,1.273,1.310,1.180,
                1.203,1.290,1.290,1.293,1.293,1.177,1.390,1.343,1.333,1.427,
                1.410,1.123,1.343,1.383,1.383,1.273,1.377,1.387,1.397,1.247],
      sessionCv: 9.7, sessionMean: 1.295, freezingCount: 1,
    },
    metrics: { hrv: 18, speechScore: 31 },
    trend: [
      { day: "D1", hrv: 35, jerk: 42, speech: 72, risk: 2 },
      { day: "D2", hrv: 30, jerk: 50, speech: 65, risk: 3 },
      { day: "D3", hrv: 26, jerk: 58, speech: 58, risk: 3 },
      { day: "D4", hrv: 22, jerk: 68, speech: 44, risk: 4 },
      { day: "D5", hrv: 18, jerk: 78, speech: 31, risk: 5 },
    ],
    aiLog: [
      { role: "AI",      text: "Good morning Ruth! How are you feeling today?" },
      { role: "Patient", text: "I'm... the window, yes. Yesterday was... something with the light." },
      { role: "AI",      text: "Can you tell me if you took your morning medication?" },
      { role: "Patient", text: "The pills, the blue ones, I think my daughter… no, wait." },
      { role: "AI",      text: "⚠️ Incoherence pattern detected. Alerting care team now." },
    ],
    medications: ["Metoprolol 25mg", "Aspirin 75mg", "Enoxaparin 40mg"],
    alerts: [
      { time: "08:23", msg: "Speech coherence score: 31/100 - threshold breached", sev: "HIGH" },
      { time: "06:15", msg: "HRV critically low: 18ms (personal baseline: 38ms)", sev: "HIGH" },
      { time: "Yest. 22:41", msg: "Gait dysrhythmia - freezing episode detected", sev: "MED" },
    ],
  },
  {
    id: 2,
    name: "David Levy",
    age: 68,
    surgery: "Cardiac Bypass (CABG)",
    dayPost: 8,
    riskScore: 3,
    riskLevel: "MODERATE",
    alert: false,
    alertMessage: null,
    risks: { voice: null, heartRate: null },
    gait: {
      // Source: pd1-si.txt - Parkinson's subject (64M), moderately irregular
      samples: [1.350,1.360,1.377,1.540,1.407,1.323,1.267,1.280,1.250,1.207,
                1.300,1.257,1.277,1.310,1.227,1.293,1.267,1.277,1.267,1.263,
                1.180,1.183,1.240,1.227,1.220,1.293,1.230,1.237,1.317,1.223],
      sessionCv: 5.6, sessionMean: 1.259, freezingCount: 0,
    },
    metrics: { hrv: 28, speechScore: 65 },
    trend: [
      { day: "D1", hrv: 22, jerk: 68, speech: 52, risk: 4 },
      { day: "D3", hrv: 24, jerk: 64, speech: 57, risk: 4 },
      { day: "D5", hrv: 26, jerk: 57, speech: 63, risk: 3 },
      { day: "D7", hrv: 27, jerk: 54, speech: 64, risk: 3 },
      { day: "D8", hrv: 28, jerk: 52, speech: 65, risk: 3 },
    ],
    aiLog: [
      { role: "AI",      text: "Good morning David! Ready for our daily check-in?" },
      { role: "Patient", text: "Yes, good morning. I feel a bit tired but okay." },
      { role: "AI",      text: "Did you take your blood pressure medication this morning?" },
      { role: "Patient", text: "Yes, with breakfast. My wife reminded me." },
    ],
    medications: ["Atorvastatin 40mg", "Bisoprolol 5mg", "Warfarin 3mg"],
    alerts: [
      { time: "Yest. 14:30", msg: "Stride variability above threshold - monitoring closely", sev: "LOW" },
    ],
  },
  {
    id: 3,
    name: "Sara Mizrahi",
    age: 75,
    surgery: "Abdominal (Colectomy)",
    dayPost: 12,
    riskScore: 1,
    riskLevel: "LOW",
    alert: false,
    alertMessage: null,
    risks: { voice: null, heartRate: null },
    gait: {
      // Source: o1-76-si.txt - Healthy elderly subject (76F), highly consistent
      samples: [1.023,1.030,1.017,1.027,1.043,1.027,1.007,1.047,1.033,1.043,
                1.017,1.023,1.027,1.037,1.003,1.007,1.037,1.020,1.007,1.067,
                1.023,1.023,1.017,1.023,1.030,1.017,1.020,1.010,1.017,1.023],
      sessionCv: 1.75, sessionMean: 1.027, freezingCount: 0,
    },
    metrics: { hrv: 44, speechScore: 88 },
    trend: [
      { day: "D1",  hrv: 28, jerk: 62, speech: 58, risk: 4 },
      { day: "D3",  hrv: 32, jerk: 55, speech: 65, risk: 3 },
      { day: "D5",  hrv: 36, jerk: 48, speech: 72, risk: 3 },
      { day: "D7",  hrv: 39, jerk: 39, speech: 78, risk: 2 },
      { day: "D9",  hrv: 42, jerk: 33, speech: 84, risk: 2 },
      { day: "D11", hrv: 43, jerk: 30, speech: 86, risk: 2 },
      { day: "D12", hrv: 44, jerk: 28, speech: 88, risk: 1 },
    ],
    aiLog: [
      { role: "AI",      text: "Good morning Sara! How are you doing today?" },
      { role: "Patient", text: "Much better than yesterday, thank you. The pain is less." },
      { role: "AI",      text: "Wonderful! Did you do your morning walk as planned?" },
      { role: "Patient", text: "Yes, 10 minutes in the garden. My daughter came with me." },
    ],
    medications: ["Pantoprazole 40mg", "Enoxaparin 40mg", "Paracetamol 500mg (PRN)"],
    alerts: [],
  },
  {
    id: 4,
    name: "Moshe Ben-David",
    age: 70,
    surgery: "Knee Replacement",
    dayPost: 3,
    riskScore: 2,
    riskLevel: "MODERATE",
    alert: false,
    alertMessage: null,
    risks: { voice: null, heartRate: null },
    gait: {
      // Source: o3-75-si.txt - Healthy elderly subject (75M), minor variation
      samples: [0.980,0.997,0.967,0.973,0.983,0.983,0.990,0.973,0.993,1.017,
                1.013,1.050,1.050,1.060,1.080,1.047,0.993,1.023,1.047,1.053,
                1.073,1.000,0.993,1.003,1.000,0.977,0.980,0.987,0.997,0.957],
      sessionCv: 2.6, sessionMean: 1.000, freezingCount: 0,
    },
    metrics: { hrv: 31, speechScore: 74 },
    trend: [
      { day: "D1", hrv: 30, jerk: 58, speech: 70, risk: 3 },
      { day: "D2", hrv: 31, jerk: 56, speech: 72, risk: 3 },
      { day: "D3", hrv: 31, jerk: 55, speech: 74, risk: 2 },
    ],
    aiLog: [
      { role: "AI",      text: "Good morning Moshe! Day 3 after your knee surgery. How are you?" },
      { role: "Patient", text: "The knee is swollen but I managed to walk to the bathroom myself." },
      { role: "AI",      text: "Great progress! Any confusion or dizziness today?" },
      { role: "Patient", text: "No, I feel mentally sharp. Just the physical pain bothers me." },
    ],
    medications: ["Celecoxib 200mg", "Tramadol 50mg (PRN)", "Aspirin 100mg"],
    alerts: [
      { time: "D1 10:00", msg: "Baseline calibration complete - cognitive profile established", sev: "INFO" },
    ],
  },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const riskColors = {
  HIGH:     { badge: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  MODERATE: { badge: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  LOW:      { badge: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
};

const scoreColor = (s) => s >= 4 ? "text-red-600" : s >= 3 ? "text-yellow-600" : "text-green-600";

function computeHRRisk(hrData) {
  if (!hrData?.alerts) return 2;
  const high = hrData.alerts.filter(a => a.severity >= 4).length;
  const med  = hrData.alerts.filter(a => a.severity === 3).length;
  if (high >= 2) return 5;
  if (high >= 1) return 4;
  if (med  >= 2) return 3;
  if (med  >= 1) return 2;
  return 1;
}

function generateVoiceAlerts(voiceAnalysis, patientName) {
  if (!voiceAnalysis?.findings?.length) return [];
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  
  return voiceAnalysis.findings.map(finding => ({
    time: timeStr,
    msg: `Voice: ${finding.description}`,
    sev: finding.severity >= 2 ? "HIGH" : finding.severity === 1 ? "MED" : "LOW"
  }));
}

function computeCompositeScore(gaitRisk, voiceRisk, hrRisk) {
  if (voiceRisk !== null) {
    return Math.min(5, Math.max(1, gaitRisk * 0.40 + voiceRisk * 0.35 + hrRisk * 0.25));
  }
  return Math.min(5, Math.max(1, gaitRisk * 0.60 + hrRisk * 0.40));
}

function compositeLabel(s) {
  if (s >= 4.5) return "CRITICAL";
  if (s >= 3.5) return "HIGH";
  if (s >= 2.5) return "MODERATE";
  if (s >= 1.5) return "LOW";
  return "EXCELLENT";
}

const SCORE_STYLES = {
  5: { bg: "bg-red-50",    border: "border-red-300",    text: "text-red-600",    badge: "bg-red-100 text-red-700"    },
  4: { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-600",    badge: "bg-red-100 text-red-700"    },
  3: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
  2: { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-600",  badge: "bg-green-100 text-green-700"  },
  1: { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-600",  badge: "bg-green-100 text-green-700"  },
};

// ─────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────
function InfoTooltip({ text, children }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      {children}
      <span className="pointer-events-none invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150
                       absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                       w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl leading-relaxed whitespace-normal">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
// GAIT VISUALIZER
// ─────────────────────────────────────────────
function GaitVisualizer({ gaitProfile }) {
  const { samples, mean, cv, consistencyScore, riskLabel, interpretation, event } = gaitProfile;

  // --- Animation state ---
  const [visibleCount, setVisibleCount] = useState(0);
  const svgContainerRef = useRef(null);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;

    // Scale actual stride intervals so total animation is ~5 seconds
    const totalRealMs = samples.reduce((s, v) => s + v, 0) * 1000;
    const scale = 5000 / totalRealMs;
    const handles = [];

    const kick = () => {
      setVisibleCount(0);
      let cum = 120; // brief pause so the cleared state renders first
      samples.forEach((interval, i) => {
        handles.push(setTimeout(() => setVisibleCount(i + 1), cum));
        cum += Math.round(interval * 1000 * scale);
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { kick(); observer.disconnect(); } },
      { threshold: 0.25 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      handles.forEach(clearTimeout);
    };
  }, []); // empty deps — parent passes key={seed} so this remounts on each refresh

  // --- Geometry ---
  const exaggerated = samples.map(v => 1 + ((v - mean) / mean) * 3);
  const totalEff = exaggerated.reduce((s, v) => s + v, 0);

  const SVG_W = 580;
  let cumEff = 0;
  const footprints = samples.map((interval, i) => {
    cumEff += exaggerated[i];
    const x = 10 + (cumEff / totalEff) * SVG_W;
    const isLeft = i % 2 === 0;
    const y = isLeft ? 26 : 62;
    const dev = Math.abs(interval - mean) / mean * 100;
    const color = dev < 2 ? "#22c55e" : dev < 5 ? "#f59e0b" : "#ef4444";
    return { x, y, isLeft, color };
  });

  const chartData = samples.map((v, i) => ({ step: i + 1, interval: +v.toFixed(4) }));
  const scoreCol = consistencyScore >= 75 ? "text-green-600" : consistencyScore >= 50 ? "text-yellow-600" : "text-red-600";
  const scoreBg  = consistencyScore >= 75 ? "bg-green-50 border-green-200" : consistencyScore >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-3">
      {/* Score header */}
      <div className={`rounded-xl border p-4 flex items-center justify-between ${scoreBg}`}>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <InfoTooltip text="How rhythmic is the patient's walking? 100 = perfectly regular steps. Lower scores mean uneven timing, which can signal the brain is losing motor control - often before any visible symptoms appear.">
              Gait Consistency Score
            </InfoTooltip>
          </p>
          <p className="text-sm text-gray-600 mt-0.5">{interpretation}</p>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            <InfoTooltip text="How much each step's timing differs from the last. Under 3% is healthy. Above 6% signals disrupted motor rhythm - a known early marker of post-surgical cognitive decline.">
              Stride variability: {cv}%
            </InfoTooltip>
            {" · "}Avg stride: {mean.toFixed(2)}s
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className={`text-5xl font-black leading-none ${scoreCol}`}>{consistencyScore}</p>
          <p className="text-xs text-gray-400">/100</p>
          <span className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${SCORE_STYLES[gaitProfile.riskScore]?.badge}`}>
            {riskLabel}
          </span>
        </div>
      </div>

      {/* Footprint trail */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          <InfoTooltip text="Each footprint = one real step. The gap between prints shows how long that step took. Even gaps = healthy rhythm. Uneven gaps = the brain struggling to keep a steady pace.">
            Stride Pattern - {samples.length} consecutive steps
          </InfoTooltip>
          <span className="text-gray-400 font-normal ml-2">(spacing proportional to stride interval)</span>
        </p>
        <svg ref={svgContainerRef} width="100%" height="92" viewBox="0 0 600 92" preserveAspectRatio="xMidYMid meet">
          <line x1="0" y1="44" x2="600" y2="44" stroke="#e5e7eb" strokeWidth="1" />
          {footprints.slice(0, visibleCount).map((fp, i) => (
            <g key={i}>
              <polygon
                points={`${fp.x - 9},${fp.y - 8} ${fp.x + 9},${fp.y} ${fp.x - 9},${fp.y + 8}`}
                fill={fp.color}
                opacity="0.85"
              />
            </g>
          ))}
        </svg>
        <div className="flex gap-5 mt-2">
          {[
            { color: "bg-green-500", label: "Regular (<2% dev)" },
            { color: "bg-amber-500", label: "Slight variance (2–5%)" },
            { color: "bg-red-500",   label: "Irregular (>5%)" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stride interval sparkline */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">
          <InfoTooltip text="Each point = time between two steps (in seconds). A flat line means very consistent walking. Spikes up or down mean the patient suddenly took a much longer or shorter step - a sign of neurological instability.">
            Stride Interval Timeline
          </InfoTooltip>
          <span className="text-gray-400 font-normal ml-1">- dashed = target ({mean.toFixed(2)}s/stride)</span>
        </p>
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="interval" stroke="#3b82f6" dot={false} strokeWidth={2} />
            <ReferenceLine y={mean} stroke="#d1d5db" strokeDasharray="4 4" />
            <YAxis domain={["dataMin - 0.06", "dataMax + 0.06"]} hide />
            <XAxis dataKey="step" hide />
            <Tooltip
              formatter={(v) => [`${v}s`, "Stride"]}
              labelFormatter={(l) => `Step ${l}`}
              contentStyle={{ fontSize: "11px" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Event warning */}
      {event && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{event}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SUBSCORE CARD
// ─────────────────────────────────────────────
function SubScoreCard({ icon: Icon, iconColor, label, tooltip, score, riskLabel, detail, isLive, pending, onRefresh }) {
  if (pending) {
    return (
      <div className="bg-white rounded-xl p-5 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 min-h-[130px]">
        <Icon size={22} className="text-gray-300" />
        <p className="text-xs font-semibold text-gray-400 text-center">
          {tooltip ? <InfoTooltip text={tooltip}>{label}</InfoTooltip> : label}
        </p>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Awaiting session</span>
      </div>
    );
  }

  const sc = SCORE_STYLES[Math.min(5, Math.max(1, Math.round(score)))] || SCORE_STYLES[3];

  return (
    <div className={`relative rounded-xl p-5 border-2 ${sc.bg} ${sc.border}`}>
      {isLive && (
        <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow animate-pulse">
          LIVE
        </span>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${iconColor}`}>
          <Icon size={13} className="text-white" />
        </div>
        <p className="text-xs font-semibold text-gray-600">
          {tooltip ? <InfoTooltip text={tooltip}>{label}</InfoTooltip> : label}
        </p>
      </div>
      <p className={`text-4xl font-black leading-none ${sc.text}`}>{score}</p>
      <p className="text-xs text-gray-400 mt-0.5">/5</p>
      <span className={`mt-2 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>
        {riskLabel}
      </span>
      {detail && <p className="text-xs text-gray-500 mt-1.5">{detail}</p>}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          New reading
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DOCTOR DASHBOARD
// ─────────────────────────────────────────────
function DoctorDashboard({ selected, setSelected, liveVoiceResults, voiceAlerts, recentVoicePatientId }) {
  const [tab, setTab] = useState("overview");
  const [gaitSeeds, setGaitSeeds] = useState({});
  const [liveScores, setLiveScores] = useState({});
  const c = riskColors[selected.riskLevel];

  const gaitSeed = gaitSeeds[selected.id] ?? 0;
  const handleGaitRefresh = useCallback(() => {
    setGaitSeeds(prev => ({ ...prev, [selected.id]: (prev[selected.id] ?? 0) + 1 }));
  }, [selected.id]);

  const hrData     = useMemo(() => runHRAnalysis(selected, 7),          [selected.id]);
  const gaitData   = useMemo(() => runGaitAnalysis(selected, gaitSeed), [selected.id, gaitSeed]);
  const todayHR    = hrData.analysisResults[hrData.analysisResults.length - 1];
  const hrRisk     = computeHRRisk(hrData);
  const hrTrendData = hrData.analysisResults.map((r) => ({
    day: `D${r.dayPostOp + 1}`,
    avgHR: r.contextAverages.rest ?? r.summary.avg,
  }));
  const hrAlerts   = hrData.alerts.filter((a) => a.severity >= 3).slice(0, 6);

  const voiceResult    = liveVoiceResults?.[selected.id] ?? null;
  const voiceAlertsForSelected = voiceAlerts?.[selected.id] ?? [];
  const isVoiceLive    = !!voiceResult;
  const showFlash      = recentVoicePatientId === selected.id;
  const compositeScore = computeCompositeScore(gaitData.result.riskScore, voiceResult?.riskScore ?? null, hrRisk);

  // Only push score to the sidebar when a refresh was explicitly triggered (seed > 0)
  useEffect(() => {
    if (gaitSeed > 0) {
      setLiveScores(prev => ({ ...prev, [selected.id]: compositeScore }));
    }
  }, [gaitSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtAlertTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const hhmm = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    if (d.toDateString() === now.toDateString()) return hhmm;
    if (new Date(now - 86400000).toDateString() === d.toDateString()) return `Yest. ${hhmm}`;
    return d.toLocaleDateString();
  };

  const hrAvgBpm = todayHR?.contextAverages?.rest ?? todayHR?.summary?.avg ?? "-";

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <Stethoscope size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-800">Clinical Dashboard</p>
            <p className="text-xs text-gray-400">Post-Op Cognitive Monitoring</p>
          </div>
        </div>

        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Active Patients ({PATIENTS.length})
        </p>

        <div className="flex-1 overflow-y-auto">
          {PATIENTS.map((p) => {
            const isSelected  = p.id === selected.id;
            const liveScore   = liveScores[p.id];
            const displayScore = liveScore ?? p.riskScore;
            const displayLabel = liveScore ? compositeLabel(liveScore) : p.riskLevel;
            const colorKey = displayLabel === "CRITICAL" || displayLabel === "HIGH" ? "HIGH"
                           : displayLabel === "LOW"      || displayLabel === "EXCELLENT" ? "LOW"
                           : "MODERATE";
            const pc = riskColors[colorKey];
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setTab("overview"); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors
                  ${isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User size={14} className="text-gray-400" />
                      </div>
                      {p.alert && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.surgery} · Day {p.dayPost}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${pc.badge}`}>
                      {displayLabel}
                    </span>
                    <span className={`text-xs font-bold ${scoreColor(Math.round(displayScore))}`}>
                      {liveScore ? displayScore.toFixed(1) : displayScore}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <p className="text-xs text-gray-400">Live · Synced just now</p>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-800">{selected.name}</h2>
                <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${c.badge}`}>
                  {selected.riskLevel} RISK
                </span>
                <span className="text-xs text-gray-400">
                  Age {selected.age} · {selected.surgery} · Day {selected.dayPost} post-op
                </span>
              </div>
              {selected.alert && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-500" />
                  <p className="text-xs text-red-600 font-medium">{selected.alertMessage}</p>
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-xs text-gray-400">Composite Risk Score</p>
              <p className={`text-4xl font-black leading-none ${scoreColor(Math.round(compositeScore))}`}>
                {compositeScore.toFixed(1)}
                <span className="text-sm text-gray-400 font-normal">/5</span>
              </p>
              <p className={`text-xs font-bold mt-0.5 ${scoreColor(Math.round(compositeScore))}`}>
                {compositeLabel(compositeScore)}
              </p>
            </div>
          </div>
        </div>

        {/* Live update banner */}
        {showFlash && (
          <div className="bg-emerald-500 text-white px-6 py-2.5 shrink-0 flex items-center gap-3">
            <span className="w-2 h-2 bg-white rounded-full animate-ping shrink-0" />
            <span className="font-semibold text-sm">
              Live update - voice analysis complete for {selected.name}
            </span>
            <span className="ml-auto text-emerald-200 text-xs">Composite score updated</span>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 shrink-0">
          {[
            { key: "overview", label: "Overview" },
            { key: "trends",   label: "Trends" },
            { key: "alerts",   label: `Alerts${(selected.alerts.length + hrAlerts.length + voiceAlertsForSelected.length) > 0 ? ` (${selected.alerts.length + hrAlerts.length + voiceAlertsForSelected.length})` : ""}` },
            { key: "ailog",    label: "AI Conversation" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`mr-6 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="space-y-5">

              {/* Composite score bar */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <InfoTooltip text="A single score combining voice, walking, and heart rate analysis. 1 = patient is doing well. 5 = urgent attention needed. Updated in real time after each daily check-in.">
                      Composite Cognitive Risk
                    </InfoTooltip>
                  </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {voiceResult ? "Weighted: Gait 40% · Voice 35% · Heart Rate 25%" : "Weighted: Gait 60% · Heart Rate 40% · Voice pending"}
                    </p>
                  </div>
                  <p className={`text-5xl font-black leading-none ${scoreColor(Math.round(compositeScore))}`}>
                    {compositeScore.toFixed(1)}
                    <span className="text-sm text-gray-400 font-normal ml-1">/5</span>
                  </p>
                </div>
                <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #22c55e 0%, #f59e0b 50%, #ef4444 100%)" }}>
                  <div className="absolute inset-0 bg-white/30" />
                  <div
                    className="absolute top-0 h-full w-1.5 bg-white shadow transition-all duration-700 rounded-full"
                    style={{ left: `calc(${((compositeScore - 1) / 4) * 100}% - 3px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>1 - Excellent</span>
                  <span>Alert threshold: 3</span>
                  <span>5 - Critical</span>
                </div>
              </div>

              {/* 3 Subscore cards */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Signal Subscores</p>
                <div className="grid grid-cols-3 gap-4">
                  <SubScoreCard
                    icon={Mic}
                    iconColor="bg-blue-500"
                    label="Voice Analysis"
                    tooltip="The AI listens for speech pace, hesitations, and energy levels during the daily check-in. Slow or fragmented speech are early markers of cognitive decline - often appearing before visible symptoms."
                    score={voiceResult?.riskScore ?? null}
                    riskLabel={voiceResult?.riskLabel ?? "-"}
                    detail={voiceResult ? `${voiceResult.findingCount} finding${voiceResult.findingCount !== 1 ? "s" : ""} detected` : null}
                    isLive={isVoiceLive}
                    pending={!voiceResult}
                  />
                  <SubScoreCard
                    icon={Activity}
                    iconColor="bg-teal-500"
                    label="Gait Consistency"
                    tooltip="Measures walking rhythm from a wearable sensor. Irregular step timing - even when invisible to the eye - is a proven early predictor of delirium and fall risk in post-surgical patients."
                    score={gaitData.result.riskScore}
                    riskLabel={gaitData.result.riskLabel}
                    detail={`Regularity: ${gaitData.result.consistencyScore}/100 · Variability: ${gaitData.result.cv}%`}
                    isLive={false}
                    pending={false}
                    onRefresh={handleGaitRefresh}
                  />
                  <SubScoreCard
                    icon={Heart}
                    iconColor="bg-pink-500"
                    label="Heart Rate"
                    tooltip="Continuous monitoring of resting heart rate trends. Elevated or erratic heart rate after surgery can indicate physiological stress, which is strongly linked to post-operative cognitive complications."
                    score={hrRisk}
                    riskLabel={["","LOW","LOW","MODERATE","HIGH","CRITICAL"][Math.min(5,hrRisk)]}
                    detail={`Avg resting: ${hrAvgBpm} bpm`}
                    isLive={false}
                    pending={false}
                  />
                </div>
              </div>

              {/* Gait visualization */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-4">Gait Analysis</p>
                <GaitVisualizer key={gaitSeed} gaitProfile={gaitData.result} />
              </div>

              {/* Recovery trend */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Cognitive Risk - Recovery Trend</p>
                <p className="text-xs text-gray-400 mb-4">Composite score over post-op days (1 = good, 5 = critical). Alert threshold at 3.</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={selected.trend}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Alert", position: "insideTopRight", fontSize: 10, fill: "#d97706" }} />
                    <Area type="monotone" dataKey="risk" stroke="#ef4444" fill="url(#rg)" strokeWidth={2.5} name="Risk Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Medications */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Prescribed Medications</p>
                <div className="flex flex-wrap gap-2">
                  {selected.medications.map((m, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TRENDS ── */}
          {tab === "trends" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">HRV & Motion Irregularity</p>
                <p className="text-xs text-gray-400 mb-4">HRV (ms) from PPG wristband · Jerk score from IMU accelerometer</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selected.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="hrv"  stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} name="HRV (ms)" />
                    <Line type="monotone" dataKey="jerk" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} name="Motor Jerk" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Speech Coherence vs. Risk Score</p>
                <p className="text-xs text-gray-400 mb-4">AI voice coherence (0–100) overlaid with composite risk (1–5)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selected.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="speech" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="risk" orientation="right" domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="speech" type="monotone" dataKey="speech" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Speech Coherence (0–100)" />
                    <Line yAxisId="risk"   type="monotone" dataKey="risk"   stroke="#ef4444" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} name="Risk Score (1–5)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Heart Rate - 7-Day Recovery Trend</p>
                <p className="text-xs text-gray-400 mb-4">Daily average resting HR (bpm) · Dashed = tachycardia threshold</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={hrTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[40, 140]} tick={{ fontSize: 11 }} unit=" bpm" width={55} />
                    <Tooltip formatter={(v) => [`${v} bpm`, "Avg Resting HR"]} />
                    <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Tachycardia", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
                    <Line type="monotone" dataKey="avgHR" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} name="Avg Resting HR" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── ALERTS ── */}
          {tab === "alerts" && (
            <div className="space-y-3">
              {selected.alerts.length === 0 && hrAlerts.length === 0 && voiceAlertsForSelected.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle size={44} className="mx-auto mb-3 text-green-400" />
                  <p className="text-sm font-semibold text-green-600">No alerts - patient recovering within normal range</p>
                </div>
              ) : (
                <>
                  {selected.alerts.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clinical Alerts</p>
                      {selected.alerts.map((a, i) => (
                        <div key={i} className={`bg-white rounded-xl border p-4 flex items-start gap-3
                          ${a.sev === "HIGH" ? "border-red-200" : a.sev === "MED" ? "border-yellow-200" : "border-gray-200"}`}>
                          <div className={`p-2 rounded-lg shrink-0
                            ${a.sev === "HIGH" ? "bg-red-100" : a.sev === "MED" ? "bg-yellow-100" : "bg-blue-50"}`}>
                            {a.sev === "INFO"
                              ? <CheckCircle size={16} className="text-blue-400" />
                              : <AlertTriangle size={16} className={a.sev === "HIGH" ? "text-red-500" : "text-yellow-500"} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{a.msg}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0
                            ${a.sev === "HIGH" ? "bg-red-100 text-red-700" :
                              a.sev === "MED"  ? "bg-yellow-100 text-yellow-700" :
                              a.sev === "LOW"  ? "bg-gray-100 text-gray-600" :
                              "bg-blue-50 text-blue-600"}`}>
                            {a.sev}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {voiceAlertsForSelected.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
                        Voice Alerts ({voiceAlertsForSelected.length})
                      </p>
                      {voiceAlertsForSelected.map((a, i) => (
                        <div key={`voice-${i}`} className={`bg-white rounded-xl border p-4 flex items-start gap-3
                          ${a.sev === "HIGH" ? "border-red-200" : a.sev === "MED" ? "border-yellow-200" : "border-blue-200"}`}>
                          <div className={`p-2 rounded-lg shrink-0
                            ${a.sev === "HIGH" ? "bg-red-100" : a.sev === "MED" ? "bg-yellow-100" : "bg-blue-50"}`}>
                            <Mic size={16} className={a.sev === "HIGH" ? "text-red-500" : a.sev === "MED" ? "text-yellow-500" : "text-blue-400"} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{a.msg}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0
                            ${a.sev === "HIGH" ? "bg-red-100 text-red-700" : a.sev === "MED" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                            {a.sev}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {hrAlerts.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
                        Heart Rate Alerts ({hrAlerts.length})
                      </p>
                      {hrAlerts.map((a, i) => (
                        <div key={`hr-${i}`} className={`bg-white rounded-xl border p-4 flex items-start gap-3
                          ${a.severity >= 4 ? "border-red-200" : "border-yellow-200"}`}>
                          <div className={`p-2 rounded-lg shrink-0 ${a.severity >= 4 ? "bg-red-100" : "bg-yellow-100"}`}>
                            <Heart size={16} className={a.severity >= 4 ? "text-red-500" : "text-yellow-500"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{a.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{fmtAlertTime(a.timestamp)} · Day {a.dayPostOp + 1} post-op</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0
                            ${a.severity >= 4 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {a.severity >= 4 ? "HIGH" : "MED"}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── AI LOG ── */}
          {tab === "ailog" && (
            <div className="space-y-5">
              {/* Voice analysis result (live) */}
              {voiceResult && (
                <div className={`rounded-xl border-2 p-4 ${SCORE_STYLES[voiceResult.riskScore]?.bg} ${SCORE_STYLES[voiceResult.riskScore]?.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <p className="text-sm font-semibold text-gray-800">Latest Voice Analysis - Live Result</p>
                    </div>
                    <span className={`text-sm font-black px-3 py-1 rounded-full ${SCORE_STYLES[voiceResult.riskScore]?.badge}`}>
                      Risk {voiceResult.riskScore}/5 - {voiceResult.riskLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{voiceResult.metrics?.avgSpeechRate ?? "-"}</p>
                      <p className="text-xs text-gray-500">WPM</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{voiceResult.metrics?.totalPauses ?? "-"}</p>
                      <p className="text-xs text-gray-500">Hesitations</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{(voiceResult.findingCount ?? 0) + (voiceResult.contentFindings?.length ?? 0)}</p>
                      <p className="text-xs text-gray-500">Findings</p>
                    </div>
                  </div>
                  {(voiceResult.findings?.length > 0 || voiceResult.contentFindings?.length > 0) && (
                    <div className="mt-3 space-y-1.5">
                      {voiceResult.findings?.map((f, i) => (
                        <div key={`audio-${i}`} className="bg-white/70 rounded-lg px-3 py-2 text-xs text-gray-700 font-medium">
                          🎙 {f.description}
                        </div>
                      ))}
                      {voiceResult.contentFindings?.map((f, i) => (
                        <div key={`content-${i}`} className={`rounded-lg px-3 py-2 text-xs font-medium ${f.severity >= 2 ? "bg-red-100 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                          🧠 {f.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation log */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-600 rounded-lg">
                    <Brain size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Daily AI Voice Agent Conversation</p>
                    <p className="text-xs text-gray-400">AI-guided cognitive check-in · 4 structured questions</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {selected.aiLog.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "AI" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-md px-4 py-2.5 rounded-2xl text-sm
                        ${m.role === "AI" ? "bg-gray-100 text-gray-800 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none"}`}>
                        <p className="text-xs font-bold mb-0.5 opacity-50">
                          {m.role === "AI" ? "🤖 AI Agent" : "👤 Patient"}
                        </p>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PATIENT APP (phone simulation)
// ─────────────────────────────────────────────
function PatientApp({ patient, onVoiceComplete }) {
  const [screen, setScreen] = useState("home");
  const [checkInResults, setCheckInResults] = useState(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const clockStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleCheckInComplete = (result) => {
    setCheckInResults(result);
    setScreen("results");

    if (result.voiceMetrics) {
      const voiceAnalysis = {
        ...analyzeVoiceMetrics(result.voiceMetrics),
        contentFindings: result.contentFindings ?? [],
      };

      // Lift to root so doctor dashboard updates live
      onVoiceComplete(patient.id, voiceAnalysis);

      // Persist to local storage
      saveVoiceAnalysis(patient.id, voiceAnalysis, {
        name: patient.name, age: patient.age,
        surgery: patient.surgery, dayPost: patient.dayPost,
      });
    }

    if (result.aiLog) patient.aiLog = result.aiLog;
  };

  const scoreCol =
    patient.riskScore <= 1 ? "text-green-300"
    : patient.riskScore <= 3 ? "text-yellow-300"
    : "text-red-300";

  return (
    <div className="flex items-center justify-center min-h-full bg-gray-200 py-6">
      <div key={patient.id} className="w-96 bg-white rounded-3xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 104px)" }}>
        {/* Status bar */}
        <div className="bg-gray-900 px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
          <span className="text-white text-xs font-medium">{clockStr}</span>
          <div className="flex items-center gap-2">
            <Wifi size={11} className="text-white" />
            <Battery size={11} className="text-white" />
          </div>
        </div>

        {/* App header */}
        <div className="bg-blue-600 px-5 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-xs">Good morning,</p>
              <h1 className="text-white font-bold text-lg">{patient.name.split(" ")[0]} 👋</h1>
              <p className="text-blue-200 text-xs mt-0.5">
                Day {patient.dayPost} recovery · {patient.surgery}
              </p>
            </div>
            <div className="bg-white/20 rounded-2xl p-3 text-center">
              <p className={`text-2xl font-black ${scoreCol}`}>{patient.riskScore}</p>
              <p className="text-white text-xs">Risk Score</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50">

          {screen === "home" && (
            <>
              {/* Wristband status */}
              <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3 border border-green-100">
                <Activity size={16} className="text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700">Wristband Connected</p>
                  <p className="text-xs text-green-500">HRV {patient.metrics.hrv}ms · Syncing every 30s</p>
                </div>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>

              {/* Quick metrics */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Heart,    label: "HRV",    val: `${patient.metrics.hrv}ms`,          color: "bg-pink-50",   ic: "text-pink-500" },
                  { icon: Mic,      label: "Speech", val: `${patient.metrics.speechScore}/100`, color: "bg-blue-50",   ic: "text-blue-500" },
                  { icon: Activity, label: "Gait",   val: `${Math.max(2, Math.min(100, Math.round(100 - patient.gait.sessionCv * 8.2)))}/100`, color: "bg-teal-50", ic: "text-teal-500" },
                ].map(({ icon: I, label, val, color, ic }) => (
                  <div key={label} className={`${color} rounded-xl p-2.5 text-center`}>
                    <I size={14} className={`${ic} mx-auto mb-1`} />
                    <p className="text-xs font-bold text-gray-800">{val}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Recovery trend */}
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">Recovery Trend</p>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={patient.trend}>
                    <defs>
                      <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="risk" stroke="#3b82f6" fill="url(#pg)" strokeWidth={2} />
                    <XAxis dataKey="day" tick={{ fontSize: 8 }} />
                    <YAxis domain={[1, 5]} hide />
                    <Tooltip contentStyle={{ fontSize: "10px" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Medications */}
              <div className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">💊 Today's Medications</p>
                <div className="space-y-2">
                  {patient.medications.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      <p className="text-xs text-gray-700">{m}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Check-in */}
              <button
                onClick={() => { setCheckInResults(null); setScreen("checking-in"); }}
                className="w-full bg-blue-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <Mic size={15} />
                Start Daily Voice Check-in
              </button>
            </>
          )}

          {screen === "checking-in" && (
            <VoiceCheckIn patient={patient} onComplete={handleCheckInComplete} />
          )}

          {screen === "results" && checkInResults && (
            <>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-center justify-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                <p className="text-sm font-semibold text-green-700">Check-in Complete ✓</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                <p className="text-xs font-semibold text-gray-700 uppercase">Session Summary</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Questions answered:</span>
                    <span className="font-semibold">{checkInResults.aiLog?.filter(m => m.role === "Patient").length || 0} / 4</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Session duration:</span>
                    <span className="font-semibold">{checkInResults.voiceMetrics?.reduce((s, m) => s + m.duration, 0).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg speech rate:</span>
                    <span className="font-semibold">
                      {Math.round(checkInResults.voiceMetrics?.reduce((s, m) => s + m.speechRate.wordsPerMinute, 0) / (checkInResults.voiceMetrics?.length || 1))} WPM
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Conversation</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {checkInResults.aiLog?.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "Patient" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-xs px-3 py-1.5 rounded-xl text-xs
                          ${m.role === "AI" ? "bg-gray-100 text-gray-800" : "bg-blue-600 text-white"}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0" />
                <p className="text-xs text-blue-700 font-medium">Doctor dashboard updated with your results</p>
              </div>

              <button
                onClick={() => setScreen("home")}
                className="w-full bg-gray-600 text-white rounded-xl py-3 font-semibold hover:bg-gray-700 transition-colors"
              >
                ← Back to Home
              </button>
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div className="border-t border-gray-100 bg-white px-6 py-3 flex justify-around shrink-0">
          {[
            { icon: Home,     label: "Home" },
            { icon: Activity, label: "Vitals" },
            { icon: Bell,     label: "Alerts" },
            { icon: User,     label: "Profile" },
          ].map(({ icon: Icon, label }) => (
            <button key={label} className={`flex flex-col items-center gap-0.5 ${label === "Home" ? "text-blue-600" : "text-gray-400"}`}>
              <Icon size={16} />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────
export default function CogniLert() {
  const [view, setView] = useState("doctor");
  const [selected, setSelected] = useState(PATIENTS[0]);
  const [patientId, setPatientId] = useState(3);
  const [liveVoiceResults, setLiveVoiceResults] = useState({});
  const [voiceAlerts, setVoiceAlerts] = useState({});
  const [recentVoicePatientId, setRecentVoicePatientId] = useState(null);

  const patientViewPatient = PATIENTS.find((p) => p.id === patientId);

  const handleVoiceComplete = useCallback((pid, voiceAnalysis) => {
    setLiveVoiceResults(prev => ({ ...prev, [pid]: voiceAnalysis }));

    // Merge audio findings + LLM content findings into alerts
    const analysisWithContent = {
      ...voiceAnalysis,
      findings: [
        ...(voiceAnalysis.findings ?? []),
        ...(voiceAnalysis.contentFindings ?? []),
      ],
    };
    const newAlerts = generateVoiceAlerts(analysisWithContent);
    setVoiceAlerts(prev => ({ ...prev, [pid]: newAlerts }));
    
    setRecentVoicePatientId(pid);
    // Auto-switch doctor panel to the patient who just completed
    const updatedPatient = PATIENTS.find(p => p.id === pid);
    if (updatedPatient) setSelected(updatedPatient);
    setTimeout(() => setRecentVoicePatientId(null), 5000);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <span className="font-black text-gray-800 text-base">CogniLert</span>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">
              Multimodal Cognitive Safety Net · Post-Surgical Monitoring
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            { key: "doctor",  label: "Doctor Panel",  icon: Stethoscope },
            { key: "patient", label: "Patient App",   icon: User },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${view === key ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {view === "patient" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Demo patient:</span>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={patientId}
              onChange={(e) => setPatientId(Number(e.target.value))}
            >
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.riskLevel})</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="w-48" />
        )}
      </nav>

      <div className="flex-1 overflow-hidden">
        {view === "doctor" ? (
          <DoctorDashboard
            selected={selected}
            setSelected={setSelected}
            liveVoiceResults={liveVoiceResults}
            voiceAlerts={voiceAlerts}
            recentVoicePatientId={recentVoicePatientId}
          />
        ) : (
          <PatientApp
            patient={patientViewPatient}
            key={patientId}
            onVoiceComplete={handleVoiceComplete}
          />
        )}
      </div>
    </div>
  );
}
