import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  dangerouslyAllowBrowser: true,
});

export class AIAgent {
  constructor(patient = null) {
    this.patient = patient;
    this.conversationHistory = [];
    this.questionCount = 0;
    this.maxQuestions = 4;
    this.initialQuestion = this._buildInitialQuestion();

    // Rule tracking
    this.failedAttempts = 0;       // consecutive empty/unclear answers on current question
    this.maxFailedAttempts = 3;
    this.consecutiveShort = 0;     // consecutive hesitant/very-short answers
    this.sessionAlerts = [];       // alerts accumulated during the check-in
  }

  _buildInitialQuestion() {
    if (!this.patient) return "Hello, how are you feeling today?";
    const day = this.patient.dayPost || 1;
    if (day <= 2) return "Hi there! How are you doing today? Any pain or discomfort?";
    if (day <= 7) return "Good morning! How did you sleep last night? How are you feeling today?";
    return "Hello! How are you feeling today? How's your recovery going?";
  }

  _systemPrompt() {
    const p = this.patient;
    const patientContext = p
      ? `Patient: ${p.name}, age ${p.age}, day ${p.dayPost ?? "?"} post ${p.surgery ?? "surgery"}. Risk level: ${p.riskLevel ?? "unknown"}.`
      : "Patient context unavailable.";

    return `You are a clinical AI agent conducting a warm, natural daily check-in call with a post-surgical geriatric patient.
${patientContext}

Your goal across the conversation is to naturally cover: how they feel, sleep, medications, and orientation (day/date). Let the conversation flow — follow up on what the patient says rather than jumping to a new topic abruptly.

Rules:
- Output ONLY the next question. No preamble, no "Great!", no commentary.
- Read the conversation history carefully and do NOT repeat a question already asked.
- Keep questions short, warm, and plain — one sentence.
- After the patient has answered ${this.maxQuestions} questions, output exactly: DONE`;
  }

  addMessage(role, text) {
    this.conversationHistory.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  async generateNextQuestion(lastAnswer) {
    this.questionCount++;

    if (this.questionCount >= this.maxQuestions) {
      return null;
    }

    // Build messages for Groq from conversation history
    const messages = [{ role: "system", content: this._systemPrompt() }];

    for (const msg of this.conversationHistory) {
      messages.push({
        role: msg.role === "AI" ? "assistant" : "user",
        content: msg.text,
      });
    }

    // Add the latest patient answer if not already in history
    const lastInHistory = this.conversationHistory[this.conversationHistory.length - 1];
    if (!lastInHistory || lastInHistory.role !== "Patient" || lastInHistory.text !== lastAnswer) {
      messages.push({ role: "user", content: lastAnswer });
    }

    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 80,
        temperature: 0.5,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text || text === "DONE") return null;
      return text;
    } catch (err) {
      console.error("[AIAgent] Groq API error:", err?.message, err?.status, err);
      throw err;
    }
  }

  async analyzeConversationContent() {
    if (this.conversationHistory.length < 2) return [];

    const transcript = this.conversationHistory
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    const prompt = `You are a clinical cognitive analyst reviewing a post-surgical geriatric patient check-in. Flag only genuine cognitive concerns — not normal conversational hedging.

Transcript:
${transcript}

Return a JSON array of findings. Each finding: {"type": string, "description": string, "severity": 1|2}
severity 1 = mild concern, severity 2 = significant concern.

Only flag clear problems such as:
- Cannot recall if they took their medication
- Wrong or completely unknown day/date when asked directly
- Contradicting themselves within the same conversation
- Disoriented or incoherent responses unrelated to the question
- Repeating the exact same sentence or phrase multiple times

Do NOT flag: saying "I think", "maybe", "I'm not sure", slow speech, brief answers, or normal uncertainty in daily life.

If no genuine red flags, return [].
Return ONLY valid JSON, nothing else.`;

    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.2,
      });

      const raw = response.choices[0]?.message?.content?.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("[AIAgent] Content analysis error:", err);
      return [];
    }
  }

  /**
   * Evaluates an answer and returns what the agent should do next.
   * Returns: { action: "repeat" | "alert_and_end" | "continue", alert: object|null }
   */
  evaluateAnswer(transcribedText) {
    const isEmpty = !transcribedText || transcribedText.trim().length < 3 ||
      transcribedText.includes("[Could not understand");

    if (isEmpty) {
      this.failedAttempts++;
      if (this.failedAttempts >= this.maxFailedAttempts) {
        this.sessionAlerts.push({
          type: "NO_RESPONSE",
          severity: 4,
          description: `Patient did not respond to the same question after ${this.maxFailedAttempts} attempts`,
        });
        return { action: "alert_and_end", alert: this.sessionAlerts.at(-1) };
      }
      return { action: "repeat", alert: null };
    }

    // Got a real answer — reset failed attempts counter
    this.failedAttempts = 0;

    const flags = this.analyzeAnswer(transcribedText);

    if (flags.confused) {
      this.sessionAlerts.push({
        type: "INCOHERENT_RESPONSE",
        severity: 3,
        description: "Patient gave an incoherent or contradictory answer: " + flags.concerningPatterns.join(", "),
      });
    }

    if (flags.hesitant) {
      this.consecutiveShort++;
      if (this.consecutiveShort >= 2) {
        this.sessionAlerts.push({
          type: "MINIMAL_RESPONSES",
          severity: 2,
          description: `Patient gave very short answers for ${this.consecutiveShort} consecutive questions`,
        });
      }
    } else {
      this.consecutiveShort = 0;
    }

    if (flags.concerningPatterns.includes("Repetitive words")) {
      this.sessionAlerts.push({
        type: "REPETITIVE_SPEECH",
        severity: 3,
        description: "Repetitive word pattern detected in patient response",
      });
    }

    return { action: "continue", alert: this.sessionAlerts.at(-1) ?? null };
  }

  analyzeAnswer(answer) {
    const flags = {
      coherent: true,
      hesitant: false,
      confused: false,
      concerningPatterns: [],
    };

    if (answer.length < 3) {
      flags.hesitant = true;
      flags.concerningPatterns.push("Very brief response");
    }

    if (answer.includes("no") && answer.includes("yes") && answer.length < 20) {
      flags.confused = true;
      flags.concerningPatterns.push("Uncertainty or contradiction");
    }

    if (answer.split(" ").length > 50) {
      flags.concerningPatterns.push("Long or rambling response");
    }

    const words = answer.split(" ");
    const wordFreq = {};
    for (const word of words) wordFreq[word] = (wordFreq[word] || 0) + 1;
    if (Object.values(wordFreq).some((count) => count > 3)) {
      flags.concerningPatterns.push("Repetitive words");
    }

    return flags;
  }

  getSummary() {
    return {
      totalQuestions: this.questionCount,
      totalMessages: this.conversationHistory.length,
      conversation: this.conversationHistory,
      sessionAlerts: this.sessionAlerts,
      timestamp: new Date().toISOString(),
    };
  }

  reset() {
    this.conversationHistory = [];
    this.questionCount = 0;
    this.initialQuestion = this._buildInitialQuestion();
  }
}
