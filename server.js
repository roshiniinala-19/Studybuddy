
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("Please add your API key to the .env file.");
  process.exit(1);
}

const app = express();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(express.json());
app.use(express.static("."));

app.post("/api/quiz", async (req, res) => {
  try {
    const topic = String(req.body.topic || "").trim();
    const difficulty = String(req.body.difficulty || "medium");
    const count = Number(req.body.count || 5);

    if (!topic || topic.length > 200) {
      return res.status(400).json({
        error: "Enter a topic up to 200 characters long.",
      });
    }

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({ error: "Invalid difficulty." });
    }

    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return res.status(400).json({
        error: "Choose between 1 and 10 questions.",
      });
    }

    const prompt = `
Create exactly ${count} multiple-choice quiz questions about "${topic}".
Difficulty: ${difficulty}.
Make the questions educational and age-appropriate.
Return only JSON in this format:
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
The answer is the zero-based index of the correct option.
Each question must have exactly four options and one correct answer.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const result = JSON.parse(response.text);

    if (
      !Array.isArray(result.questions) ||
      result.questions.length !== count ||
      !result.questions.every(
        (q) =>
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((option) => typeof option === "string") &&
          Number.isInteger(q.answer) &&
          q.answer >= 0 &&
          q.answer < 4 &&
          typeof q.explanation === "string"
      )
    ) {
      throw new Error("Invalid quiz response.");
    }

    res.json(result);
  } catch (error) {
    console.error("Quiz generation failed:", error.message);
    res.status(500).json({
      error: "Quiz generation failed. Please check the server terminal.",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StudyBuddy running on port ${PORT}`);
});
