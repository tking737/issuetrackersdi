import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { createIssue, getIssueById, listIssues, uploadAttachment } from "@/lib/firestore";
import { PLATFORMS } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const issues = await listIssues();
    return NextResponse.json(issues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();

    const title = String(form.get("title") || "").trim();
    const submitterName = String(form.get("submitterName") || user.name).trim();
    const category = String(form.get("category") || "Bug").trim();
    const platform = String(form.get("platform") || "Sage Intacct").trim();
    const priority = String(form.get("priority") || "Medium").trim();
    const description = String(form.get("description") || "").trim();

    if (!title || !submitterName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!PLATFORMS.includes(platform as any)) {
      return NextResponse.json({ error: "Please choose a valid platform." }, { status: 400 });
    }

    const tmpIssue = await createIssue({
      title,
      category: category as any,
      platform: platform as any,
      priority: priority as any,
      description,
      submitterName,
      submitter: user.email,
      user,
      attachments: [],
    });

    const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    const attachments = [] as Awaited<ReturnType<typeof uploadAttachment>>[];
    for (const file of files) {
      attachments.push(await uploadAttachment(tmpIssue.id, file));
    }

    if (attachments.length) {
      const { adminDb } = await import("@/lib/firebase/admin");
      await adminDb.collection("issues").doc(tmpIssue.id).update({ attachments });
    }

    const issue = await getIssueById(tmpIssue.id);
    return NextResponse.json(issue, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create issue." }, { status: 500 });
  }
}
