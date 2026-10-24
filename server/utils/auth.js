export const avatarPresets = ["blue", "purple", "green", "orange", "rose", "teal"];
export const maxAvatarLength = 300000;

export function normalizeRegistration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Enter your name, email, and password.");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < 2 || name.length > 80) {
    throw new Error("Name must be between 2 and 80 characters.");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters.");
  }

  return { name, email, password };
}

export function normalizeLogin(input) {
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      password.length < 1 || password.length > 128) {
    throw new Error("Enter a valid email and password.");
  }
  return { email, password };
}

export function normalizeAvatar(avatar) {
  if (typeof avatar !== "string") throw new Error("Choose an avatar or upload an image.");
  if (avatarPresets.includes(avatar)) return avatar;

  if (
    avatar.length <= maxAvatarLength &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)
  ) {
    return avatar;
  }
  throw new Error("Avatar must be a supported preset or a JPEG, PNG, or WebP image under 220 KB.");
}
