import { NextResponse } from "next/server";
import { listIssues } from "@/lib/firestore";
import { sendDailyAssignedIssuesEmail } from "@/lib/graph";

function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  try {
    const issues = await listIssues();
    const adminEmails = parseAdminEmails();

    for (const adminEmail of adminEmails) {
      const assignedIssues = issues.filter((issue) => issue.owner === adminEmail);

      if (assignedIssues.length) {
        await sendDailyAssignedIssuesEmail({
          recipient: adminEmail,
          issues: assignedIssues.map((issue) => ({
            id: issue.id,
            title: issue.title,
            platform: issue.platform,
            status: issue.status,
            secondaryStatus: issue.secondaryStatus,
            priority: issue.priority,
            createdAt: issue.createdAt,
          })),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to send admin reports." },
      { status: 500 }
    );
  }
}