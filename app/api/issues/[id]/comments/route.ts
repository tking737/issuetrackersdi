import { NextResponse } from "next/server";
import {
  addComment,
  uploadCommentAttachment,
} from "@/lib/firestore";
import { requireUser } from "@/lib/server-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    const form = await request.formData();
    const text = String(form.get("body") || "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "Comment text is required." },
        { status: 400 }
      );
    }

    const tempCommentId = crypto.randomUUID();

    const files = form
      .getAll("attachments")
      .filter(
        (value): value is File => value instanceof File && value.size > 0
      );

    const attachments = [];
    for (const file of files) {
      attachments.push(await uploadCommentAttachment(id, tempCommentId, file));
    }

    const issue = await addComment(id, user.name, text, attachments);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to post comment." },
      { status: 500 }
    );
  }
}