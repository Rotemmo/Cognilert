/**
 * Transcriber Class
 * Handles speech-to-text using Google Cloud Speech API
 */
export class Transcriber {
  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_CLOUD_SPEECH_API_KEY;
    if (!this.apiKey) {
      console.warn("Google Cloud Speech API key not found in .env.local");
    }
  }

  /**
   * Convert audio blob to base64
   * @param {Blob} audioBlob - audio data
   * @returns {Promise<string>} base64 encoded audio
   */
  async blobToBase64(audioBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Transcribe audio to text using Google Cloud Speech API
   * @param {Blob} audioBlob - audio data (webm format)
   * @param {string} language - language code (default: 'en-US' for English)
   * @returns {Promise<string>} transcribed text
   */
  async transcribe(audioBlob, language = 'en-US') {
    try {
      if (!this.apiKey) {
        throw new Error("Google Cloud Speech API key not configured");
      }

      const base64Audio = await this.blobToBase64(audioBlob);

      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: {
              encoding: 'WEBM_OPUS',
              languageCode: language,
              enableAutomaticPunctuation: true,
              model: 'default',
            },
            audio: {
              content: base64Audio,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Cloud Speech API error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json();

      if (!result.results || result.results.length === 0) {
        return ""; // No speech detected
      }

      // Combine all transcription results
      const transcript = result.results
        .map((r) => r.alternatives[0]?.transcript || "")
        .join(" ");

      return transcript;
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    }
  }

  /**
   * Test if API is configured correctly
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        console.warn("API key not configured");
        return false;
      }
      // Make a minimal test request
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: { encoding: 'LINEAR16', languageCode: 'he-IL' },
            audio: { content: '' },
          }),
        }
      );
      return response.status < 500; // If not 500+ error, connection works
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }
}
