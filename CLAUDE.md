# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CogniLert is a React prototype for post-surgical geriatric cognitive monitoring, built as an investor demo. It has two views: a clinical Doctor Dashboard and a Patient App phone simulation.

**Current state:** All data is static and synthetic — no backend, no live connections. **Planned:** Real-time data will be streamed from a wearable (HRV, steps, motion) and a daily AI voice agent call. Raw signals and transcripts will be sent to an LLM for cognitive state analysis, producing live risk scores and alerts.

Stack: React · Tailwind CSS · Recharts · Lucide icons

## Dev Setup

No package.json exists yet. To scaffold and run:

```bash
npm create vite@latest . -- --template react
npm install recharts lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

Add the Tailwind plugin to `vite.config.js` and `@import "tailwindcss";` to `src/index.css`. Then wire up the entry point in `src/App.jsx`:

```jsx
import CogniLert from "../CognitiveDashboard";
export default function App() { return <CogniLert />; }
```

```bash
npm run dev
```

## Architecture

Everything lives in `CognitiveDashboard.jsx`:

- **`PATIENTS[]`** — all synthetic patient data: demographics, risk score/level, per-day trend arrays, AI conversation logs, alerts, and medications. This is the sole data source.
- **`riskColors` / `scoreColor()`** — shared helpers that map risk level and numeric score to Tailwind color classes.
- **`MetricCard`** — small reusable card for displaying a single biomarker (icon, label, value, unit, subtitle).
- **`DoctorDashboard`** — full clinical UI with a patient sidebar and four tabs: Overview, Trends, Alerts, AI Conversation.
- **`PatientApp`** — phone-frame simulation of the patient-facing app, including an interactive step-through AI check-in chat.
- **`CogniLert`** *(default export)* — root component; toggles between doctor and patient views, holds selected patient state.

## Key Design Notes

- Risk score scale: **1 = good condition, 5 = immediate critical**. Alert threshold is 3.
- Doctor view defaults to **Ruth Cohen** (id=1, HIGH risk, active alert) — the most dramatic demo patient.
- Patient view defaults to **Sara Mizrahi** (id=3, LOW risk) — a positive recovery story.
- The `key={patientId}` on `PatientApp` resets chat state when the demo patient is switched.
