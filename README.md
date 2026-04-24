# CogniLert

Post-surgical cognitive monitoring prototype for geriatric patients. Detects early signs of delirium and cognitive decline by analyzing wearable sensor data and AI voice agent conversations, then surfaces real-time risk scores and alerts to the clinical care team.

## What it does

**For the doctor** — a clinical dashboard showing all patients, their cognitive risk score (1–5), recovery trends, and automatically generated alerts from live sensor analysis.

**For the patient** — a mobile app simulation displaying their recovery progress, medication schedule, and a daily AI voice check-in.

## Current state

All sensor data is synthesized — no real wearable or backend yet. The heart rate analysis pipeline runs entirely in the browser on synthetic data.

| Signal | Status |
|--------|--------|
| Heart Rate (HR / HRV) | Synthesized + analyzed |
| Gait (stride intervals) | Real dataset + analyzed |
| AI voice conversations | Mocked |

## Architecture

```
src/analysis/heartRate/
  simulator.js   →  generates 1,440 readings/day per patient
  analyzer.js    →  detects tachycardia, bradycardia, HRV anomalies, baseline deviation
  alerts.js      →  converts findings into severity-scored alerts (1–5 scale)
  index.js       →  runHRAnalysis(patient, days) — full pipeline

src/analysis/gait/
  strideData.js  →  real stride-interval data
  simulator.js   →  selects 30-stride windows; each seed yields a new reading
  analyzer.js    →  detects dysrhythmia, freezing-of-gait, trend deterioration
  alerts.js      →  converts findings into severity-scored alerts (1–5 scale)
  index.js       →  runGaitAnalysis(patient, seed) — full pipeline

CognitiveDashboard.jsx
  DoctorDashboard   →  Overview · Trends · Alerts · AI Conversation
  PatientApp        →  phone-frame simulation with interactive AI check-in
  CogniLert         →  root component, toggles between views
```

The analysis modules are plain JavaScript — no React dependency. When real wearable data is available, only the simulator needs to be replaced; the analyzer and alert generator stay the same.

## Risk scale

| Score | Meaning |
|-------|---------|
| 1 | Good condition |
| 2 | Mild concern |
| 3 | Alert threshold — care team notified |
| 4 | High risk |
| 5 | Immediate critical |

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Stack

- React 18
- Vite
- Tailwind CSS v4
- Recharts
- Lucide icons

## Planned

- Real wearable integration for gait (replace simulator with BLE accelerometer stream)
- AI voice conversation transcript analysis (speech coherence, semantic drift)
- Real wearable integration (HRV, accelerometer over BLE / REST)
- Backend risk scoring model fusing all signal layers
