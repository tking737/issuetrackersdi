"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export function LogoutButton() {
  const logout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <button className="btn" onClick={logout}>
      Sign out
    </button>
  );
}
