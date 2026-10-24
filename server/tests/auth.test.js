import test from "node:test";
import assert from "node:assert/strict";
import authRoutes from "../routes/auth.js";
import {
  avatarPresets,
  maxAvatarLength,
  normalizeAvatar,
  normalizeLogin,
  normalizeRegistration
} from "../utils/auth.js";

test("exports the Express authentication router", () => {
  assert.equal(typeof authRoutes, "function");
});

test("normalizes signup name and email while preserving the password", () => {
  assert.deepEqual(
    normalizeRegistration({ name: "  Alex Student ", email: " ALEX@example.com ", password: "password123" }),
    { name: "Alex Student", email: "alex@example.com", password: "password123" }
  );
});

test("rejects invalid signup fields", () => {
  assert.throws(() => normalizeRegistration(null), /name, email, and password/i);
  assert.throws(
    () => normalizeRegistration({ name: "A", email: "alex@example.com", password: "password123" }),
    /name must be between/i
  );
  assert.throws(
    () => normalizeRegistration({ name: "Alex", email: "not-an-email", password: "password123" }),
    /valid email/i
  );
  assert.throws(
    () => normalizeRegistration({ name: "Alex", email: "alex@example.com", password: "short" }),
    /password must be between/i
  );
});

test("normalizes login email and rejects invalid credentials", () => {
  assert.deepEqual(
    normalizeLogin({ email: " ALEX@example.com ", password: "password123" }),
    { email: "alex@example.com", password: "password123" }
  );
  assert.throws(() => normalizeLogin({ email: "invalid", password: "password123" }), /valid email/i);
  assert.throws(() => normalizeLogin({ email: "alex@example.com", password: "x".repeat(129) }), /valid email/i);
});

test("accepts known avatar presets and supported image data URLs", () => {
  assert.deepEqual(avatarPresets, ["blue", "purple", "green", "orange", "rose", "teal"]);
  assert.equal(normalizeAvatar("blue"), "blue");
  assert.equal(normalizeAvatar("data:image/jpeg;base64,AAAA"), "data:image/jpeg;base64,AAAA");
  assert.equal(normalizeAvatar("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(normalizeAvatar("data:image/webp;base64,AAAA"), "data:image/webp;base64,AAAA");
});

test("rejects unsupported and oversized avatar data URLs", () => {
  assert.throws(() => normalizeAvatar("not-an-avatar"), /supported preset/i);
  assert.throws(() => normalizeAvatar("data:image/svg+xml;base64,AAAA"), /supported preset/i);
  assert.throws(
    () => normalizeAvatar(`data:image/jpeg;base64,${"A".repeat(maxAvatarLength)}`),
    /under 220 KB/i
  );
});
