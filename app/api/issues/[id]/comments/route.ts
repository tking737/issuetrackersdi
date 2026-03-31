import { NextResponse } from "next/server";
import { addComment } from "@/lib/firestore";
import { requireUser } from "@/lib/server-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const text = String(body?.body || "").trim();
    if (!text) return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
    const { id } = await params;
    const issue = await addComment(id, user.name, text);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to post comment." }, { status: 500 });
  }
}
