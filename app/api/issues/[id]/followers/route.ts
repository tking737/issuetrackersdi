import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { getIssueById, updateIssueFollowers } from "@/lib/firestore";
import { sendAddedSubscriberEmail } from "@/lib/graph";
import { isAllowedEmail } from "@/lib/auth-config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can manage subscribers." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existingIssue = await getIssueById(id);

    const body = await request.json();
    const followersRaw = body?.followers;

    if (!Array.isArray(followersRaw)) {
      return NextResponse.json(
        { error: "Invalid followers list." },
        { status: 400 }
      );
    }

    const normalizedFollowers = Array.from(
      new Set(
        followersRaw
          .map((value: unknown) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );

    for (const email of normalizedFollowers) {
      if (!isAllowedEmail(email)) {
        return NextResponse.json(
          { error: `Invalid subscriber email: ${email}` },
          { status: 400 }
        );
      }
    }

    const newlyAdded = normalizedFollowers.filter(
      (email) => !existingIssue.notifyOnResolve.includes(email)
    );

    await updateIssueFollowers(id, normalizedFollowers);
    const updated = await getIssueById(id);

    for (const email of newlyAdded) {
      await sendAddedSubscriberEmail({
        recipient: email,
        issueTitle: updated.title,
        issueId: updated.id,
        addedBy: user.email,
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update followers." },
      { status: 500 }
    );
  }
}