import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { getIssueById, updateIssueFollowers } from "@/lib/firestore";

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
    const { followers } = await request.json();

    if (!Array.isArray(followers)) {
      return NextResponse.json(
        { error: "Invalid followers list." },
        { status: 400 }
      );
    }

    await updateIssueFollowers(id, followers);
    const updated = await getIssueById(id);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update followers." },
      { status: 500 }
    );
  }
}