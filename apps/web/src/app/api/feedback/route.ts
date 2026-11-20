import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  getFeedbackEligibilityForUser,
  snoozeUserFeedback,
  submitUserFeedback,
} from "@/lib/feedback/service";
import { feedbackPostSchema } from "@/lib/feedback/types";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const eligibility = await getFeedbackEligibilityForUser(session.user.id);
  return NextResponse.json({ ok: true, ...eligibility });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = feedbackPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback payload." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "snooze") {
    const snoozeRes = await snoozeUserFeedback({
      userId: session.user.id,
      triggerMoment: parsed.data.triggerMoment,
    });
    return NextResponse.json({ ok: true, ...snoozeRes });
  }

  const subRes = await submitUserFeedback({
    userId: session.user.id,
    rating: parsed.data.rating,
    triggerMoment: parsed.data.triggerMoment,
    primaryUseCase: parsed.data.primaryUseCase,
    topFeatureRequest: parsed.data.topFeatureRequest,
    sentimentTags: parsed.data.sentimentTags,
    comment: parsed.data.comment,
  });

  return NextResponse.json({ ok: true, id: subRes.id });
}
