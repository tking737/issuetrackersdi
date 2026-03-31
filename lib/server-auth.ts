import { adminAuth } from "@/lib/firebase/admin";
import { isAllowedEmail } from "@/lib/auth-config";
import { UserSession } from "@/lib/types";

function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireUser(request: Request): Promise<UserSession> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new Error("Unauthorized");
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email || "";

  if (!email || !decoded.email_verified || !isAllowedEmail(email, process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || process.env.ALLOWED_EMAIL_DOMAINS)) {
    throw new Error("Unauthorized");
  }

  const adminEmails = parseAdminEmails();
  return {
    id: decoded.uid,
    email,
    name: decoded.name || email.split("@")[0],
    isAdmin: adminEmails.includes(email.toLowerCase()),
  };
}
