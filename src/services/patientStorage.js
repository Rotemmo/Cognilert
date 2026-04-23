/**
 * Patient Data Storage Service
 * 
 * Handles persistent storage of patient risk analysis data using browser localStorage.
 * Data survives page refreshes and can be aggregated later into overall risk scores.
 * 
 * Usage:
 *   import { saveVoiceAnalysis, loadPatientRisks, getAnalysisByPatient } from './patientStorage';
 *   
 *   // Save voice data
 *   saveVoiceAnalysis(patientId, voiceAnalysisObject);
 *   
 *   // Load all risk data for a patient
 *   const risks = loadPatientRisks(patientId);
 *   
 *   // Get all stored analyses
 *   const all = getAllStoredAnalyses();
 */

// ─────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────
const STORAGE_PREFIX = "cognilert_";
const VOICE_RISKS_KEY = (patientId) => `${STORAGE_PREFIX}patient_${patientId}_voice`;
const HR_RISKS_KEY = (patientId) => `${STORAGE_PREFIX}patient_${patientId}_heartRate`;
const PATIENT_INDEX_KEY = `${STORAGE_PREFIX}patient_index`;

/**
 * Save voice analysis data to localStorage
 * 
 * @param {number} patientId - patient ID
 * @param {Object} voiceAnalysis - output from analyzeVoiceMetrics()
 *   {riskScore, riskLabel, findings, findingCount, metrics, timestamp}
 */
export function saveVoiceAnalysis(patientId, voiceAnalysis) {
  try {
    const key = VOICE_RISKS_KEY(patientId);
    
    // Create timestamped entry
    const entry = {
      ...voiceAnalysis,
      patientId,
      savedAt: new Date().toISOString(),
      type: "voice"
    };
    
    // Save to localStorage
    localStorage.setItem(key, JSON.stringify(entry));
    
    // Update patient index (for later aggregation)
    updatePatientIndex(patientId, "voice");
    
    console.log(`[Storage] Voice analysis saved for patient ${patientId}:`, entry);
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save voice analysis for patient ${patientId}:`, error);
    return false;
  }
}

/**
 * Save heart rate analysis data to localStorage
 * 
 * @param {number} patientId - patient ID
 * @param {Object} hrAnalysis - output from HR analyzer
 */
export function saveHeartRateAnalysis(patientId, hrAnalysis) {
  try {
    const key = HR_RISKS_KEY(patientId);
    
    const entry = {
      ...hrAnalysis,
      patientId,
      savedAt: new Date().toISOString(),
      type: "heartRate"
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    updatePatientIndex(patientId, "heartRate");
    
    console.log(`[Storage] HR analysis saved for patient ${patientId}:`, entry);
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save HR analysis for patient ${patientId}:`, error);
    return false;
  }
}

/**
 * Load all risk data for a specific patient
 * 
 * @param {number} patientId - patient ID
 * @returns {Object} {voice, heartRate, motion, etc.}
 */
export function loadPatientRisks(patientId) {
  try {
    const risks = {
      voice: null,
      heartRate: null,
      motion: null,
      fineMotor: null
    };
    
    // Try to load voice data
    try {
      const voiceData = localStorage.getItem(VOICE_RISKS_KEY(patientId));
      if (voiceData) {
        risks.voice = JSON.parse(voiceData);
      }
    } catch (e) {
      console.warn(`[Storage] Failed to load voice data for patient ${patientId}:`, e);
    }
    
    // Try to load HR data
    try {
      const hrData = localStorage.getItem(HR_RISKS_KEY(patientId));
      if (hrData) {
        risks.heartRate = JSON.parse(hrData);
      }
    } catch (e) {
      console.warn(`[Storage] Failed to load HR data for patient ${patientId}:`, e);
    }
    
    return risks;
  } catch (error) {
    console.error(`[Storage] Failed to load risks for patient ${patientId}:`, error);
    return { voice: null, heartRate: null };
  }
}

/**
 * Get voice analysis for a patient
 * @param {number} patientId
 * @returns {Object|null}
 */
export function getVoiceAnalysis(patientId) {
  try {
    const data = localStorage.getItem(VOICE_RISKS_KEY(patientId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[Storage] Failed to get voice analysis for patient ${patientId}:`, error);
    return null;
  }
}

/**
 * Get heart rate analysis for a patient
 * @param {number} patientId
 * @returns {Object|null}
 */
export function getHeartRateAnalysis(patientId) {
  try {
    const data = localStorage.getItem(HR_RISKS_KEY(patientId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[Storage] Failed to get HR analysis for patient ${patientId}:`, error);
    return null;
  }
}

/**
 * Get all stored analyses across all patients
 * Useful for debugging or exporting data
 * 
 * @returns {Array} array of all stored analyses
 */
export function getAllStoredAnalyses() {
  try {
    const analyses = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data && data.type) {
            analyses.push({
              storageKey: key,
              ...data
            });
          }
        } catch (e) {
          console.warn(`[Storage] Failed to parse ${key}:`, e);
        }
      }
    }
    
    return analyses;
  } catch (error) {
    console.error("[Storage] Failed to get all analyses:", error);
    return [];
  }
}

/**
 * Clear data for a specific patient
 * @param {number} patientId
 */
export function clearPatientData(patientId) {
  try {
    localStorage.removeItem(VOICE_RISKS_KEY(patientId));
    localStorage.removeItem(HR_RISKS_KEY(patientId));
    console.log(`[Storage] Cleared all data for patient ${patientId}`);
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to clear data for patient ${patientId}:`, error);
    return false;
  }
}

/**
 * Clear all CogniLert data from localStorage
 * WARNING: This is destructive!
 */
export function clearAllData() {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[Storage] Cleared all CogniLert data (${keysToRemove.length} entries)`);
    return true;
  } catch (error) {
    console.error("[Storage] Failed to clear all data:", error);
    return false;
  }
}

/**
 * Update patient index for tracking which patients have stored data
 * @private
 */
function updatePatientIndex(patientId, dataType) {
  try {
    let index = {};
    const indexData = localStorage.getItem(PATIENT_INDEX_KEY);
    
    if (indexData) {
      index = JSON.parse(indexData);
    }
    
    if (!index[patientId]) {
      index[patientId] = { voice: false, heartRate: false };
    }
    
    if (dataType === "voice") {
      index[patientId].voice = new Date().toISOString();
    } else if (dataType === "heartRate") {
      index[patientId].heartRate = new Date().toISOString();
    }
    
    localStorage.setItem(PATIENT_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn("[Storage] Failed to update patient index:", error);
  }
}

/**
 * Get all patients that have stored data
 * @returns {Object} {patientId: {voice: timestamp, heartRate: timestamp}, ...}
 */
export function getPatientsWithData() {
  try {
    const indexData = localStorage.getItem(PATIENT_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : {};
  } catch (error) {
    console.warn("[Storage] Failed to get patients with data:", error);
    return {};
  }
}

/**
 * Hydrate patient objects with stored data from localStorage
 * Call this when app loads to restore data
 * 
 * @param {Array} patientsArray - PATIENTS array to hydrate
 * @returns {Array} updated patients array
 */
export function hydratePatients(patientsArray) {
  try {
    const updated = patientsArray.map(patient => {
      const stored = loadPatientRisks(patient.id);
      
      if (!patient.risks) {
        patient.risks = {};
      }
      
      if (stored.voice) {
        patient.risks.voice = stored.voice;
      }
      if (stored.heartRate) {
        patient.risks.heartRate = stored.heartRate;
      }
      
      return patient;
    });
    
    console.log("[Storage] Hydrated patients from localStorage");
    return updated;
  } catch (error) {
    console.error("[Storage] Failed to hydrate patients:", error);
    return patientsArray;
  }
}

/**
 * Export all data as JSON (for backup or analytics)
 * @returns {Object}
 */
export function exportAllData() {
  return {
    timestamp: new Date().toISOString(),
    analyses: getAllStoredAnalyses(),
    patientIndex: getPatientsWithData()
  };
}

/**
 * Debug helper - log storage stats
 */
export function logStorageStats() {
  console.log("=== localStorage Stats ===");
  console.log("Total items:", localStorage.length);
  console.log("CogniLert items:", Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX)).length);
  console.log("Storage space used:", JSON.stringify(localStorage).length, "bytes");
  console.log("Patients with data:", Object.keys(getPatientsWithData()));
  console.log("All analyses:", getAllStoredAnalyses());
}
