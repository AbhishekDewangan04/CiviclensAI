import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, LogIn, ShieldCheck, UserPlus, X } from "lucide-react";

const TABS = [
  { id: "signin", label: "Sign In", icon: LogIn, title: "Welcome back", subtitle: "Sign in to track and manage your reports." },
  { id: "signup", label: "Create Account", icon: UserPlus, title: "Join CivicLens", subtitle: "Create an account to report and follow civic issues." },
  { id: "admin", label: "Admin Portal", icon: ShieldCheck, title: "Admin Portal", subtitle: "For city officials and moderators only." },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERS_STORAGE_KEY = "civiclens_registered_users";

const DEMO_USER = { email: "demo@civiclens.app", password: "demo1234", name: "Demo Citizen", role: "citizen" };
const DEMO_ADMIN = { email: "admin@civiclens.app", password: "admin1234", name: "Admin Officer", role: "admin" };

const EMPTY_VALUES = { name: "", email: "", password: "" };

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [DEMO_USER];
  } catch {
    return [DEMO_USER];
  }
}

function saveUser(user) {
  try {
    const existing = getStoredUsers();
    const updated = [...existing.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase()), user];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist user registration", err);
  }
}

const inputClass = (hasError) =>
  `w-full rounded-xl border bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none transition focus:border-emerald-500/60 ${
    hasError ? "border-rose-500/60" : "border-white/10"
  }`;

function Field({ id, label, type = "text", value, onChange, error, placeholder, autoComplete, inputRef }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium text-white/80">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(Boolean(error))}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

function AuthPanel({ initialTab, onClose, onAuthSuccess }) {
  const uid = useId();
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  const [tab, setTab] = useState(initialTab);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  const switchTab = (nextTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setValues(EMPTY_VALUES);
    setErrors({});
    setFormError("");
  };

  const setField = (field) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
    setFormError("");
  };

  const validate = () => {
    const next = {};
    const email = values.email.trim();

    if (tab === "signup" && !values.name.trim()) next.name = "Please enter your name.";
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";

    if (!values.password) next.password = "Password is required.";
    else if (tab === "signup" && values.password.length < 6) next.password = "Use at least 6 characters.";

    return next;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError("");
      return;
    }

    const email = values.email.trim().toLowerCase();
    const password = values.password;

    // Admin Portal
    if (tab === "admin") {
      if (email !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
        setValues((prev) => ({ ...prev, password: "" }));
        setFormError("Invalid admin credentials. Use the demo admin login shown below.");
        return;
      }
      onAuthSuccess({ name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, role: "admin" });
      onClose();
      return;
    }

    // Create Account
    if (tab === "signup") {
      const users = getStoredUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) {
        setFormError("An account with this email already exists. Please sign in instead.");
        return;
      }

      const newUser = {
        name: values.name.trim(),
        email,
        password,
        role: "citizen",
      };

      saveUser(newUser);
      onAuthSuccess({ name: newUser.name, email: newUser.email, role: "citizen" });
      onClose();
      return;
    }

    // Sign In (Strict credential matching)
    if (tab === "signin") {
      const users = getStoredUsers();
      const matchedUser = users.find((u) => u.email.toLowerCase() === email);

      if (!matchedUser || matchedUser.password !== password) {
        setValues((prev) => ({ ...prev, password: "" }));
        setFormError("Incorrect email or password. Verify your details or create an account.");
        return;
      }

      onAuthSuccess({ name: matchedUser.name, email: matchedUser.email, role: matchedUser.role || "citizen" });
      onClose();
    }
  };

  const fillDemo = () => {
    const creds = tab === "admin" ? DEMO_ADMIN : DEMO_USER;
    setValues({ name: creds.name || "", email: creds.email, password: creds.password });
    setErrors({});
    setFormError("");
  };

  const HeaderIcon = activeTab.icon;

  const modal = (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#061410] p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15">
            <HeaderIcon className="h-7 w-7 text-emerald-400" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-2xl font-bold tracking-tight text-white">
            {activeTab.title}
          </h2>
          <p id={descId} className="mt-2 text-sm text-white/55">
            {activeTab.subtitle}
          </p>
        </div>

        <div role="tablist" aria-label="Authentication options" className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/40 p-1">
          {TABS.map((t) => {
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                onClick={() => switchTab(t.id)}
                className={`rounded-xl px-2 py-2 text-[11.5px] font-semibold transition ${
                  selected
                    ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                    : "border border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <form
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${tab}`}
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4"
        >
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-[12.5px] text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {tab === "signup" && (
            <Field
              id={`${uid}-name`}
              label="Full name"
              value={values.name}
              onChange={setField("name")}
              error={errors.name}
              placeholder="Your name"
              autoComplete="name"
              inputRef={firstFieldRef}
            />
          )}

          <Field
            id={`${uid}-email`}
            label="Email"
            type="email"
            value={values.email}
            onChange={setField("email")}
            error={errors.email}
            placeholder="you@example.com"
            autoComplete="email"
            inputRef={tab === "signup" ? undefined : firstFieldRef}
          />

          <Field
            id={`${uid}-password`}
            label="Password"
            type="password"
            value={values.password}
            onChange={setField("password")}
            error={errors.password}
            placeholder="••••••••"
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-[#04140E] transition hover:bg-emerald-400"
          >
            {tab === "signup" ? "Create account" : tab === "admin" ? "Enter admin portal" : "Sign in"}
          </button>
        </form>

        {tab !== "signup" && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] text-white/55">
            <p className="font-medium text-white/70">Demo mode credentials</p>
            <p className="mt-1 font-mono text-[11.5px] text-emerald-300/80">
              {tab === "admin" ? `${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}` : `${DEMO_USER.email} / ${DEMO_USER.password}`}
            </p>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-2 text-[12px] font-semibold text-emerald-400 transition hover:text-emerald-300"
            >
              Fill demo credentials
            </button>
          </div>
        )}

        <p className="mt-5 text-center text-sm text-white/50">
          {tab === "signin" && (
            <>
              New here?{" "}
              <button type="button" onClick={() => switchTab("signup")} className="font-semibold text-emerald-400 hover:text-emerald-300">
                Create an account
              </button>
            </>
          )}
          {tab === "signup" && (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchTab("signin")} className="font-semibold text-emerald-400 hover:text-emerald-300">
                Sign in
              </button>
            </>
          )}
          {tab === "admin" && (
            <>
              Not an admin?{" "}
              <button type="button" onClick={() => switchTab("signin")} className="font-semibold text-emerald-400 hover:text-emerald-300">
                Back to sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function AuthLayout({ isOpen = false, onClose, onAuthSuccess, initialTab = "signin" }) {
  if (!isOpen || typeof document === "undefined") return null;

  return (
    <AuthPanel
      initialTab={TABS.some((t) => t.id === initialTab) ? initialTab : "signin"}
      onClose={onClose || (() => {})}
      onAuthSuccess={onAuthSuccess || (() => {})}
    />
  );
}