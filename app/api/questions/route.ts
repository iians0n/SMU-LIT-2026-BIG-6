/**
 * /api/questions — the adaptive interview. FR02.
 *
 * Owned by Anson. "I don't know" and "Skip for now" are recorded as explicit
 * outcomes, not silence: an unanswered question and a question the user
 * consciously set aside mean different things, and only the second should stop
 * us asking again.
 */

import type { Fact, QuestionTopic } from "@/lib/contracts";
import { planNextQuestion, unresolvedTopics } from "@/lib/planner";
import { bumpVersion, getCase, patchCase } from "@/lib/store";

const TOPIC_TO_FACT_KIND: Record<QuestionTopic, Fact["kind"]> = {
  parties: "party",
  agreement: "agreement",
  promised_performance: "promised_performance",
  events: "event",
  payment: "payment",
  loss: "loss",
  attempted_resolution: "attempted_resolution",
  other_party_response: "other_party_response",
  desired_outcome: "desired_outcome",
};

export async function GET() {
  const record = getCase();
  return Response.json({
    caseVersion: record.case.version,
    next: planNextQuestion(record),
    topics: unresolvedTopics(record),
  });
}

interface Body {
  questionId: string;
  topic: QuestionTopic;
  question: string;
  whyItMatters: string;
  action: "answer" | "skip" | "dont_know";
  answer?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "The request could not be read." }, { status: 400 });
  }
  if (!body?.questionId || !body?.action) {
    return Response.json({ error: "A question and an action are required." }, { status: 400 });
  }
  if (body.action === "answer" && !body.answer?.trim()) {
    return Response.json({ error: "An answer cannot be empty." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const record = getCase();
  const answered = body.action === "answer";
  const factId = `f_${body.topic}_${Date.now().toString(36)}`;

  patchCase((draft) => {
    if (answered) {
      draft.facts.push({
        id: factId,
        kind: TOPIC_TO_FACT_KIND[body.topic] ?? "event",
        statement: body.answer!.trim(),
        origin: "user_stated",
        // Their own words, recorded as given. Confirmation is a separate,
        // deliberate step on the chronology page.
        confirmedByUser: false,
        disputed: false,
        unknown: false,
        excerptIds: [],
        lastChangedAtVersion: draft.case.version + 1,
        updatedAt: now,
      });
    }

    const existing = draft.openQuestions.find((q) => q.id === body.questionId);
    const status = answered ? "answered" : body.action === "skip" ? "skipped" : "dont_know";
    if (existing) {
      existing.status = status;
      existing.answeredFactId = answered ? factId : null;
    } else {
      draft.openQuestions.push({
        id: body.questionId,
        topic: body.topic,
        question: body.question,
        whyItMatters: body.whyItMatters,
        status,
        answeredFactId: answered ? factId : null,
        askedAt: now,
      });
    }

    draft.verificationEvents.push({
      id: `ve_q_${body.questionId}_${Date.now()}`,
      kind: answered ? "user_corrected" : "user_reviewed",
      affectedOutput: `question:${body.questionId}`,
      usedFactIds: answered ? [factId] : [],
      usedSourceIds: [],
      note: answered ? "Answered." : status === "skipped" ? "Skipped for now." : "Answered: I don't know.",
      at: now,
      caseVersion: draft.case.version,
    });

    draft.case.stageStatus.clarify_upload = "in_progress";
  });

  // Only a new fact changes what downstream work rests on. Setting a question
  // aside records a decision without altering the record.
  const version = answered ? bumpVersion(`answered ${body.questionId}`) : record.case.version;

  return Response.json({
    caseVersion: version,
    next: planNextQuestion(getCase()),
    topics: unresolvedTopics(getCase()),
  });
}
