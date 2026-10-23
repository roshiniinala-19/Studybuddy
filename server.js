
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
app.use(express.static(path.join(__dirname, "public")));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(apiKey)
  });
});

app.post("/api/quiz", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is not configured on the server."
      });
    }

    const topic = String(req.body?.topic || "").trim();
    const difficulty = String(req.body?.difficulty || "medium").trim();
    const count = Math.min(
      10,
      Math.max(1, Number.parseInt(req.body?.count, 10) || 5)
    );

    if (!topic) {
      return res.status(400).json({
        error: "Please enter a topic for your quiz."
      });
    }

    const prompt = `
You are StudyBuddy, an accurate educational quiz generator.

Create exactly ${count} multiple-choice questions about this specific topic:
"${topic}"

Difficulty: ${difficulty}

Requirements:
- Every question must directly test the requested topic.
- Do not substitute general-knowledge questions.
- Do not change the topic.
- Give exactly four answer choices per question.
- Include exactly one correct answer per question.
- Make incorrect options plausible.
- Include a short explanation for each answer.
- Do not invent facts.
- Return valid JSON only, with no Markdown fences.

Use this exact JSON structure:
{
  "topic": "${topic.replace(/"/g, '\\"')}",
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "The exact text of the correct option",
      "explanation": "Brief explanation"
    }
  ]
}

Return exactly ${count} questions.
`;

    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3
      }
    });

    const rawText = result.text;

    if (!rawText) {
      throw new Error("Gemini returned an empty response.");
    }

    let quiz;

    try {
      quiz = JSON.parse(rawText);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try again.");
    }

    if (
      !quiz ||
      !Array.isArray(quiz.questions) ||
      quiz.questions.length !== count
    ) {
      throw new Error("The AI did not return the requested number of questions.");
    }

    for (const question of quiz.questions) {
      if (
        typeof question.question !== "string" ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        typeof question.answer !== "string" ||
        !question.options.includes(question.answer)
      ) {
        throw new Error("The AI returned an invalid question. Please try again.");
      }
    }

    return res.json({
      topic,
      questions: quiz.questions,
      fallback: false
    });
  } catch (error) {
    console.error("Quiz generation failed:", error);

    return res.status(502).json({
      error: "Could not generate a topic-specific quiz. Please try again.",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StudyBuddy server running on port ${PORT}`);
});
