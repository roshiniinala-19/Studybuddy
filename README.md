# StudyBuddy

StudyBuddy is a web application I built to make studying a little more interactive. It uses Google's Gemini API to generate quiz questions based on a topic, so students can test their understanding while learning.

**Live website:** https://studybuddy-4hrz.onrender.com

## Features

- Generate quiz questions based on a topic
- Choose a difficulty level
- Answer questions and test your knowledge
- Track progress in the browser

## Technologies Used

- HTML, CSS and JavaScript
- Node.js and Express.js
- Google Gemini API
- GitHub and Render

## Getting Started

To run StudyBuddy on your computer, you need to have Node.js installed and a Google Gemini API key.

### 1. Clone the repository

```bash
git clone https://github.com/roshiniinala-19/Studybuddy.git
cd Studybuddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the API key

Create a `.env` file in the root folder and add your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Replace `your_gemini_api_key` with your own key. Keep it private and never upload the `.env` file to GitHub.

### 4. Run the app

```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Project Structure

```text
Studybuddy/
├── public/
│   ├── index.html
│   └── quiz.html
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## What I Learned

Building StudyBuddy helped me understand how a frontend connects to a backend, how to use an API in a web application, and how to deploy a project online.

## Future Improvements

Some things I'd like to add in the future are support for uploading study materials, more quiz options, and improved progress tracking.

---

Built as a learning project.
