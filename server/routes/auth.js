import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { normalizeAvatar, normalizeLogin, normalizeRegistration } from "../utils/auth.js";

const router = Router();
const attempts = new Map();

function requireAuthConfiguration(res) {
  if (!globalThis.mongoConnected) {
    res.status(503).json({ error: "Accounts are unavailable until the database is connected." });
    return false;
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    res.status(503).json({ error: "Account login is not configured. Set a JWT_SECRET of at least 32 characters in server/.env." });
    return false;
  }
  return true;
}

function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || "unknown";
  const windowMs = 15 * 60 * 1000;
  const maximum = 10;
  const previous = attempts.get(address);
  const current = !previous || now - previous.startedAt >= windowMs
    ? { startedAt: now, count: 0 }
    : previous;

  if (current.count >= maximum) {
    return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  }

  current.count += 1;
  attempts.set(address, current);
  if (attempts.size > 1000) {
    for (const [key, value] of attempts) {
      if (now - value.startedAt >= windowMs) attempts.delete(key);
    }
  }
  return next();
}

function createToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: "1d", issuer: "college-query-chatbot" }
  );
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar || "blue"
  };
}

function handleValidationError(error, res, next) {
  if (error instanceof Error && error.name === "ValidationError") {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  return next(error);
}

function handleInputError(error, res, next) {
  if (error instanceof Error) return res.status(400).json({ error: error.message });
  return next(error);
}

function authenticate(req, res, next) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    return res.status(503).json({ error: "Account login is not configured on the server." });
  }
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "college-query-chatbot"
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
    }
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

router.post("/register", limitAuthAttempts, async (req, res, next) => {
  if (!requireAuthConfiguration(res)) return;
  let registration;
  try {
    registration = normalizeRegistration(req.body);
  } catch (error) {
    return handleInputError(error, res, next);
  }
  try {
    const { name, email, password } = registration;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    return res.status(201).json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    return handleValidationError(error, res, next);
  }
});

router.post("/login", limitAuthAttempts, async (req, res, next) => {
  if (!requireAuthConfiguration(res)) return;
  let credentials;
  try {
    credentials = normalizeLogin(req.body);
  } catch (error) {
    return handleInputError(error, res, next);
  }
  try {
    const { email, password } = credentials;
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    return res.json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Account no longer exists. Please sign in again." });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/profile", authenticate, async (req, res, next) => {
  try {
    const updates = {};
    if (Object.hasOwn(req.body || {}, "name")) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({ error: "Name must be between 2 and 80 characters." });
      }
      updates.name = name;
    }
    if (Object.hasOwn(req.body || {}, "avatar")) {
      try {
        updates.avatar = normalizeAvatar(req.body.avatar);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "There are no profile changes to save." });
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, {
      new: true,
      runValidators: true
    });
    if (!user) return res.status(404).json({ error: "Account not found." });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
