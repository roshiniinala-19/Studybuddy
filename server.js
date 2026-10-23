
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// General-knowledge backup questions for when the AI service is unavailable.
const fallbackQuestions = [
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: 1,
    explanation: "Mars appears reddish because of iron oxide on its surface."
  },
  {
    question: "Which process allows plants to make food using sunlight?",
    options: ["Respiration", "Digestion", "Photosynthesis", "Fermentation"],
    answer: 2,
    explanation: "Photosynthesis uses light energy to make sugars."
  },
  {
    question: "What is 12 × 8?",
    options: ["84", "88", "96", "108"],
    answer: 2,
    explanation: "12 multiplied by 8 equals 96."
  },
  {
    question: "Which gas do humans need to breathe to survive?",
    options: ["Oxygen", "Helium", "Hydrogen", "Neon"],
    answer: 0,
    explanation: "The body uses oxygen for cellular respiration."
  },
  {
    question: "How many sides does a hexagon have?",
    options: ["Five", "Six", "Seven", "Eight"],
    answer: 1,
    explanation: "A hexagon is a polygon with six sides."
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: 3,
    explanation: "The Pacific Ocean is the largest ocean on Earth."
  },
  {
    question: "Which part of a plant usually absorbs water from the soil?",
    options: ["Flower", "Leaf", "Root", "Fruit"],
    answer: 2,
    explanation: "Roots absorb water and minerals from the soil."
  },
  {
    question: "What is the chemical formula for water?",
    options: ["CO2", "H2O", "O2", "NaCl"],
    answer: 1,
    explanation: "A water molecule contains two hydrogen atoms and one oxygen atom."
  },
  {
    question: "Which instrument measures temperature?",
    options: ["Barometer", "Compass", "Thermometer", "Ruler"],
    answer: 2,
    explanation: "A thermometer measures temperature."
  },
  {
    question: "What is 15 + 27?",
    options: ["32", "40", "42", "45"],
    answer: 2,
    explanation: "15 plus 27 equals 42."
  }
];

function isValidQuiz(result, count) {
  return (
    result &&
    Array.isArray(result.questions) &&
    result.questions.length === count &&
    result.questions.every(
      (q) =>
        q &&
        typeof q.question === "string" &&
        q.question.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((option) => typeof option === "string") &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4 &&
        typeof q.explanation === "string"
    )
  );
}

function makeFallbackQuiz(count) {
  return {
    questions: fallbackQuestions.slice(0, count),
    fallback: true,
    message:
      "AI generation is temporarily unavailable. These are general-knowledge sample questions, not questions generated for your selected topic."
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(apiKey)
  });
});

app.post("/api/quiz", async (req, res) => {
  const topic = String(req.body?.topic || "").trim();
  const subject = String(req.body?.subject || "").trim();
  const difficulty = String(req.body?.difficulty || "medium").toLowerCase();
  const count = Number(req.body?.count || 5);

  if (!topic || topic.length > 200) {
    return res.status(400).json({
      error: "Enter a topic up to 200 characters long."
    });
  }

  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return res.status(400).json({
      error: "Choose easy, medium, or hard difficulty."
    });
  }

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return res.status(400).json({
      error: "Choose between 1 and 10 questions."
    });
  }

  // Without an API key, return a usable sample quiz.
  if (!ai) {
    return res.json(makeFallbackQuiz(count));
  }

  const prompt = `
Create exactly ${count} multiple-choice quiz questions.

Subject: ${subject || "General"}
Topic: ${topic}
Difficulty: ${difficulty}

Make the questions educational, accurate, age-appropriate, and specific
to the requested topic and difficulty.

Return only valid JSON in this exact structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Brief explanation"
    }
  ]
}

Rules:
- Return exactly ${count} questions.
- Each question must have exactly four distinct options.
- Exactly one option must be correct.
- "answer" must be the zero-based index (0, 1, 2, or 3).
- Include a brief, accurate explanation.
- Do not include Markdown or text outside the JSON.
`;

  // Limit the total time spent waiting for the AI response.
  const deadline = Date.now() + 45000;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();

    if (remaining <= 0) break;

    let timeoutId;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("AI_REQUEST_TIMEOUT")),
          remaining
        );
      });

      const aiPromise = ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const response = await Promise.race([aiPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const result = JSON.parse(response.text);

      if (!isValidQuiz(result, count)) {
        throw new Error("The AI returned an invalid quiz format.");
      }

      return res.json({
        ...result,
        fallback: false
      });
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      console.error(
        `Quiz generation attempt ${attempt} failed:`,
        error.message
      );

      if (attempt < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  console.error(
    "AI quiz generation failed; returning backup questions:",
    lastError?.message || "Time limit reached"
  );

  return res.json(makeFallbackQuiz(count));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StudyBuddy running on port ${PORT}`);
});
