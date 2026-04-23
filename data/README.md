# CogniLert Data Storage

This folder stores exported voice analysis and patient data in JSON format.

## Files

- `all-data-*.json` - Complete export of all stored analyses (timestamp-based)
- `patient-*.json` - Individual patient voice analysis data

## How to Export Data

1. Go to **Doctor Dashboard** 
2. Select a patient
3. Click the **💾 Saved Data** tab
4. Click **📥 Export All Data as JSON** or **✅ Export [Patient]'s Voice Data**
5. Your browser will download a JSON file
6. Move or copy it to this folder

## Data Structure

### All Data Export
```json
{
  "timestamp": "2026-04-23T09:15:00Z",
  "analyses": [
    {
      "patientId": 3,
      "type": "voice",
      "riskScore": 2,
      "riskLabel": "LOW",
      "findings": [...],
      "metrics": {...},
      "timestamp": "2026-04-23T09:10:00Z",
      "savedAt": "2026-04-23T09:10:05Z"
    }
  ],
  "patientIndex": {
    "3": {
      "voice": "2026-04-23T09:10:05Z"
    }
  }
}
```

### Patient Voice Data
```json
{
  "patientId": 3,
  "voice": {
    "riskScore": 2,
    "riskLabel": "LOW",
    "findings": [...],
    "findingCount": 1,
    "metrics": {
      "totalDuration": 45.2,
      "avgSpeechRate": 125,
      "totalPauses": 3,
      "avgEnergy": -28.5,
      "responseCount": 4
    },
    "timestamp": "2026-04-23T09:10:00Z"
  }
}
```

## Viewing Data in VS Code

1. Export data from the app
2. Save the JSON file to this folder
3. Open it in VS Code (it will auto-format)
4. You can now inspect all voice analysis metrics, findings, timestamps, etc.

## localStorage Key Mapping

Browser localStorage uses these keys:
- `cognilert_patient_1_voice` - Patient 1 voice data
- `cognilert_patient_2_voice` - Patient 2 voice data
- `cognilert_patient_3_voice` - Patient 3 voice data
- `cognilert_patient_4_voice` - Patient 4 voice data
- `cognilert_patient_index` - Index of all patients with data

These are automatically managed by `src/services/patientStorage.js`
