import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import collegeRoutes from "./routes/colleges.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

globalThis.mongoConnected = false;

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI College Query Chatbot API",
    database: globalThis.mongoConnected ? "connected" : "not connected",
    ai: process.env.GEMINI_API_KEY ? "Gemini configured" : "demo mode"
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/auth", authRoutes);

app.use((error, _req, res, _next) => {
  console.error("Unhandled server error:", error.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      globalThis.mongoConnected = true;
      console.log("MongoDB connected.");
    } catch (error) {
      console.warn(`MongoDB unavailable (${error.message}). Starting without saved chat history.`);
    }
  } else {
    console.warn("MONGODB_URI is not set. Chat history will not be saved.");
  }

  app.listen(PORT, () => {
    console.log(`Chatbot API running at http://localhost:${PORT}`);
    console.log(`AI mode: ${process.env.GEMINI_API_KEY ? "Gemini API" : "demo replies"}`);
  });
}

start();