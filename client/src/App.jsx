import { useEffect, useRef, useState } from "react";
import {
  GraduationCap, MessageCircle, Landmark, BookOpen, FileText, CircleHelp,
  UserRound, Zap, Star, Send, Paperclip, Menu, X, Bot, RotateCcw, Sparkles
} from "lucide-react";
import ProfilePanel from "./components/ProfilePanel.jsx";

const quickQuestions = [
  "Which colleges can I get with my rank?",
  "What is the fee structure of MCA?",
  "What is the admission process?",
  "Best colleges for BCA / MCA?",
  "How can I find scholarships?",
  "What hostel facilities should I check?",
  "What are the top 5 colleges in Bhopal?"
];

const navItems = [
  { label: "Chat", icon: MessageCircle, question: null },
  { label: "Colleges", icon: Landmark, question: "Suggest ways to compare colleges for BCA and MCA." },
  { label: "Courses", icon: BookOpen, question: "What courses can I study after BCA?" },
  { label: "Admissions", icon: FileText, question: "Explain the general college admission process." },
  { label: "FAQs", icon: CircleHelp, question: "Give me frequently asked questions about college admissions." },
  { label: "Profile", icon: UserRound, question: null }
];

function timeNow() {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function MessageText({ content }) {
  // Simple readable rendering for line breaks and numbered/bullet lists from the assistant.
  const lines = String(content || "").split("\n");
  return (
    <div className="message-copy">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="line-gap" key={index} />;
        if (/^\d+\.\s/.test(trimmed)) {
          return <div className="list-line" key={index}><span>{trimmed.match(/^\d+/)[0]}.</span>{trimmed.replace(/^\d+\.\s*/, "")}</div>;
        }
        if (/^[-•]\s?/.test(trimmed)) {
          return <div className="list-line bullet-line" key={index}><span>•</span>{trimmed.replace(/^[-•]\s?/, "")}</div>;
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [activeView, setActiveView] = useState("chat");
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const conversationRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem("college-chat-token");
    if (!token) return;

    let active = true;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Session expired.");
        if (active) {
          setAuthToken(token);
          setUser(data.user);
        }
      })
      .catch(() => {
        sessionStorage.removeItem("college-chat-token");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendQuestion(text = question) {
    const cleaned = text.trim();
    if (!cleaned || loading) return;

    const userMessage = { role: "user", content: cleaned, time: timeNow() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion("");
    setLoading(true);
    setStatus("");
    setMobileNavOpen(false);

    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: cleaned,
          history: nextMessages.slice(-12).map(({ role, content, collegeIds, rankPrompt }) => ({
            role,
            content,
            ...(collegeIds ? { collegeIds } : {}),
            ...(rankPrompt ? { rankPrompt: true } : {})
          }))
        })
      });
      const data = await response.json().catch(() => null);
      if (!data) {
        throw new Error(`The backend returned an invalid response (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(data.error || "The chatbot could not answer right now.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          time: timeNow(),
          demo: data.mode === "demo",
          sources: data.sources || [],
          collegeIds: data.collegeIds || [],
          rankPrompt: data.rankPrompt === true
        }
      ]);
      if (data.warning) {
        setStatus(data.warning);
      } else if (data.mode === "demo") {
        setStatus("Demo mode: add a Gemini API key in server/.env for AI-generated replies.");
      }
    } catch (error) {
      const content = error.name === "AbortError"
        ? "The chatbot request timed out. Gemini may be taking longer than usual; please try again in a moment."
        : error instanceof TypeError && /fetch/i.test(error.message)
          ? "Sorry, I couldn't connect to the chatbot server. Make sure the backend is running on port 5000.\n\nStart it with `cd server` and `npm run dev`, then open the frontend at http://localhost:5173."
          : `Chatbot error: ${error.message || "An unexpected error occurred."}`;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content,
          time: timeNow(),
          error: true
        }
      ]);
    } finally {
      clearTimeout(requestTimeout);
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function resetChat() {
    setMessages([]);
    setStatus("New chat started. Ask a college-related question below.");
    inputRef.current?.focus();
  }

  function handleAuthenticated(data) {
    sessionStorage.setItem("college-chat-token", data.token);
    setAuthToken(data.token);
    setUser(data.user);
  }

  function handleLogout() {
    sessionStorage.removeItem("college-chat-token");
    setAuthToken("");
    setUser(null);
    setActiveView("profile");
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={43} strokeWidth={1.8} /></div>
          <h1>College Query<br />Chatbot</h1>
          <button className="close-nav" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <p className="tagline">Ask <span>•</span> Get Answers <span>•</span> Plan Your Future</p>
        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon, question: navQuestion }) => (
            <button
              key={label}
              className={`nav-item ${(label === "Profile" ? activeView === "profile" : activeView === "chat" && label === "Chat") ? "active" : ""}`}
              onClick={() => {
                setMobileNavOpen(false);
                if (label === "Profile") setActiveView("profile");
                else if (label === "Chat") setActiveView("chat");
                else if (navQuestion) {
                  setActiveView("chat");
                  sendQuestion(navQuestion);
                }
              }}
            >
              <Icon size={22} strokeWidth={1.8} /><span>{label === "Profile" && user ? user.name : label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <GraduationCap size={35} strokeWidth={1.5} />
          <div>Your College Journey<br /><strong>Starts Here</strong><i /></div>
        </div>
      </aside>

      <main className={activeView === "profile" ? "profile-main" : "chat-area"}>
        {activeView === "profile" ? (
          <ProfilePanel
            user={user}
            token={authToken}
            onAuthenticated={handleAuthenticated}
            onUserUpdated={setUser}
            onLogout={handleLogout}
          />
        ) : (
          <>
        <header className="chat-header">
          <button className="menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={23} /></button>
          <div className="bot-avatar large"><span className="antenna" /><Bot size={47} strokeWidth={1.8} /></div>
          <div className="header-copy">
            <div className="hello-pill">Hi!</div>
            <h2>AI College Query Chatbot</h2>
            <p>Hi! I'm your AI assistant. Ask me anything about colleges,<br className="desktop-only" /> courses, admissions, fees, and more.</p>
          </div>
          <button className="reset-button" onClick={resetChat} title="Start a new chat" aria-label="Start a new chat"><RotateCcw size={18} /></button>
        </header>

        <section className="conversation" ref={conversationRef} aria-live="polite">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Sparkles size={25} /></div>
              <h3>How can I help with your college journey?</h3>
              <p>Ask about courses, admission steps, fees, scholarships, or campus facilities.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={`message-row ${message.role === "user" ? "user-row" : "bot-row"}`} key={`${index}-${message.time}`}>
              {message.role !== "user" && <div className="bot-avatar small"><Bot size={23} /></div>}
              <div className={`message ${message.role === "user" ? "user-message" : "bot-message"} ${message.error ? "error-message" : ""}`}>
                <MessageText content={message.content} />
                {message.sources?.length > 0 && (
                  <div className="message-sources">
                    <strong>Sources</strong>
                    {message.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                    ))}
                  </div>
                )}
                <small>{message.time || timeNow()}{message.role === "user" && <span className="checks"> ✓✓</span>}</small>
              </div>
              {message.role === "user" && <div className="user-avatar"><UserRound size={17} /></div>}
            </div>
          ))}
          {loading && (
            <div className="message-row bot-row">
              <div className="bot-avatar small"><Bot size={23} /></div>
              <div className="message bot-message typing"><span /><span /><span /><em>Thinking...</em></div>
            </div>
          )}
        </section>

        <form className="composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}>
          <Paperclip className="attach-icon" size={22} />
          <input ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Type your question here..." aria-label="Type your question" />
          <button className="send-button" type="submit" disabled={loading || !question.trim()} aria-label="Send message"><Send size={20} /></button>
        </form>
        <div className="chat-footer">
          {status && <span className="status-note">{status}</span>}
          <span>AI guidance can be inaccurate. Verify important details with official sources.</span>
        </div>
          </>
        )}
      </main>

      {activeView === "chat" && <aside className="right-panel">
        <section className="panel quick-panel">
          <h2><Zap size={25} fill="currentColor" /> Quick Questions</h2>
          <div className="quick-list">
            {quickQuestions.map((item) => <button key={item} onClick={() => sendQuestion(item)} disabled={loading}>{item}<span>›</span></button>)}
          </div>
        </section>
        <section className="panel features-panel">
          <h2><Star size={24} fill="currentColor" /> Features</h2>
          <ul>
            <li>Instant answers to college queries</li>
            <li>Information on courses, fees, admissions</li>
            <li>Helpful guidance and next steps</li>
            <li>User-friendly and easy to use</li>
            <li>Available anytime in this demo</li>
          </ul>
        </section>
        <section className="promo">
          <div className="promo-cap"><GraduationCap size={33} /></div>
          <p>Get the right guidance<br />for a brighter future</p>
          <div className="book-stack" aria-hidden="true"><i /><i /><i /></div>
        </section>
        <p className="right-note">Built for students exploring their next step.</p>
      </aside>}
    </div>
  );
}