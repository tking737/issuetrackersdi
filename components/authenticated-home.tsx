"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isAllowedEmail } from "@/lib/auth-config";
import { Issue, UserSession } from "@/lib/types";
import { IssueTrackerApp } from "@/components/issue-tracker-app";

export function AuthenticatedHome() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adminEmails = useMemo(
    () => (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    [],
  );

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setError(null);
      if (!firebaseUser) {
        window.location.href = "/login";
        return;
      }

      await firebaseUser.reload();
      const email = firebaseUser.email || "";
      if (!email || !isAllowedEmail(email)) {
        await signOut(auth);
        window.location.href = "/login";
        return;
      }

      const currentUser: UserSession = {
        id: firebaseUser.uid,
        email,
        name: firebaseUser.displayName || email.split("@")[0],
        isAdmin: adminEmails.includes(email.toLowerCase()),
      };

      setUser(currentUser);

      if (!firebaseUser.emailVerified) {
        setNeedsVerification(true);
        setLoading(false);
        return;
      }

      setNeedsVerification(false);

      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch("/api/issues", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load issues.");
        setIssues(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load issues.");
      }

      setLoading(false);
    });
  }, [adminEmails]);

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    setBusy(true);
    setError(null);
    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setError("A new verification email has been sent.");
    } catch (err: any) {
      setError(err?.message || "Could not send verification email.");
    }
    setBusy(false);
  };

  if (loading || !user) {
    return <main className="container"><div className="card" style={{ padding: 24 }}>Loading...</div></main>;
  }

  if (needsVerification) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 28, maxWidth: 620, margin: "40px auto" }}>
          <h1 style={{ marginTop: 0 }}>Verify your email</h1>
          <p style={{ color: "#475467", lineHeight: 1.6 }}>
            We sent a verification email to <strong>{user.email}</strong>. Confirm your account, then sign in again.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={resendVerification} disabled={busy}>{busy ? "Sending..." : "Resend verification email"}</button>
            <button className="btn" onClick={() => void signOut(auth).then(() => { window.location.href = "/login"; })}>Back to sign in</button>
          </div>
          {error ? <p style={{ marginTop: 14, color: error.includes("sent") ? "#067647" : "#b42318" }}>{error}</p> : null}
        </div>
      </main>
    );
  }

  return <IssueTrackerApp initialIssues={issues} currentUser={user} />;
}
