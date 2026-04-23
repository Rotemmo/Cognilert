/**
 * VoiceRecorder Class
 * Handles audio recording using Web Audio API
 */
export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
  }

  /**
   * Start recording audio from microphone
   * @returns {Promise<boolean>} true if recording started, false if permission denied
   */
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error("Microphone access denied or unavailable:", error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop recording and return audio blob
   * @returns {Promise<Blob>} audio blob in webm format
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No recording in progress"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.audioChunks = [];

        // Stop microphone tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }

        this.isRecording = false;
        resolve(audioBlob);
      };

      this.mediaRecorder.onerror = (error) => {
        this.isRecording = false;
        reject(error);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if currently recording
   * @returns {boolean}
   */
  getIsRecording() {
    return this.isRecording;
  }

  /**
   * Get duration of recording (approximate)
   * @returns {number} duration in milliseconds
   */
  getDuration() {
    if (!this.mediaRecorder) return 0;
    return this.mediaRecorder.stream?.active ? Date.now() : 0;
  }
}
