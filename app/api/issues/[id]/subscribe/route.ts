import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { toggleSubscription } from "@/lib/firestore";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const result = await toggleSubscription(id, user.email);
    return NextResponse.json({ subscribed: result.subscribed, issue: result.issue });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to update subscription." }, { status: 500 });
  }
}
