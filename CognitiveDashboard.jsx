import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { runHRAnalysis } from "./src/analysis/heartRate/index.js";
import { VoiceCheckIn } from "./src/components/VoiceCheckIn";
import { analyzeVoiceMetrics } from "./src/analysis/voice/riskAnalyzer.js";
import {
  AlertTriangle, CheckCircle, Clock, Heart, Activity, Brain, Mic,
  User, Bell, Battery, Wifi, Stethoscope, Home, TrendingUp
} from "lucide-react";

// ─────────────────────────────────────────────
// SYNTHESIZED PATIENT DATA
// Risk score: 1 = good condition, 5 = immediate critical
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
    alertMessage: "Speech incoherence detected — possible early delirium",
    
    // Segregated risk signals (for multi-feature aggregation later)
    risks: {
      voice: null,           // Will be populated by analyzeVoiceMetrics
      heartRate: null,       // Will be populated by HR analyzer
      // Other features (motion, fine motor, etc.) go here
    },
    
    metrics: { hrv: 18, jerk: 78, reactionTime: 520, speechScore: 31, fineMotor: 38 },
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
      { time: "08:23", msg: "Speech coherence score: 31/100 — threshold breached", sev: "HIGH" },
      { time: "06:15", msg: "HRV critically low: 18ms (personal baseline: 38ms)", sev: "HIGH" },
      { time: "Yest. 22:41", msg: "Jerk score elevated: 78 (personal baseline: 40)", sev: "MED" },
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
    
    // Segregated risk signals
    risks: {
      voice: null,
      heartRate: null,
    },
    
    metrics: { hrv: 28, jerk: 52, reactionTime: 380, speechScore: 65, fineMotor: 61 },
    trend: [
      { day: "D1", hrv: 22, jerk: 68, speech: 52, risk: 4 },
      { day: "D2", hrv: 24, jerk: 64, speech: 57, risk: 4 },
      { day: "D3", hrv: 25, jerk: 60, speech: 60, risk: 4 },
      { day: "D4", hrv: 26, jerk: 57, speech: 63, risk: 3 },
      { day: "D5", hrv: 27, jerk: 55, speech: 63, risk: 3 },
      { day: "D6", hrv: 27, jerk: 54, speech: 64, risk: 3 },
      { day: "D7", hrv: 28, jerk: 53, speech: 64, risk: 3 },
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
      { time: "Yest. 14:30", msg: "Reaction time slightly elevated: 380ms", sev: "LOW" },
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
    
    // Segregated risk signals
    risks: {
      voice: null,
      heartRate: null,
    },
    
    metrics: { hrv: 44, jerk: 28, reactionTime: 290, speechScore: 88, fineMotor: 82 },
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
    
    // Segregated risk signals
    risks: {
      voice: null,
      heartRate: null,
    },
    
    metrics: { hrv: 31, jerk: 55, reactionTime: 340, speechScore: 74, fineMotor: 68 },
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
      { time: "D1 10:00", msg: "Baseline calibration complete — cognitive profile established", sev: "INFO" },
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

// s >= 4 → red, s >= 2 → yellow, s === 1 → green
const scoreColor = (s) => s >= 4 ? "text-red-600" : s >= 2 ? "text-yellow-600" : "text-green-600";

// ─────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon size={13} className="text-white" />
        </div>
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// DOCTOR DASHBOARD
// ─────────────────────────────────────────────
function DoctorDashboard({ selected, setSelected }) {
  const [tab, setTab] = useState("overview");
  const c = riskColors[selected.riskLevel];

  const hrData = useMemo(() => runHRAnalysis(selected, 7), [selected.id]);
  const todayHR = hrData.analysisResults[hrData.analysisResults.length - 1];
  const hrTrendData = hrData.analysisResults.map((r) => ({
    day: `D${r.dayPostOp + 1}`,
    avgHR: r.contextAverages.rest ?? r.summary.avg,
  }));

  const fmtAlertTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === now.toDateString()) return hhmm;
    if (new Date(now - 86400000).toDateString() === d.toDateString()) return `Yest. ${hhmm}`;
    return d.toLocaleDateString();
  };

  const hrAlerts = hrData.alerts.filter((a) => a.severity >= 3).slice(0, 6);

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
            const pc = riskColors[p.riskLevel];
            const isSelected = p.id === selected.id;
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
                      {p.riskLevel}
                    </span>
                    <span className={`text-xs font-bold ${scoreColor(p.riskScore)}`}>{p.riskScore}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <p className="text-xs text-gray-400">Live · Synced 2 min ago</p>
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
              <p className="text-xs text-gray-400">Cognitive Risk Score</p>
              <p className={`text-4xl font-black leading-none ${scoreColor(selected.riskScore)}`}>
                {selected.riskScore}
                <span className="text-sm text-gray-400 font-normal">/5</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 shrink-0">
          {[
            { key: "overview", label: "Overview" },
            { key: "trends",   label: "Trends" },
            { key: "alerts",   label: `Alerts${(selected.alerts.length + hrAlerts.length) > 0 ? ` (${selected.alerts.length + hrAlerts.length})` : ""}` },
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
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Today's Digital Biomarkers
                </p>
                <div className="grid grid-cols-5 gap-3">
                  <MetricCard icon={Heart}      label="HRV"              value={selected.metrics.hrv}          unit="ms"   color="bg-pink-500"   sub={`Baseline: ~${Math.round(selected.metrics.hrv * 1.9)}ms`} />
                  <MetricCard icon={Activity}   label="Jerk Score"       value={selected.metrics.jerk}         unit="/100" color="bg-orange-500" sub="Motion irregularity" />
                  <MetricCard icon={Clock}      label="Reaction Time"    value={selected.metrics.reactionTime} unit="ms"   color="bg-purple-500" sub="Motor initiation" />
                  <MetricCard icon={Mic}        label="Speech Coherence" value={selected.metrics.speechScore}  unit="/100" color="bg-blue-500"   sub="AI audio analysis" />
                  <MetricCard icon={TrendingUp} label="Fine Motor"       value={selected.metrics.fineMotor}    unit="/100" color="bg-teal-500"   sub="Touch interaction" />
                </div>
              </div>

              {/* HR live analysis card */}
              {todayHR && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Heart Rate — Live Sensor Analysis</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      todayHR.clean ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {todayHR.clean ? "Normal" : todayHR.findings.map((f) => f.replace(/_/g, " ")).join(", ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-pink-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{todayHR.contextAverages.rest ?? todayHR.summary.avg}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Avg Resting (bpm)</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{todayHR.summary.min}–{todayHR.summary.max}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Range (bpm)</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{todayHR.hrv}</p>
                      <p className="text-xs text-gray-400 mt-0.5">HRV RMSSD (bpm)</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className={`text-2xl font-bold ${
                        Math.abs(todayHR.baselineDeviationPct ?? 0) >= 20 ? "text-red-600" : "text-gray-800"
                      }`}>
                        {todayHR.baselineDeviationPct !== null
                          ? `${todayHR.baselineDeviationPct > 0 ? "+" : ""}${todayHR.baselineDeviationPct}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">vs Baseline</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk trend chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Cognitive Risk Score — Recovery Trend</p>
                <p className="text-xs text-gray-400 mb-4">
                  Composite score (1 = good condition, 5 = critical). Alert threshold at 3.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={selected.trend}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="risk" stroke="#ef4444" fill="url(#rg)" strokeWidth={2.5} name="Risk Score" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-red-400" />
                    <span className="text-xs text-gray-400">Risk Score (1–5)</span>
                  </div>
                  <span className="text-xs text-gray-400">⚠️ Alert threshold: 3</span>
                </div>
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

              {/* Signal guide */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "HRV",    desc: "↑ Better recovery  ↓ Stress / inflammation",     color: "bg-pink-50 text-pink-700" },
                  { label: "Jerk",   desc: "↑ Movement chaos (bad)  ↓ Smooth motion (good)", color: "bg-orange-50 text-orange-700" },
                  { label: "Speech", desc: "↑ Coherent & clear  ↓ Confusion detected",       color: "bg-blue-50 text-blue-700" },
                  { label: "Risk",   desc: "↑ Urgent action needed  ↓ Patient recovering",   color: "bg-red-50 text-red-700" },
                ].map((s) => (
                  <div key={s.label} className={`${s.color} rounded-lg p-3`}>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs mt-0.5 opacity-75">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRENDS ── */}
          {tab === "trends" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">HRV & Jerk — Raw Sensor Data</p>
                <p className="text-xs text-gray-400 mb-4">
                  Heart rate variability (ms) from PPG wristband · Motion jerk score from IMU accelerometer
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selected.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="hrv"  stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} name="HRV (ms)" />
                    <Line type="monotone" dataKey="jerk" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} name="Jerk Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Speech Coherence vs. Risk Score</p>
                <p className="text-xs text-gray-400 mb-4">
                  AI-analyzed speech coherence (0–100, left axis) overlaid with composite cognitive risk score (1–5, right axis)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selected.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="speech" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="risk" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="speech" type="monotone" dataKey="speech" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Speech Coherence (0–100)" />
                    <Line yAxisId="risk"   type="monotone" dataKey="risk"   stroke="#ef4444" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} name="Risk Score (1–5)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">Heart Rate — 7-Day Recovery Trend</p>
                <p className="text-xs text-gray-400 mb-4">
                  Daily average resting HR (bpm) · Dashed red line = tachycardia threshold (100 bpm)
                </p>
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

              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">How the Risk Score is Computed</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  The composite Cognitive Risk Score (1–5) is produced by a personalized ML model trained on the patient's
                  own pre-discharge baseline. It fuses four signal layers: <b>HRV</b> (physiological stress),
                  <b> Jerk</b> (motor control quality via IMU), <b>Speech Coherence</b> (AI acoustic analysis), and
                  <b> Fine Motor</b> (touch interaction latency). 1 = good condition, 5 = immediate critical — a score
                  above 3 triggers an alert to the care team. This approach achieves passive, zero-effort monitoring
                  with no wearable beyond a standard wristband.
                </p>
              </div>
            </div>
          )}

          {/* ── ALERTS ── */}
          {tab === "alerts" && (
            <div className="space-y-3">
              {selected.alerts.length === 0 && hrAlerts.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle size={44} className="mx-auto mb-3 text-green-400" />
                  <p className="text-sm font-semibold text-green-600">No alerts — patient recovering within normal range</p>
                </div>
              ) : (
                <>
                  {/* Static clinical alerts */}
                  {selected.alerts.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clinical Alerts</p>
                      {selected.alerts.map((a, i) => (
                        <div
                          key={i}
                          className={`bg-white rounded-xl border p-4 flex items-start gap-3
                            ${a.sev === "HIGH" ? "border-red-200" : a.sev === "MED" ? "border-yellow-200" : "border-gray-200"}`}
                        >
                          <div className={`p-2 rounded-lg shrink-0
                            ${a.sev === "HIGH" ? "bg-red-100" : a.sev === "MED" ? "bg-yellow-100" : "bg-blue-50"}`}
                          >
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
                              "bg-blue-50 text-blue-600"}`}
                          >
                            {a.sev}
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Heart rate alerts from analysis module */}
                  {hrAlerts.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
                        Heart Rate Alerts ({hrAlerts.length})
                      </p>
                      {hrAlerts.map((a, i) => (
                        <div
                          key={`hr-${i}`}
                          className={`bg-white rounded-xl border p-4 flex items-start gap-3
                            ${a.severity >= 4 ? "border-red-200" : "border-yellow-200"}`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${a.severity >= 4 ? "bg-red-100" : "bg-yellow-100"}`}>
                            <Heart size={16} className={a.severity >= 4 ? "text-red-500" : "text-yellow-500"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{a.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {fmtAlertTime(a.timestamp)} · Day {a.dayPostOp + 1} post-op
                            </p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0
                            ${a.severity >= 4 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                          >
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-600 rounded-lg">
                    <Brain size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Daily AI Voice Agent Conversation</p>
                    <p className="text-xs text-gray-400">Today · 08:20 AM · Duration: 3m 14s</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {selected.aiLog.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "AI" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-md px-4 py-2.5 rounded-2xl text-sm
                        ${m.role === "AI"
                          ? "bg-gray-100 text-gray-800 rounded-tl-none"
                          : "bg-blue-600 text-white rounded-tr-none"}`}
                      >
                        <p className="text-xs font-bold mb-0.5 opacity-50">
                          {m.role === "AI" ? "🤖 AI Agent" : "👤 Patient"}
                        </p>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acoustic analysis */}
              <div className="bg-gray-900 rounded-xl p-5 font-mono text-xs space-y-1.5">
                <p className="text-green-400 font-semibold mb-2">// Acoustic & NLP Analysis Output</p>
                <p className="text-gray-300">speech_rate: <span className="text-yellow-300">{selected.metrics.speechScore > 60 ? "138 wpm" : "82 wpm"}</span>
                  <span className="text-gray-500">  (baseline: ~145 wpm)</span></p>
                <p className="text-gray-300">pause_frequency: <span className={selected.metrics.speechScore > 60 ? "text-green-400" : "text-red-400"}>
                    {selected.metrics.speechScore > 60 ? "NORMAL" : "HIGH"}
                  </span>
                  <span className="text-gray-500">  {selected.metrics.speechScore > 60 ? "(avg 0.8s between phrases)" : "(avg 3.2s between phrases)"}</span></p>
                <p className="text-gray-300">coherence_score: <span className={selected.metrics.speechScore > 60 ? "text-green-400" : "text-red-400"}>
                    {selected.metrics.speechScore}/100
                  </span></p>
                <p className="text-gray-300">semantic_drift: <span className={selected.metrics.speechScore > 60 ? "text-green-400" : "text-red-400"}>
                    {selected.metrics.speechScore > 60 ? "NOT_DETECTED" : "DETECTED"}
                  </span></p>
                <p className="text-gray-300 mt-2">→ recommendation: <span className={selected.metrics.speechScore > 60 ? "text-green-300" : "text-orange-300"}>
                    {selected.metrics.speechScore > 60 ? "CONTINUE_MONITORING" : "ALERT_CARE_TEAM"}
                  </span></p>
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
function PatientApp({ patient }) {
  const [screen, setScreen] = useState("home"); // home | checking-in | results
  const [checkInResults, setCheckInResults] = useState(null);

  const handleCheckInComplete = (result) => {
    console.log("Check-in completed:", result);
    setCheckInResults(result);
    setScreen("results");
    
    // Analyze voice metrics and store separately
    if (result.voiceMetrics) {
      const voiceAnalysis = analyzeVoiceMetrics(result.voiceMetrics);
      
      // Initialize risks object if not present
      if (!patient.risks) {
        patient.risks = {};
      }
      
      // Store voice analysis data separately
      patient.risks.voice = {
        riskScore: voiceAnalysis.riskScore,
        riskLabel: voiceAnalysis.riskLabel,
        findings: voiceAnalysis.findings,
        findingCount: voiceAnalysis.findingCount,
        metrics: voiceAnalysis.metrics,
        timestamp: voiceAnalysis.timestamp
      };
      
      console.log("Voice analysis stored:", patient.risks.voice);
    }
    
    // Store AI conversation log
    if (result.aiLog) {
      patient.aiLog = result.aiLog;
    }
    
    // Store raw voice metrics for reference
    if (result.voiceMetrics) {
      patient.voiceMetrics = result.voiceMetrics;
    }
  };

  const handleStartCheckIn = () => {
    setCheckInResults(null);
    setScreen("checking-in");
  };

  const handleBackToHome = () => {
    setScreen("home");
    setCheckInResults(null);
  };

  const scoreCol =
    patient.riskScore <= 1 ? "text-green-300"
    : patient.riskScore <= 3 ? "text-yellow-300"
    : "text-red-300";

  return (
    <div className="flex items-center justify-center min-h-full bg-gray-200 py-6">
      {/* Phone frame */}
      <div key={patient.id} className="w-96 bg-white rounded-3xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="bg-gray-900 px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
          <span className="text-white text-xs font-medium">9:41 AM</span>
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

          {/* HOME SCREEN */}
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
                  { icon: Heart,    label: "HRV",      val: `${patient.metrics.hrv}ms`,          color: "bg-pink-50",   ic: "text-pink-500" },
                  { icon: Mic,      label: "Speech",   val: `${patient.metrics.speechScore}/100`, color: "bg-blue-50",   ic: "text-blue-500" },
                  { icon: Activity, label: "Response", val: `${patient.metrics.reactionTime}ms`,  color: "bg-purple-50", ic: "text-purple-500" },
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

              {/* Start Check-in Button */}
              <button
                onClick={handleStartCheckIn}
                className="w-full bg-blue-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <Mic size={15} />
                Start Daily Check-in
              </button>
            </>
          )}

          {/* CHECK-IN SCREEN */}
          {screen === "checking-in" && (
            <VoiceCheckIn 
              patient={patient} 
              onComplete={handleCheckInComplete}
            />
          )}

          {/* RESULTS SCREEN */}
          {screen === "results" && checkInResults && (
            <>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-center justify-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                <p className="text-sm font-semibold text-green-700">
                  Check-in Complete! ✓
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-3">
                    📊 Session Summary
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Questions Answered:</span>
                      <span className="font-semibold text-gray-800">{checkInResults.aiLog?.filter(m => m.role === "Patient").length || 0} / 4</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Session Duration:</span>
                      <span className="font-semibold text-gray-800">{checkInResults.voiceMetrics?.reduce((sum, m) => sum + m.duration, 0).toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Average Speech Rate:</span>
                      <span className="font-semibold text-gray-800">
                        {Math.round(checkInResults.voiceMetrics?.reduce((sum, m) => sum + m.speechRate.wordsPerMinute, 0) / (checkInResults.voiceMetrics?.length || 1)) || 0} WPM
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Hesitations:</span>
                      <span className="font-semibold text-gray-800">
                        {checkInResults.voiceMetrics?.reduce((sum, m) => sum + m.hesitations.pauseCount, 0) || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
                    🎙️ Conversation
                  </p>
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

              <button
                onClick={handleBackToHome}
                className="w-full bg-gray-600 text-white rounded-xl py-3 font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
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
            <button
              key={label}
              className={`flex flex-col items-center gap-0.5 ${label === "Home" ? "text-blue-600" : "text-gray-400"}`}
            >
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
  const [patientId, setPatientId] = useState(3); // Sara — recovering well by default

  const patientViewPatient = PATIENTS.find((p) => p.id === patientId);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Top Navigation ── */}
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

        {/* View toggle */}
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

        {/* Patient selector (patient view only) */}
        {view === "patient" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Demo patient:</span>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={patientId}
              onChange={(e) => setPatientId(Number(e.target.value))}
            >
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.riskLevel})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="w-48" /> /* spacer */
        )}
      </nav>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {view === "doctor" ? (
          <DoctorDashboard selected={selected} setSelected={setSelected} />
        ) : (
          <PatientApp patient={patientViewPatient} key={patientId} />
        )}
      </div>
    </div>
  );
}
