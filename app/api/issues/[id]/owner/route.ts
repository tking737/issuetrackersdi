import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { assignIssueOwner } from "@/lib/firestore";

function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Only admins can assign owners." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const owner = body?.owner ? String(body.owner).trim().toLowerCase() : null;

    if (owner) {
      const adminEmails = parseAdminEmails();
      if (!adminEmails.includes(owner)) {
        return NextResponse.json(
          { error: "Owner must be one of the configured admins." },
          { status: 400 }
        );
      }
    }

    const issue = await assignIssueOwner(id, owner);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to assign owner." },
      { status: 500 }
    );
  }
}