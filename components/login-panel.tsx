"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { allowedDomainsLabel, isAllowedEmail } from "@/lib/auth-config";

type Mode = "login" | "signup" | "reset";

const AUTH_COOLDOWN_MS = 15000;
const EMAIL_ACTION_COOLDOWN_MS = 60000;

function firebaseMessage(code?: string, fallback?: string) {
  switch (code) {
    case "auth/too-many-requests":
      return "Too many attempts were made. Please wait a few minutes before trying again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return fallback || "Something went wrong. Please try again.";
  }
}

export function LoginPanel() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [lastAuthAttemptAt, setLastAuthAttemptAt] = useState(0);
  const [lastEmailActionAt, setLastEmailActionAt] = useState(0);

  const allowedLabel = useMemo(() => allowedDomainsLabel(), []);
  const canSubmit =
    !busy && !!email.trim() && (mode === "reset" || !!password.trim());

  const remainingAuthCooldown = Math.max(
    0,
    AUTH_COOLDOWN_MS - (Date.now() - lastAuthAttemptAt)
  );
  const remainingEmailCooldown = Math.max(
    0,
    EMAIL_ACTION_COOLDOWN_MS - (Date.now() - lastEmailActionAt)
  );

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const enforceAllowedDomain = () => {
    if (!isAllowedEmail(email)) {
      throw new Error(`Only these email domains are allowed: ${allowedLabel}`);
    }
  };

  const enforceAuthCooldown = () => {
    if (remainingAuthCooldown > 0) {
      const seconds = Math.ceil(remainingAuthCooldown / 1000);
      throw new Error(`Please wait ${seconds}s before trying again.`);
    }
  };

  const enforceEmailCooldown = () => {
    if (remainingEmailCooldown > 0) {
      const seconds = Math.ceil(remainingEmailCooldown / 1000);
      throw new Error(`Please wait ${seconds}s before sending another email.`);
    }
  };

  const markAuthAttempt = () => setLastAuthAttemptAt(Date.now());
  const markEmailAction = () => setLastEmailActionAt(Date.now());

  const handleLogin = async () => {
    resetFeedback();

    try {
      enforceAllowedDomain();
      enforceAuthCooldown();

      setBusy(true);
      markAuthAttempt();

      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (!credential.user.emailVerified) {
        enforceEmailCooldown();
        await sendEmailVerification(credential.user, {
          url: process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
          handleCodeInApp: false,
        });
        markEmailAction();
        await signOut(auth);
        setMessage(
          "Your email is not verified yet. We sent a new verification email. Please verify your account before signing in."
        );
        return;
      }

      setMessage("Signed in successfully.");

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(firebaseMessage(err?.code, err?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    resetFeedback();

    try {
      enforceAllowedDomain();
      enforceAuthCooldown();
      enforceEmailCooldown();

      if (password.trim().length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      setBusy(true);
      markAuthAttempt();

      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (name.trim()) {
        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      }

      await sendEmailVerification(credential.user, {
        url: process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
        handleCodeInApp: false,
      });
      markEmailAction();

      await signOut(auth);

      setMessage(
        "Account created. A verification email has been sent. Please verify your email before signing in."
      );
      setMode("login");
      setPassword("");
    } catch (err: any) {
      setError(firebaseMessage(err?.code, err?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    resetFeedback();

    try {
      enforceAllowedDomain();
      enforceEmailCooldown();

      setBusy(true);

      await sendPasswordResetEmail(auth, email.trim(), {
        url: process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
        handleCodeInApp: false,
      });

      markEmailAction();
      setMessage("Password reset email sent. Please check your inbox.");
    } catch (err: any) {
      setError(firebaseMessage(err?.code, err?.message));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) return;

    if (mode === "login") {
      await handleLogin();
      return;
    }

    if (mode === "signup") {
      await handleSignup();
      return;
    }

    await handleReset();
  };

  return (
    <div
      className="card"
      style={{ padding: 28, maxWidth: 520, margin: "40px auto" }}
    >
      <h1 style={{ margin: 0, fontSize: 28 }}>Internal issue tracker</h1>
      <p style={{ color: "#475467", lineHeight: 1.6 }}>
        Sign in with your company email and password.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          className={mode === "login" ? "btn btn-primary" : "btn"}
          onClick={() => {
            resetFeedback();
            setMode("login");
          }}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          className={mode === "signup" ? "btn btn-primary" : "btn"}
          onClick={() => {
            resetFeedback();
            setMode("signup");
          }}
          disabled={busy}
        >
          Create account
        </button>
        <button
          className={mode === "reset" ? "btn btn-primary" : "btn"}
          onClick={() => {
            resetFeedback();
            setMode("reset");
          }}
          disabled={busy}
        >
          Reset password
        </button>
      </div>

      {mode === "signup" ? (
        <div style={{ marginBottom: 12 }}>
          <label className="label">Full name</label>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <label className="label">Work email</label>
        <input
          className="field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
        <p style={{ color: "#667085", fontSize: 13, margin: "8px 0 0" }}>
          Allowed domains: {allowedLabel}
        </p>
      </div>

      {mode !== "reset" ? (
        <div style={{ marginBottom: 12 }}>
          <label className="label">Password</label>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup" ? "Create a password" : "Enter your password"
            }
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {mode === "signup" ? (
            <p style={{ color: "#667085", fontSize: 13, margin: "8px 0 0" }}>
              Use at least 8 characters.
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        className="btn btn-primary"
        onClick={() => void onSubmit()}
        disabled={!canSubmit}
        style={{ width: "100%", marginTop: 8 }}
      >
        {busy
          ? mode === "login"
            ? "Signing in..."
            : mode === "signup"
            ? "Creating account..."
            : "Sending..."
          : mode === "login"
          ? "Sign in"
          : mode === "signup"
          ? "Create account"
          : "Send reset email"}
      </button>

      {remainingAuthCooldown > 0 && !busy ? (
        <p style={{ color: "#667085", fontSize: 13, marginTop: 12 }}>
          Login protection active. Try again in{" "}
          {Math.ceil(remainingAuthCooldown / 1000)}s.
        </p>
      ) : null}

      {remainingEmailCooldown > 0 && !busy ? (
        <p style={{ color: "#667085", fontSize: 13, marginTop: 6 }}>
          Email protection active. You can send another verification/reset email in{" "}
          {Math.ceil(remainingEmailCooldown / 1000)}s.
        </p>
      ) : null}

      {message ? (
        <p style={{ color: "#067647", marginTop: 16 }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ color: "#b42318", marginTop: 16 }}>{error}</p>
      ) : null}
    </div>
  );
}