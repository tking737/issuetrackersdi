import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { getIssueById, toggleVote, updateIssueFollowers } from "@/lib/firestore";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    const issue = await toggleVote(id, user.email);

    // Auto-follow the voter so they receive resolution emails.
    if (!issue.notifyOnResolve.includes(user.email)) {
      await updateIssueFollowers(id, [...issue.notifyOnResolve, user.email]);
    }

    const updated = await getIssueById(id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to update vote." },
      { status: 500 }
    );
  }
}