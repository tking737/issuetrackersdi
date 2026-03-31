"use client";

import { useMemo, useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { allowedDomainsLabel, isAllowedEmail } from "@/lib/auth-config";

type Mode = "login" | "signup" | "reset";

function passwordRule(password: string) {
  return password.length >= 8;
}

export function LoginPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const domainHelp = useMemo(() => `Allowed email domains: ${allowedDomainsLabel()}`, []);

  const ensureAllowedDomain = () => {
    if (!isAllowedEmail(email)) {
      throw new Error(`Use a company email address (${allowedDomainsLabel()}).`);
    }
  };

  const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || window.location.origin;

  const actionCodeSettings = {
    url: appUrl,
    handleCodeInApp: false,
  };

  const handleLogin = async () => {
    ensureAllowedDomain();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.reload();

    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user, actionCodeSettings);
      await signOut(auth);
      throw new Error("Your email is not verified yet. We sent a new verification email.");
    }

    window.location.href = "/";
  };

  const handleSignup = async () => {
    ensureAllowedDomain();
    if (!passwordRule(password)) {
      throw new Error("Use a password with at least 8 characters.");
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    await sendEmailVerification(credential.user, actionCodeSettings);
    await signOut(auth);
    setMessage("Account created. Check your email for a verification link before signing in.");
    setMode("login");
  };

  const handleReset = async () => {
    ensureAllowedDomain();
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    setMessage("Password reset email sent. Follow the link in your inbox to choose a new password.");
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (mode === "login") await handleLogin();
      else if (mode === "signup") await handleSignup();
      else await handleReset();
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ padding: 28, maxWidth: 520, margin: "50px auto" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Internal issue tracker</h1>
      <p style={{ color: "#475467", lineHeight: 1.6 }}>
        Sign in with your company email and password. Verification and password reset emails are handled by Firebase Auth.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button className={mode === "login" ? "btn btn-primary" : "btn"} onClick={() => setMode("login")}>Sign in</button>
        <button className={mode === "signup" ? "btn btn-primary" : "btn"} onClick={() => setMode("signup")}>Create account</button>
        <button className={mode === "reset" ? "btn btn-primary" : "btn"} onClick={() => setMode("reset")}>Reset password</button>
      </div>

      {mode === "signup" ? (
        <div style={{ marginBottom: 12 }}>
          <label className="label">Full name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <label className="label">Work email</label>
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shaftdrillers.com" />
        <p style={{ color: "#667085", fontSize: 13, margin: "8px 0 0" }}>{domainHelp}</p>
      </div>

      {mode !== "reset" ? (
        <div style={{ marginBottom: 12 }}>
          <label className="label">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          {mode === "signup" ? <p style={{ color: "#667085", fontSize: 13, margin: "8px 0 0" }}>Minimum 8 characters.</p> : null}
        </div>
      ) : null}

      <button className="btn btn-primary" disabled={busy || !email || (mode !== "reset" && !password)} onClick={submit} style={{ width: "100%" }}>
        {busy ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
      </button>

      {message ? <p style={{ color: "#067647", marginTop: 16 }}>{message}</p> : null}
      {error ? <p style={{ color: "#b42318", marginTop: 16 }}>{error}</p> : null}
    </div>
  );
}
