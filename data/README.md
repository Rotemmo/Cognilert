# CogniLert Data Storage

This folder contains the voice analysis data storage system for CogniLert. The system provides persistent, repository-based storage that can be backed up and shared.

## Files

- `voiceStorage.js` - Main storage service with localStorage bridge
- `example-patient-3-voice.json` - Example voice analysis data

## Data Structure

The storage system creates a hierarchical structure in the `/data` folder:

```
/data/
├── patients/
│   ├── patient_1/
│   │   ├── profile.json
│   │   └── voice_analyses/
│   │       ├── 2026-04-23_14-05-00.json
│   │       └── ...
│   └── patient_2/
│       └── ...
└── exports/
    └── backup_2026-04-23.json
```

## Browser Storage (localStorage)

During development, data is stored in browser localStorage with these key patterns:

- `cognilert_profile_{patientId}` - Patient profile data
- `cognilert_voice_{patientId}_{timestamp}` - Voice analysis data
- `cognilert_index_{patientId}_voice` - Analysis index for quick lookup

## Data Format

### Voice Analysis Data
```json
{
  "patientId": 1,
  "riskScore": 2,
  "riskLabel": "LOW",
  "findings": [
    {
      "description": "Speech rate below baseline",
      "questionNumber": 2,
      "type": "speech_rate",
      "severity": 2
    }
  ],
  "findingCount": 1,
  "metrics": {
    "totalDuration": 45.2,
    "avgSpeechRate": 125,
    "totalPauses": 3,
    "avgEnergy": -28.5,
    "responseCount": 4
  },
  "patientInfo": {
    "name": "Patient Name",
    "age": 72,
    "surgery": "Hip Replacement",
    "dayPost": 5
  },
  "filename": "2026-04-23_14-05-00.json",
  "savedAt": "2026-04-23T11:05:00.000Z"
}
```

### Patient Profile
```json
{
  "patientId": 1,
  "name": "Patient Name",
  "age": 72,
  "surgery": "Hip Replacement",
  "dayPost": 5,
  "createdAt": "2026-04-23T11:00:00.000Z",
  "updatedAt": "2026-04-23T11:05:00.000Z"
}
```

## Export Functions

The storage system provides several export options:

### Export All Data
```javascript
import { downloadDataExport } from './data/voiceStorage.js';
downloadDataExport(); // Downloads complete JSON export
```

### Export Patient Data as CSV
```javascript
import { exportPatientDataAsCSV } from './data/voiceStorage.js';
exportPatientDataAsCSV(patientId); // Downloads CSV for specific patient
```

### Get Storage Statistics
```javascript
import { getStorageStats } from './data/voiceStorage.js';
const stats = getStorageStats();
console.log(stats.totalPatients, stats.totalAnalyses, stats.storageSizeKB);
```

## Usage in Application

### Import Storage Functions
```javascript
import {
  saveVoiceAnalysis,
  loadVoiceAnalyses,
  getAllPatientsWithData,
  downloadDataExport,
  exportPatientDataAsCSV,
  getStorageStats,
  getRiskDistribution
} from './data/voiceStorage.js';
```

### Save Voice Analysis
```javascript
const analysisData = {
  riskScore: 2,
  riskLabel: "LOW",
  findings: [...],
  metrics: {...}
};

saveVoiceAnalysis(patientId, analysisData, {
  name: "Patient Name",
  age: 72,
  surgery: "Hip Replacement",
  dayPost: 5
});
```

### Load Patient Data
```javascript
const voiceAnalyses = loadVoiceAnalyses(patientId);
const allPatients = getAllPatientsWithData();
```

## Migration to File System

The current implementation uses localStorage as a bridge solution. To migrate to actual file system storage:

1. Replace localStorage calls with file system operations
2. Use Node.js `fs` module for file operations
3. Maintain the same data structure and API
4. Add error handling for file system operations

## Development Notes

- Data persists between browser sessions via localStorage
- Export functions create downloadable files for backup
- Patient data is indexed for fast lookup and display
- Risk distribution and statistics are calculated automatically
- Data cleanup functions are available for maintenance

## Future Enhancements

- Full file system storage with Node.js backend
- Database integration for multi-user scenarios
- Cloud storage integration
- Data synchronization between devices
- Advanced analytics and reporting