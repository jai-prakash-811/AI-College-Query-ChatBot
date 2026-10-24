import { useEffect, useRef, useState } from "react";
import {
  BookOpen, GraduationCap, Palette, ShieldCheck, Sparkles, Star, UserRound
} from "lucide-react";

const avatarPresets = [
  { id: "blue", label: "Blue", color: "#dcecff", icon: UserRound },
  { id: "purple", label: "Purple", color: "#eadfff", icon: Sparkles },
  { id: "green", label: "Green", color: "#d8f5e7", icon: GraduationCap },
  { id: "orange", label: "Orange", color: "#ffead5", icon: BookOpen },
  { id: "rose", label: "Rose", color: "#ffe0ea", icon: Star },
  { id: "teal", label: "Teal", color: "#d4f4f0", icon: Palette }
];

function Avatar({ avatar = "blue", size = "large" }) {
  const preset = avatarPresets.find((item) => item.id === avatar);
  if (!preset) {
    return <img className={`profile-avatar ${size}`} src={avatar} alt="Profile avatar" />;
  }
  const Icon = preset.icon;
  return (
    <span className={`profile-avatar ${size}`} style={{ backgroundColor: preset.color }}>
      <Icon size={size === "large" ? 34 : 20} aria-hidden="true" />
    </span>
  );
}

async function resizeAvatar(file) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const image = await createImageBitmap(file);
  if (image.width * image.height > 30_000_000) {
    image.close();
    throw new Error("This image is too large to process.");
  }
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("Your browser could not process this image.");
  }
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256
  );
  image.close();

  for (const quality of [0.82, 0.68, 0.52]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 220 * 1024) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("The selected image could not be read."));
        reader.readAsDataURL(blob);
      });
    }
  }
  throw new Error("Could not resize this image below 220 KB. Choose another image.");
}

export default function ProfilePanel({ user, token, onAuthenticated, onUserUpdated, onLogout }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(user?.name || "");
  const fileInput = useRef(null);

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.id, user?.name]);

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      onAuthenticated(data);
      setForm({ name: "", email: "", password: "" });
      setNotice(mode === "signup" ? "Account created. You're signed in." : "Welcome back.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(changes, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(changes)
      });
      onUserUpdated(data.user);
      setName(data.user.name);
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const avatar = await resizeAvatar(file);
      const data = await request("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatar })
      });
      onUserUpdated(data.user);
      setNotice("Profile photo updated.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-page">
      {!user ? (
        <div className="profile-card auth-card">
          <div className="profile-card-icon"><ShieldCheck size={25} /></div>
          <h2>{mode === "signup" ? "Create your account" : "Sign in to your account"}</h2>
          <p>Save your profile and personalize your avatar.</p>
          <form className="profile-form" onSubmit={submitAuth}>
            {mode === "signup" && (
              <label className="profile-field">
                <span>Full name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label className="profile-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label className="profile-field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : 1}
                maxLength={128}
                required
              />
              {mode === "signup" && <small>Use at least 8 characters.</small>}
            </label>
            <button className="profile-primary" disabled={busy}>
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="profile-switch">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      ) : (
        <div className="profile-card">
          <div className="profile-title-row">
            <div><h2>Your profile</h2><p>Manage your account details and avatar.</p></div>
            <button className="profile-secondary" type="button" onClick={onLogout}>Sign out</button>
          </div>
          <div className="profile-summary">
            <Avatar avatar={user.avatar} />
            <div><strong>{user.name}</strong><span>{user.email}</span></div>
          </div>
          <form className="profile-form profile-name-form" onSubmit={(event) => { event.preventDefault(); updateProfile({ name }, "Name updated."); }}>
            <label className="profile-field">
              <span>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
            </label>
            <label className="profile-field">
              <span>Email address</span>
              <input value={user.email} readOnly />
            </label>
            <button className="profile-primary" disabled={busy || name.trim() === user.name}>Save name</button>
          </form>
          <div className="avatar-section">
            <h3>Choose an avatar</h3>
            <p>Pick a color and icon, or upload a photo.</p>
            <div className="avatar-options">
              {avatarPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`avatar-option ${user.avatar === preset.id ? "selected" : ""}`}
                  aria-label={`${preset.label} avatar`}
                  aria-pressed={user.avatar === preset.id}
                  disabled={busy}
                  onClick={() => updateProfile({ avatar: preset.id }, "Avatar updated.")}
                >
                  <Avatar avatar={preset.id} size="small" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadAvatar}
            />
            <button className="profile-secondary" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
              Upload photo
            </button>
            <small className="profile-hint">JPEG, PNG, or WebP; resized to a square image under 220 KB.</small>
          </div>
        </div>
      )}
      {(error || notice) && <p className={error ? "profile-error" : "profile-success"} role="status">{error || notice}</p>}
    </section>
  );
}
