import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { VoiceRecorder } from "../voice/recorder";
import { Transcriber } from "../voice/transcriber";
import { VoiceAnalyzer } from "../voice/analyzer";
import { AIAgent } from "../ai/agent";

/**
 * VoiceCheckIn Component
 * Orchestrates voice recording, transcription, analysis, and AI conversation
 */
export function VoiceCheckIn({ patient, onComplete }) {
  // ─────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────
  const [stage, setStage] = useState("idle"); // idle | recording | processing | displaying | complete
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [voiceMetrics, setVoiceMetrics] = useState(null);
  const [riskIndicators, setRiskIndicators] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs
  const recorderRef = useRef(null);
  const transcriberRef = useRef(null);
  const analyzerRef = useRef(null);
  const agentRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const allMetricsRef = useRef([]);

  // ─────────────────────────────────────────────
  // Initialize on mount
  // ─────────────────────────────────────────────
  useEffect(() => {
    recorderRef.current = new VoiceRecorder();
    transcriberRef.current = new Transcriber();
    analyzerRef.current = new VoiceAnalyzer();
    agentRef.current = new AIAgent(patient);

    const initialQ = agentRef.current.initialQuestion;
    setCurrentQuestion(initialQ);
    agentRef.current.addMessage("AI", initialQ);
    setConversationHistory([{ role: "AI", text: initialQ }]);

    return () => {
      // Cleanup
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [patient]);

  // ─────────────────────────────────────────────
  // Recording Timer
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  /**
   * Start recording
   */
  async function handleStartRecord() {
    try {
      setError(null);
      const success = await recorderRef.current.start();
      if (success) {
        setIsRecording(true);
        setStage("recording");
      } else {
        setError("Unable to access microphone. Please check permissions and try again.");
      }
    } catch (err) {
      setError(`Recording error: ${err.message}`);
    }
  }

  /**
   * Stop recording and process
   */
  async function handleStopRecord() {
    try {
      setIsRecording(false);
      setStage("processing");
      setLoading(true);
      setError(null);

      // Get audio blob
      const audioBlob = await recorderRef.current.stop();
      console.log("Audio recorded:", audioBlob.size, "bytes");

      // Transcribe
      console.log("Transcribing...");
      const transcribedText = await transcriberRef.current.transcribe(audioBlob);
      setTranscript(transcribedText || "[Could not understand - please repeat]");
      console.log("Transcription:", transcribedText);

      // Analyze voice
      console.log("Analyzing voice...");
      const metrics = await analyzerRef.current.analyzeComplete(
        audioBlob,
        transcribedText
      );
      setVoiceMetrics(metrics);

      // Calculate risk indicators
      const risks = analyzerRef.current.calculateRiskIndicators(metrics);
      setRiskIndicators(risks);

      // Store metrics
      allMetricsRef.current.push({
        questionNumber: questionCount + 1,
        ...metrics,
        riskIndicators: risks,
      });

      // Analyze answer with AI
      const answerAnalysis = agentRef.current.analyzeAnswer(transcribedText);
      console.log("Answer analysis:", answerAnalysis);

      // Add to history
      agentRef.current.addMessage("Patient", transcribedText);
      setConversationHistory((prev) => [
        ...prev,
        { role: "Patient", text: transcribedText },
      ]);

      // Generate next question
      const nextQ = agentRef.current.generateNextQuestion(transcribedText);
      setQuestionCount((prev) => prev + 1);

      if (nextQ) {
        // More questions
        setCurrentQuestion(nextQ);
        agentRef.current.addMessage("AI", nextQ);
        setConversationHistory((prev) => [...prev, { role: "AI", text: nextQ }]);
        setStage("displaying");
      } else {
        // End conversation
        setStage("complete");
        handleSaveResults();
      }

      setLoading(false);
    } catch (err) {
      setError(`Processing error: ${err.message}`);
      setLoading(false);
      console.error(err);
    }
  }

  /**
   * Continue to next question
   */
  function handleContinue() {
    setTranscript("");
    setVoiceMetrics(null);
    setRiskIndicators(null);
    setStage("idle");
  }

  /**
   * Save results to patient record
   */
  function handleSaveResults() {
    const summary = agentRef.current.getSummary();
    console.log("Check-in complete:", summary);
    console.log("All voice metrics:", allMetricsRef.current);

    if (onComplete) {
      onComplete({
        aiLog: summary.conversation,
        voiceMetrics: allMetricsRef.current,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─────────────────────────────────────────────
  // UI Rendering
  // ─────────────────────────────────────────────

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white rounded-xl border border-blue-100 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Mic size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Daily Cognitive Check-in
          </p>
          <p className="text-xs text-gray-400">
            {questionCount} of 4 questions
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Current Question */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-400 mb-2">🤖 AI Agent</p>
        <p className="text-base text-gray-800 font-medium leading-relaxed">
          {currentQuestion}
        </p>
      </div>

      {/* Recording/Processing Area */}
      {stage === "idle" && questionCount < 4 && (
        <div className="space-y-3">
          <button
            onClick={handleStartRecord}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-lg flex items-center justify-center gap-2 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Mic size={18} />
            {loading ? "Loading..." : "Start Recording"}
          </button>
        </div>
      )}

      {stage === "recording" && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-red-700">
                Recording...
              </span>
            </div>
            <span className="text-sm font-mono text-red-600">
              {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:
              {String(recordingDuration % 60).padStart(2, "0")}
            </span>
          </div>

          <button
            onClick={handleStopRecord}
            disabled={loading}
            className="w-full bg-red-600 text-white py-4 rounded-lg flex items-center justify-center gap-2 font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Square size={18} />
            Stop Recording
          </button>
        </div>
      )}

      {stage === "processing" && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-center gap-2">
            <Loader size={18} className="text-blue-600 animate-spin" />
            <span className="text-sm font-semibold text-blue-700">
              Processing your response...
            </span>
          </div>
        </div>
      )}

      {/* Transcript Display */}
      {stage === "displaying" && transcript && (
        <div className="space-y-3">
          {/* Transcription */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-semibold text-gray-400 mb-2">
              Your Response
            </p>
            <p className="text-base text-gray-800">{transcript}</p>
          </div>

          {/* Continue Button */}
          {questionCount < 4 ? (
            <button
              onClick={handleContinue}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Next Question →
            </button>
          ) : null}
        </div>
      )}

      {/* Complete Screen */}
      {stage === "complete" && (
        <div className="space-y-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200 flex items-center justify-center gap-2">
            <CheckCircle size={20} className="text-green-600" />
            <p className="text-sm font-semibold text-green-700">
              Check-in Complete! ✓
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-2">
            <p className="text-xs font-semibold text-gray-700 uppercase">
              Summary
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>✓ {allMetricsRef.current.length} questions analyzed</p>
              <p>✓ Total duration: {allMetricsRef.current.reduce((sum, m) => sum + m.duration, 0).toFixed(1)}s</p>
              <p>✓ Average speech rate: {Math.round(allMetricsRef.current.reduce((sum, m) => sum + m.speechRate.wordsPerMinute, 0) / allMetricsRef.current.length)} WPM</p>
            </div>
          </div>

          {/* Voice Metrics Summary */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase">
              Voice Metrics Overview
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allMetricsRef.current.map((m, i) => (
                <div key={i} className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xs text-gray-500">Q{i + 1}</p>
                  <p className="text-sm font-semibold text-gray-800">{m.duration.toFixed(1)}s</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Indicators Summary */}
          {allMetricsRef.current.length > 0 && allMetricsRef.current[0].riskIndicators && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase">
                Cognitive Indicators
              </p>
              <div className="space-y-1.5">
                {Object.entries(allMetricsRef.current[0].riskIndicators).map(([key, value]) => {
                  if (key === "overall") return null;
                  const avgValue = allMetricsRef.current.reduce((sum, m) => sum + (m.riskIndicators[key] || 0), 0) / allMetricsRef.current.length;
                  const percentage = Math.round(avgValue * 100);
                  const color =
                    percentage < 30
                      ? "bg-green-200"
                      : percentage < 60
                        ? "bg-yellow-200"
                        : "bg-red-200";

                  const labels = {
                    hesitation: "Hesitations",
                    slowSpeech: "Pace (Slow)",
                    lowEnergy: "Energy (Low)",
                    shortResponse: "Response Length"
                  };

                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 capitalize">
                          {labels[key] || key}
                        </span>
                        <span className="font-semibold text-gray-700">
                          {percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`${color} h-1.5 rounded-full`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setStage("idle");
              setQuestionCount(0);
              setConversationHistory([]);
              allMetricsRef.current = [];
              agentRef.current.reset();
              const initialQ = agentRef.current.initialQuestion;
              setCurrentQuestion(initialQ);
              setConversationHistory([{ role: "AI", text: initialQ }]);
            }}
            className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-1">
        <div
          className="bg-blue-600 h-1 rounded-full transition-all duration-300"
          style={{ width: `${(questionCount / 4) * 100}%` }}
        />
      </div>
    </div>
  );
}
