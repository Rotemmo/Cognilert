#!/usr/bin/env node

/**
 * CogniLert Data Manager CLI
 * 
 * A utility script to manage and inspect exported patient data files
 * 
 * Usage:
 *   node scripts/manageData.js list              - List all data files
 *   node scripts/manageData.js view <file>       - View data from a file
 *   node scripts/manageData.js stats             - Show storage stats
 *   node scripts/manageData.js validate <file>   - Validate data structure
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function getDataFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }
    return fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  } catch (error) {
    console.error("Error reading data directory:", error);
    return [];
  }
}

function readDataFile(filename) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    const data = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return null;
  }
}

function validateData(data) {
  const errors = [];
  
  if (!data.patientId && !data.analyses) {
    errors.push("Missing patientId or analyses field");
  }
  
  if (data.voice) {
    if (!data.voice.riskScore) errors.push("Missing voice.riskScore");
    if (!data.voice.metrics) errors.push("Missing voice.metrics");
  }
  
  if (data.analyses && Array.isArray(data.analyses)) {
    data.analyses.forEach((a, i) => {
      if (!a.patientId) errors.push(`analyses[${i}]: Missing patientId`);
      if (!a.type) errors.push(`analyses[${i}]: Missing type`);
      if (!a.riskScore) errors.push(`analyses[${i}]: Missing riskScore`);
    });
  }
  
  return errors;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ─────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────

function cmdList() {
  console.log("\n📋 Data Files in /data:");
  const files = getDataFiles();
  
  if (files.length === 0) {
    console.log("   No data files found yet.\n");
    return;
  }
  
  files.forEach(f => {
    const filepath = path.join(DATA_DIR, f);
    const stat = fs.statSync(filepath);
    console.log(`   • ${f}`);
    console.log(`     Size: ${formatBytes(stat.size)} | Modified: ${stat.mtime.toLocaleString()}`);
  });
  console.log("");
}

function cmdView(filename) {
  if (!filename) {
    console.error("❌ Please provide a filename: node scripts/manageData.js view <filename>");
    return;
  }
  
  const data = readDataFile(filename);
  if (!data) return;
  
  console.log(`\n📖 Content of ${filename}:\n`);
  console.log(JSON.stringify(data, null, 2));
  console.log("");
}

function cmdStats() {
  const files = getDataFiles();
  let totalSize = 0;
  let voiceCount = 0;
  let hrCount = 0;
  const patients = new Set();
  
  files.forEach(f => {
    const filepath = path.join(DATA_DIR, f);
    const stat = fs.statSync(filepath);
    totalSize += stat.size;
    
    const data = readDataFile(f);
    if (data) {
      if (data.voice) voiceCount++;
      if (data.heartRate) hrCount++;
      if (data.patientId) patients.add(data.patientId);
      if (data.analyses) {
        data.analyses.forEach(a => {
          if (a.type === "voice") voiceCount++;
          if (a.type === "heartRate") hrCount++;
          patients.add(a.patientId);
        });
      }
    }
  });
  
  console.log(`\n📊 Storage Statistics:\n`);
  console.log(`   Total files: ${files.length}`);
  console.log(`   Total size: ${formatBytes(totalSize)}`);
  console.log(`   Voice analyses: ${voiceCount}`);
  console.log(`   HR analyses: ${hrCount}`);
  console.log(`   Unique patients: ${patients.size}`);
  console.log(`   Data dir: ${DATA_DIR}\n`);
}

function cmdValidate(filename) {
  if (!filename) {
    console.error("❌ Please provide a filename: node scripts/manageData.js validate <filename>");
    return;
  }
  
  const data = readDataFile(filename);
  if (!data) return;
  
  const errors = validateData(data);
  
  console.log(`\n✓ Validating ${filename}:\n`);
  if (errors.length === 0) {
    console.log("   ✅ All validations passed!\n");
  } else {
    console.log("   ❌ Validation errors:\n");
    errors.forEach(e => console.log(`      • ${e}`));
    console.log("");
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "list":
    cmdList();
    break;
  case "view":
    cmdView(arg);
    break;
  case "stats":
    cmdStats();
    break;
  case "validate":
    cmdValidate(arg);
    break;
  default:
    console.log(`
🔧 CogniLert Data Manager CLI

Usage:
  node scripts/manageData.js list              - List all data files
  node scripts/manageData.js view <file>       - View data from a file
  node scripts/manageData.js stats             - Show storage statistics
  node scripts/manageData.js validate <file>   - Validate data structure

Example:
  node scripts/manageData.js list
  node scripts/manageData.js view example-patient-3-voice.json
  node scripts/manageData.js stats
    `);
}
