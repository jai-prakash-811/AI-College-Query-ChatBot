# AI College Query Chatbot (MERN)

A responsive college-help chatbot inspired by the supplied mockup. Built with React + Vite, Node.js + Express, MongoDB/Mongoose, and the Google Gemini API.

## Features
- Responsive three-column dashboard with sidebar, chat, quick questions, and feature cards.
- AI answers for college, courses, admissions, fees, scholarships, hostel, and rank-related questions through Google Gemini.
- MongoDB persistence for chat messages (optional for local demo; configured by `MONGODB_URI`).
- Chat answers grounded in saved, source-verified Bhopal college records.
- Source-linked, academic-year-specific tuition records. The chatbot does not guess missing fees.
- Email/password signup and login with a personal profile, editable name, preset avatars, and photo upload.
- API key kept on the backend in `.env`; it is never placed in React code.
- English guide replies for common admissions, fees, scholarships, hostel, and BCA/MCA college questions; these remain available if the AI service is unavailable.
- Demo fallback replies if the AI key is not configured.

## Requirements
- Node.js 20+
- npm
- MongoDB connection string for account signup/login, profiles, and saved chat history
- Optional: a Google Gemini API key for AI-generated replies (API usage may be billable)

## Folder structure
```text
ai-college-query-chatbot-mern/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── models/Chat.js, User.js
│   ├── routes/auth.js, chat.js, colleges.js
│   ├── .env.example
│   ├── package.json
│   └── index.js
└── README.md
```

## 1. Open in VS Code
Extract this ZIP, then VS Code → File → Open Folder → choose `ai-college-query-chatbot-mern`.

## 2. Configure backend
Open a terminal in VS Code:
```bash
cd server
npm install
```
Copy `.env.example` to `.env`. For live AI replies, add a Gemini API key:
```env
PORT=5000
MONGODB_URI=
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=models/gemini-3.8-flash
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=
```
- Get an API key from Google AI Studio and add it only to `server/.env`.
- For MongoDB Atlas, use your Atlas connection string as `MONGODB_URI`.
- If MongoDB is unavailable, the API still starts, but accounts and saved chat history are unavailable.
- If `GEMINI_API_KEY` is missing, the chatbot uses built-in demo replies; no API key is needed to test the connection.
- Generate a JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and set it as `JWT_SECRET` in `server/.env`. Keep it private; changing it signs out existing sessions.
- MongoDB is required for signup, login, profiles, and avatar storage.

Start backend:
```bash
npm run dev
```
Backend runs at `http://localhost:5000`.
Keep this terminal running. Check that the backend responds by opening `http://localhost:5000/api/health`.

## 3. Configure frontend
Open a second terminal:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally `http://localhost:5173`).
Keep this terminal running too. In local development, Vite forwards `/api` requests to the backend on port 5000.

## Deploy to Vercel

The root `vercel.json` configures `client` and `server` as separate Vercel services. Import the repository as a multi-service project from the repository root; do not set a single service root directory.

Set these environment variables for the **server** service in Vercel:
- `MONGODB_URI` — MongoDB Atlas connection string.
- `GEMINI_API_KEY` — optional; without it the chatbot uses demo replies.
- `GEMINI_MODEL` — optional; defaults to `models/gemini-3.8-flash`.
- `JWT_SECRET` — a private random value of at least 32 characters.
- `CLIENT_ORIGIN` — the exact deployed frontend origin, such as `https://your-project.vercel.app`.

The browser sends `/api` requests to the same Vercel domain; Vercel routes those requests internally to the server service. No service-to-service binding is needed. Keep `.env` files and secret values out of GitHub.

## 4. Test it
Ask questions such as:
- What should I check before choosing an MCA college?
- Explain the general admission process.
- What costs should I include in a college fee budget?
- How can I find scholarships?
- What are the top 5 colleges in Bhopal?
- Bhopal ke top 5 colleges kaun se hain?

Open **Profile** in the sidebar to create an account with your name, email, and password, or sign in to an existing account. Once signed in, you can update your display name, choose a preset avatar, upload a photo, and sign out. The app stores the session token for the current browser session only.

## 5. Ask about Bhopal colleges

Use the Chat screen to ask about Bhopal colleges, fees, study details, placements, or rank-based options. Follow-up questions can refer to colleges already mentioned in the conversation.

The college data setup screen and college-data write APIs have been removed. Existing MongoDB college records remain available to the chatbot.

The application does not ship with a general college dataset. Bhopal-specific answers use saved records, display their source links, and say when details are missing. The Bhopal top-five question returns a fixed introductory list with official college website links; verify ranking claims and current details before relying on them. Rank-based suggestions require matching official cutoff records; the chatbot will not invent fees, placement figures, or cutoffs.

## Important
- This project is an educational starter, not an official college-admissions source.
- The AI can make mistakes. Verify admission dates, eligibility, seat availability, fees, and counselling rules on official college / government websites.
- Never commit `.env` or expose API keys in frontend code.
- Gemini API billing and quotas are managed separately through Google AI Studio.
