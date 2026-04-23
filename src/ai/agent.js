/**
 * AIAgent Class
 * Handles conversation flow and logic for generating next questions
 * Currently uses mock/rule-based logic (no API calls)
 */
export class AIAgent {
  constructor(patient = null) {
    this.patient = patient; // patient object from PATIENTS[]
    this.conversationHistory = [];
    this.questionCount = 0;
    this.maxQuestions = 4;

    // Initial greeting
    this.initialQuestion = this.getInitialQuestion();
  }

  /**
   * Get initial question based on patient context
   * @returns {string}
   */
  getInitialQuestion() {
    if (!this.patient) {
      return "Hello, how are you feeling today?";
    }

    const dayPost = this.patient.dayPost || 1;
    if (dayPost <= 2) {
      return "Hi there! How are you doing today? Any pain or discomfort?";
    } else if (dayPost <= 7) {
      return "Good morning! How did you sleep last night? How are you feeling today?";
    } else {
      return "Hello! How are you feeling today? How's your recovery going?";
    }
  }

  /**
   * Add message to conversation history
   * @param {string} role - 'AI' or 'Patient'
   * @param {string} text - message text
   */
  addMessage(role, text) {
    this.conversationHistory.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generate next question based on patient's last answer
   * Rule-based logic for demo with improved branching
   * @param {string} lastAnswer - patient's previous answer
   * @returns {string|null} next question or null if max questions reached
   */
  generateNextQuestion(lastAnswer) {
    this.questionCount++;
    
    console.log(`[AIAgent] Q${this.questionCount} answer analysis:`, {
      answer: lastAnswer,
      questionCount: this.questionCount
    });

    if (this.questionCount >= this.maxQuestions) {
      console.log("[AIAgent] Max questions reached. Ending conversation.");
      return null; // End conversation
    }

    const answer = lastAnswer.toLowerCase();

    // Question 1 → Question 2 (about pain/symptoms)
    if (this.questionCount === 1) {
      // Keywords: pain, hurt, ache, problem, bad, worse, discomfort, struggle, difficulty
      if (/pain|hurt|ache|problem|bad|worse|discomfort|struggle|difficult/.test(answer)) {
        console.log("[AIAgent] Q2: Pain detected → asking pain severity");
        return "I understand. On a scale of 1 to 10, how would you rate your pain?";
      } 
      // Keywords: good, well, fine, great, okay, ok, well, better, improving, great, excellent
      else if (/good|well|fine|great|okay|better|improving|excellent|nice/.test(answer)) {
        console.log("[AIAgent] Q2: Positive feedback → asking about sleep");
        return "That's great to hear! Did you have a good night's sleep?";
      } 
      // Neutral responses - ask for clarification or move to sleep
      else {
        console.log("[AIAgent] Q2: Neutral → asking for more detail");
        return "Can you tell me a bit more about how you're feeling right now?";
      }
    }

    // Question 2 → Question 3 (about medication/routine)
    if (this.questionCount === 2) {
      // Keywords about sleep
      if (/sleep|hours|hour|night|rest|slept|bed|wake/.test(answer)) {
        console.log("[AIAgent] Q3: Sleep-related answer → asking about meds");
        return "Good! Did you remember to take your medications this morning?";
      } 
      // Keywords about pain from Q2
      else if (/pain|hurt|ache|severe|bad/.test(answer)) {
        console.log("[AIAgent] Q3: Pain answer → asking about meds");
        return "Thank you. Did you take your medications this morning?";
      }
      // Default
      else {
        console.log("[AIAgent] Q3: Neutral → asking about meds");
        return "That's helpful to know. Did you take your medications this morning?";
      }
    }

    // Question 3 → Question 4 (orientation/cognitive)
    if (this.questionCount === 3) {
      // Keywords: yes, took, did, remembered, yes
      if (/yes|took|remember|took|medication|did|prescription/.test(answer)) {
        console.log("[AIAgent] Q4: Meds taken → asking about date/day");
        return "Excellent! One last question: do you remember what day of the week it is today?";
      } 
      // Keywords: no, didn't, forget, forgot
      else if (/no|didn't|forgot|forget|haven't|not|nope/.test(answer)) {
        console.log("[AIAgent] Q4: Meds not taken → asking about date/day");
        return "No problem. Can you tell me what today's date or day of the week is?";
      } 
      // Neutral
      else {
        console.log("[AIAgent] Q4: Neutral → asking about date/day");
        return "Can you tell me what day of the week it is today?";
      }
    }

    return null;
  }

  /**
   * Analyze patient's answer for cognitive flags
   * @param {string} answer
   * @returns {object} analysis result
   */
  analyzeAnswer(answer) {
    const flags = {
      coherent: true,
      hesitant: false,
      confused: false,
      concerningPatterns: [],
    };

    // Simple pattern matching for concerns
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

    // Repetition detection (simple)
    const words = answer.split(" ");
    const wordFreq = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    const repetition = Object.values(wordFreq).some((count) => count > 3);
    if (repetition) {
      flags.concerningPatterns.push("Repetitive words");
    }

    return flags;
  }

  /**
   * Get conversation summary
   * @returns {object}
   */
  getSummary() {
    return {
      totalQuestions: this.questionCount,
      totalMessages: this.conversationHistory.length,
      conversation: this.conversationHistory,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset conversation
   */
  reset() {
    this.conversationHistory = [];
    this.questionCount = 0;
    this.initialQuestion = this.getInitialQuestion();
  }
}
