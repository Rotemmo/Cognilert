/**
 * VoiceAnalyzer Class
 * Extracts voice features from audio (pitch, energy, speech rate, hesitations)
 */
export class VoiceAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  /**
   * Create or get audio context
   * @returns {AudioContext}
   */
  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Decode audio blob to AudioBuffer
   * @param {Blob} audioBlob
   * @returns {Promise<AudioBuffer>}
   */
  async decodeAudio(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error("Audio decode error:", error);
      throw error;
    }
  }

  /**
   * Analyze energy levels in audio
   * @param {AudioBuffer} audioBuffer
   * @returns {object} energy metrics
   */
  analyzeEnergy(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    let sumSquares = 0;

    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i];
    }

    const rms = Math.sqrt(sumSquares / data.length);
    const db = 20 * Math.log10(Math.max(rms, 1e-6));

    return {
      rms: Math.round(rms * 1000) / 1000,
      decibels: Math.round(db * 10) / 10,
    };
  }

  /**
   * Detect pauses/hesitations in audio
   * @param {AudioBuffer} audioBuffer
   * @returns {object} pause metrics
   */
  analyzeHesitations(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const threshold = 0.02; // Energy threshold for silence
    const minSilenceDuration = 0.5; // seconds
    const minSilenceSamples = minSilenceDuration * sampleRate;

    let pauses = [];
    let isInPause = false;
    let pauseStart = 0;

    for (let i = 0; i < data.length; i++) {
      const energy = Math.abs(data[i]);

      if (energy < threshold && !isInPause) {
        pauseStart = i / sampleRate;
        isInPause = true;
      } else if (energy >= threshold && isInPause) {
        const pauseDuration = i / sampleRate - pauseStart;
        if (pauseDuration >= minSilenceDuration) {
          pauses.push({
            startTime: pauseStart,
            duration: pauseDuration,
          });
        }
        isInPause = false;
      }
    }

    return {
      pauseCount: pauses.length,
      totalPauseDuration: pauses.reduce((sum, p) => sum + p.duration, 0),
      averagePauseDuration: pauses.length > 0 
        ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length 
        : 0,
      pauses,
    };
  }

  /**
   * Estimate speech rate (approximate)
   * @param {number} audioBufferDuration - duration in seconds
   * @param {number} transcriptionLength - word count
   * @returns {object} speech rate metrics
   */
  analyzeSpeechRate(audioBufferDuration, transcriptionLength) {
    const wordsPerSecond = transcriptionLength / Math.max(audioBufferDuration, 1);
    const wordsPerMinute = Math.round(wordsPerSecond * 60);

    return {
      wordsPerMinute,
      wordsPerSecond: Math.round(wordsPerSecond * 100) / 100,
    };
  }

  /**
   * Comprehensive voice analysis
   * @param {Blob} audioBlob
   * @param {string} transcription - transcribed text
   * @returns {Promise<object>} complete voice metrics
   */
  async analyzeComplete(audioBlob, transcription = "") {
    try {
      const audioBuffer = await this.decodeAudio(audioBlob);
      const duration = audioBuffer.duration;
      const wordCount = transcription.split(/\s+/).filter(w => w.length > 0).length;

      const energy = this.analyzeEnergy(audioBuffer);
      const hesitations = this.analyzeHesitations(audioBuffer);
      const speechRate = this.analyzeSpeechRate(duration, wordCount);

      return {
        duration: Math.round(duration * 100) / 100,
        energy,
        hesitations,
        speechRate,
        wordCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Voice analysis error:", error);
      throw error;
    }
  }

  /**
   * Calculate risk indicators based on voice analysis
   * @param {object} voiceMetrics - from analyzeComplete
   * @returns {object} risk indicators (0-1 scale)
   */
  calculateRiskIndicators(voiceMetrics) {
    // Risk factors (0-1, where 1 is worst)
    const hesitationRisk = Math.min(
      voiceMetrics.hesitations.pauseCount / 5, // More than 5 pauses = high risk
      1
    );

    const slowSpeechRisk = Math.max(
      0,
      (100 - voiceMetrics.speechRate.wordsPerMinute) / 100
    ); // Normal is 100-150 wpm

    const lowEnergyRisk = Math.max(
      0,
      (-30 - voiceMetrics.energy.decibels) / 30 // Very quiet = risk
    );

    const shortDurationRisk = voiceMetrics.duration < 5 ? 0.3 : 0; // Too short answer

    return {
      hesitation: Math.min(hesitationRisk, 1),
      slowSpeech: Math.min(slowSpeechRisk, 1),
      lowEnergy: Math.min(lowEnergyRisk, 1),
      shortResponse: shortDurationRisk,
      overall: (hesitationRisk + slowSpeechRisk + lowEnergyRisk + shortDurationRisk) / 4,
    };
  }
}
