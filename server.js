
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
    aiConfigured: Boolean(apiKey),
  });
});

app.post("/api/quiz", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing from the environment.",
      });
    }

    const topic = String(req.body.topic || "").trim();
    const difficulty = String(
      req.body.difficulty || "medium"
    ).trim();

    const requestedCount = Number.parseInt(req.body.count, 10);
    const count = Number.isInteger(requestedCount)
      ? Math.min(10, Math.max(1, requestedCount))
      : 5;

    if (!topic) {
      return res.status(400).json({
        error: "Please enter a topic.",
      });
    }

    const prompt = `
Create exactly ${count} multiple-choice quiz questions.

Topic: ${topic}
Difficulty: ${difficulty}

Rules:
- Every question must be specifically about the topic above.
- Do not substitute generic questions.
- Each question must have exactly four distinct options.
- There must be exactly one correct answer from those options.
- Include a short explanation.
- Do not add introductory text.

Return only valid JSON using this structure:
{
  "topic": "the requested topic",
  "questions": [
    {
      "question": "Question text",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "answer": "Exact text of the correct option",
      "explanation": "Short explanation"
    }
  ]
}
`;

    // Allow time for Gemini to respond, then return a clear error.
    const timeout = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Quiz generation timed out. Please retry.")),
        40000
      );
    });

    const generation = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const response = await Promise.race([generation, timeout]);

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    let quiz;

    try {
      quiz = JSON.parse(response.text);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try again.");
    }

    if (
      !quiz ||
      !Array.isArray(quiz.questions) ||
      quiz.questions.length !== count
    ) {
      throw new Error(
        `Gemini did not return exactly ${count} questions. Please retry.`
      );
    }

    for (const item of quiz.questions) {
      if (
        typeof item.question !== "string" ||
        !Array.isArray(item.options) ||
        item.options.length !== 4 ||
        !item.options.every((option) => typeof option === "string") ||
        typeof item.answer !== "string" ||
        !item.options.includes(item.answer)
      ) {
        throw new Error("Gemini returned a question with an invalid format.");
      }

      if (typeof item.explanation !== "string") {
        item.explanation = "";
      }
    }

    return res.json({
      topic,
      difficulty,
      questions: quiz.questions,
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
  console.log(`StudyBuddy server running on port ${PORT}`);
});
