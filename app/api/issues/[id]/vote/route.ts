import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { toggleVote } from "@/lib/firestore";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const issue = await toggleVote(id, user.email);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to update vote." }, { status: 500 });
  }
}
