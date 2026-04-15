import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { updateSecondaryStatus } from "@/lib/firestore";
import { SecondaryStatus } from "@/lib/types";

const allowedSecondaryStatuses: SecondaryStatus[] = [
  "None",
  "Submitted to Sage",
  "Working on Internal Solution",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can change secondary status." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const secondaryStatus = String(body?.secondaryStatus || "").trim() as SecondaryStatus;

    if (!allowedSecondaryStatuses.includes(secondaryStatus)) {
      return NextResponse.json(
        { error: "Invalid secondary status." },
        { status: 400 }
      );
    }

    const issue = await updateSecondaryStatus(id, secondaryStatus);
    return NextResponse.json(issue);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to update secondary status." },
      { status: 500 }
    );
  }
}