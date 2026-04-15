import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { getIssueById, updateIssueStatus } from "@/lib/firestore";
import { sendResolvedEmails } from "@/lib/graph";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can change issue status." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const status = String(body?.status || "").trim() as
      | "Open"
      | "In Progress"
      | "Resolved";

    if (!status || !["Open", "In Progress", "Resolved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const { id } = await params;

    const issue = await updateIssueStatus(id, status);
    let notified = 0;

    if (status === "Resolved") {
      const recipients = Array.from(
        new Set([issue.submitter, ...issue.notifyOnResolve])
      );

      notified = await sendResolvedEmails({
        recipients,
        issueTitle: issue.title,
        issueId: issue.id,
      });
    }

    const fresh = await getIssueById(id);
    return NextResponse.json({ issue: fresh, notified });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to update issue status." },
      { status: 500 }
    );
  }
}