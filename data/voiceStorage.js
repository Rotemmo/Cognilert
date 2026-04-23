/**
 * Voice Analysis Data Storage Service
 * 
 * Stores patient voice analysis data in browser localStorage.
 * Designed for easy migration to file system when backend is added.
 * 
 * Data Structure:
 * /data/
 *   ├── patients/
 *   │   ├── patient_1/
 *   │   │   ├── profile.json
 *   │   │   └── voice_analyses/
 *   │   │       ├── 2026-04-23_14-05-00.json
 *   │   │       └── ...
 *   │   └── patient_2/
 *   │       └── ...
 *   └── exports/
 *       └── backup_2026-04-23.json
 */

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const DATA_BASE_PATH = '/data/patients';
const PATIENT_DIR = (patientId) => `${DATA_BASE_PATH}/patient_${patientId}`;
const PROFILE_FILE = (patientId) => `${PATIENT_DIR(patientId)}/profile.json`;
const VOICE_DIR = (patientId) => `${PATIENT_DIR(patientId)}/voice_analyses`;

// ─────────────────────────────────────────────
// FILE SYSTEM OPERATIONS (Browser-compatible)
// ─────────────────────────────────────────────

/**
 * Generate timestamp for filename
 */
export function generateTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Parse timestamp from filename
 */
export function parseTimestamp(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.json$/);
  return match ? match[1] : null;
}

/**
 * Format timestamp for display
 */
export function formatTimestampForDisplay(timestamp) {
  if (!timestamp) return 'Unknown';
  const [date, time] = timestamp.split('_');
  const [year, month, day] = date.split('-');
  const [hours, minutes, seconds] = time.split('-');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// ─────────────────────────────────────────────
// PATIENT PROFILE MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Create or update patient profile
 */
export function savePatientProfile(patientId, profileData) {
  const profile = {
    patientId,
    ...profileData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // In a real implementation, this would write to the file system
  // For now, we'll store in localStorage as a bridge solution
  const key = `cognilert_profile_${patientId}`;
  localStorage.setItem(key, JSON.stringify(profile));
  
  console.log(`[VoiceStorage] Profile saved for patient ${patientId}:`, profile);
  return profile;
}

/**
 * Load patient profile
 */
export function loadPatientProfile(patientId) {
  try {
    const key = `cognilert_profile_${patientId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[VoiceStorage] Failed to load profile for patient ${patientId}:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────
// VOICE ANALYSIS STORAGE
// ─────────────────────────────────────────────

/**
 * Save voice analysis to repository data
 */
export function saveVoiceAnalysis(patientId, voiceAnalysis, patientInfo = {}) {
  try {
    const timestamp = generateTimestamp();
    const filename = `${timestamp}.json`;
    
    const analysisData = {
      ...voiceAnalysis,
      patientId,
      filename,
      savedAt: new Date().toISOString(),
      patientInfo: {
        name: patientInfo.name,
        age: patientInfo.age,
        surgery: patientInfo.surgery,
        dayPost: patientInfo.dayPost
      }
    };
    
    // Store in localStorage (bridge solution)
    const key = `cognilert_voice_${patientId}_${timestamp}`;
    localStorage.setItem(key, JSON.stringify(analysisData));
    
    // Also update the patient's voice analysis index
    updateAnalysisIndex(patientId, 'voice', {
      timestamp,
      filename,
      riskScore: voiceAnalysis.riskScore,
      riskLabel: voiceAnalysis.riskLabel,
      findingCount: voiceAnalysis.findingCount,
      savedAt: analysisData.savedAt
    });
    
    console.log(`[VoiceStorage] Voice analysis saved for patient ${patientId}:`, analysisData);
    return analysisData;
  } catch (error) {
    console.error(`[VoiceStorage] Failed to save voice analysis for patient ${patientId}:`, error);
    return null;
  }
}

/**
 * Load all voice analyses for a patient
 */
export function loadVoiceAnalyses(patientId) {
  try {
    const indexKey = `cognilert_index_${patientId}_voice`;
    const indexData = localStorage.getItem(indexKey);
    const index = indexData ? JSON.parse(indexData) : [];
    
    const analyses = index.map(entry => {
      const key = `cognilert_voice_${patientId}_${entry.timestamp}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);
    
    // Sort by date (newest first)
    analyses.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    
    return analyses;
  } catch (error) {
    console.error(`[VoiceStorage] Failed to load voice analyses for patient ${patientId}:`, error);
    return [];
  }
}

/**
 * Get a specific voice analysis by timestamp
 */
export function getVoiceAnalysis(patientId, timestamp) {
  try {
    const key = `cognilert_voice_${patientId}_${timestamp}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[VoiceStorage] Failed to get voice analysis for patient ${patientId}:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────
// ANALYSIS INDEX MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Update analysis index for a patient
 */
function updateAnalysisIndex(patientId, type, entry) {
  try {
    const indexKey = `cognilert_index_${patientId}_${type}`;
    const indexData = localStorage.getItem(indexKey);
    let index = indexData ? JSON.parse(indexData) : [];
    
    index.push(entry);
    
    // Sort by timestamp (newest first)
    index.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    
    localStorage.setItem(indexKey, JSON.stringify(index));
  } catch (error) {
    console.warn(`[VoiceStorage] Failed to update index for patient ${patientId}:`, error);
  }
}

/**
 * Get analysis index for a patient
 */
export function getAnalysisIndex(patientId, type) {
  try {
    const indexKey = `cognilert_index_${patientId}_${type}`;
    const indexData = localStorage.getItem(indexKey);
    return indexData ? JSON.parse(indexData) : [];
  } catch (error) {
    console.error(`[VoiceStorage] Failed to get index for patient ${patientId}:`, error);
    return [];
  }
}

// ─────────────────────────────────────────────
// PATIENT LIST & DISCOVERY
// ─────────────────────────────────────────────

/**
 * Get all patients with stored data
 */
export function getAllPatientsWithData() {
  try {
    const patients = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cognilert_profile_')) {
        const patientId = key.replace('cognilert_profile_', '');
        const profile = loadPatientProfile(patientId);
        
        if (profile) {
          // Get latest voice analyses
          const voiceAnalyses = loadVoiceAnalyses(patientId);
          
          patients.push({
            ...profile,
            latestVoiceAnalysis: voiceAnalyses[0] || null,
            voiceAnalysisCount: voiceAnalyses.length,
            totalAnalyses: voiceAnalyses.length
          });
        }
      }
    }
    
    // Sort by latest activity
    patients.sort((a, b) => {
      const aDate = a.latestVoiceAnalysis?.savedAt || a.createdAt;
      const bDate = b.latestVoiceAnalysis?.savedAt || b.createdAt;
      return new Date(bDate) - new Date(aDate);
    });
    
    return patients;
  } catch (error) {
    console.error('[VoiceStorage] Failed to get all patients:', error);
    return [];
  }
}

// ─────────────────────────────────────────────
// DATA EXPORT & BACKUP
// ─────────────────────────────────────────────

/**
 * Export all patient data as JSON
 */
export function exportAllPatientData() {
  try {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      patients: getAllPatientsWithData()
    };
    
    return exportData;
  } catch (error) {
    console.error('[VoiceStorage] Failed to export data:', error);
    return null;
  }
}

/**
 * Download export as JSON file
 */
export function downloadDataExport() {
  const exportData = exportAllPatientData();
  if (!exportData) return;
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cognilert_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('[VoiceStorage] Data export downloaded');
}

/**
 * Export patient data as CSV
 */
export function exportPatientDataAsCSV(patientId) {
  try {
    const voiceAnalyses = loadVoiceAnalyses(patientId);
    if (voiceAnalyses.length === 0) {
      console.warn('[VoiceStorage] No data to export for patient', patientId);
      return;
    }
    
    // CSV headers
    const headers = ['Date', 'Risk Score', 'Risk Level', 'Finding Count', 'Avg Speech Rate', 'Total Duration', 'Total Pauses', 'Avg Energy'];
    
    // CSV rows
    const rows = voiceAnalyses.map(analysis => [
      formatTimestampForDisplay(parseTimestamp(analysis.filename)),
      analysis.riskScore,
      analysis.riskLabel,
      analysis.findingCount,
      analysis.metrics?.avgSpeechRate || 0,
      analysis.metrics?.totalDuration || 0,
      analysis.metrics?.totalPauses || 0,
      analysis.metrics?.avgEnergy || 0
    ]);
    
    // Build CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient_${patientId}_voice_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[VoiceStorage] CSV export downloaded');
  } catch (error) {
    console.error('[VoiceStorage] Failed to export CSV:', error);
  }
}

// ─────────────────────────────────────────────
// DATA CLEANUP & MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Clear all data for a patient
 */
export function clearPatientData(patientId) {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith(`cognilert_profile_${patientId}`) ||
        key.startsWith(`cognilert_voice_${patientId}_`) ||
        key.startsWith(`cognilert_index_${patientId}_`)
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`[VoiceStorage] Cleared ${keysToRemove.length} entries for patient ${patientId}`);
    return keysToRemove.length;
  } catch (error) {
    console.error(`[VoiceStorage] Failed to clear data for patient ${patientId}:`, error);
    return 0;
  }
}

/**
 * Clear all CogniLert data
 */
export function clearAllCogniLertData() {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cognilert_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`[VoiceStorage] Cleared all ${keysToRemove.length} CogniLert entries`);
    return keysToRemove.length;
  } catch (error) {
    console.error('[VoiceStorage] Failed to clear all data:', error);
    return 0;
  }
}

// ─────────────────────────────────────────────
// STATISTICS & ANALYTICS
// ─────────────────────────────────────────────

/**
 * Get storage statistics
 */
export function getStorageStats() {
  try {
    const patients = getAllPatientsWithData();
    const totalAnalyses = patients.reduce((sum, p) => sum + p.totalAnalyses, 0);
    const totalVoiceAnalyses = patients.reduce((sum, p) => sum + p.voiceAnalysisCount, 0);
    
    // Calculate storage size
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cognilert_')) {
        totalSize += localStorage.getItem(key).length;
      }
    }
    
    return {
      totalPatients: patients.length,
      totalAnalyses,
      voiceAnalyses: totalVoiceAnalyses,
      storageSizeBytes: totalSize,
      storageSizeKB: Math.round(totalSize / 1024),
      patients
    };
  } catch (error) {
    console.error('[VoiceStorage] Failed to get storage stats:', error);
    return null;
  }
}

/**
 * Get risk distribution across all patients
 */
export function getRiskDistribution() {
  try {
    const patients = getAllPatientsWithData();
    const distribution = {
      HIGH: 0,
      MODERATE: 0,
      LOW: 0
    };
    
    patients.forEach(patient => {
      if (patient.latestVoiceAnalysis?.riskLabel) {
        distribution[patient.latestVoiceAnalysis.riskLabel]++;
      }
    });
    
    return distribution;
  } catch (error) {
    console.error('[VoiceStorage] Failed to get risk distribution:', error);
    return { HIGH: 0, MODERATE: 0, LOW: 0 };
  }
}