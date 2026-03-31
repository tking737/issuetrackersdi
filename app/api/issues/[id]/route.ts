import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { getIssueById } from "@/lib/firestore";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await params;
    const issue = await getIssueById(id);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to load issue." }, { status: 500 });
  }
}
