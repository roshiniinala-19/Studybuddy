
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Check server status
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(apiKey),
  });
});

// Generate quiz
app.post("/api/quiz", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    const topic = String(req.body.topic || "").trim();
    const difficulty = String(
      req.body.difficulty || "medium"
    ).toLowerCase();
    const count = Number(req.body.count ?? 5);

    if (!topic || topic.length > 200) {
      return res.status(400).json({
        error: "Enter a topic up to 200 characters long.",
      });
    }

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        error: "Difficulty must be easy, medium, or hard.",
      });
    }

    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return res.status(400).json({
        error: "Choose between 1 and 10 questions.",
      });
    }

    const prompt = `
Create exactly ${count} multiple-choice quiz questions
specifically about this topic: "${topic}".

Difficulty: ${difficulty}

Requirements:
- Questions must genuinely test the requested topic.
- Make questions educational and age-appropriate.
- Each question must have exactly four options.
- There must be exactly one correct option.
- The answer must be the zero-based index: 0, 1, 2, or 3.
- Include a short explanation.
- Return only valid JSON, with no Markdown.

Use this exact structure:
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
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    let result;

    try {
      result = JSON.parse(response.text);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }

    if (
      !result ||
      !Array.isArray(result.questions) ||
      result.questions.length !== count
    ) {
      throw new Error(
        `Gemini did not return exactly ${count} questions.`
      );
    }

    for (const q of result.questions) {
      if (
        typeof q.question !== "string" ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        !q.options.every(
          (option) => typeof option === "string"
        ) ||
        !Number.isInteger(q.answer) ||
        q.answer < 0 ||
        q.answer > 3
      ) {
        throw new Error("Gemini returned an incorrectly formatted question.");
      }

      if (typeof q.explanation !== "string") {
        q.explanation = "";
      }
    }

    return res.json({
      topic,
      difficulty,
      questions: result.questions,
    });
  } catch (error) {
    console.error("Quiz generation failed:", error);

    return res.status(502).json({
      error: "Quiz generation failed.",
      details: error.message || "Unknown error",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StudyBuddy running on port ${PORT}`);
});
