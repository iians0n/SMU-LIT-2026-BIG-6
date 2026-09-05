/**
 * The unresolved-information list and question selection. FR02.
 *
 * Rules over the record, not a model. FR02 forbids questions that "suggest a
 * favourable answer", and a generated question is one prompt-drift away from
 * "You did pay on time, didn't you?" — leading in a way that is hard to notice
 * because it reads naturally. Fixed wording can be reviewed once and stays
 * reviewed. It also keeps the interview working with no API key.
 *
 * Two properties matter as much as the wording:
 *
 *   Nothing already known is asked again. FR02: "Reuse information already
 *   available in files."
 *
 *   The interview ends. "Stop questioning when material fields are confirmed or
 *   explicitly unresolved... do not trap the user in an endless interview." A
 *   question the user skipped or answered "I don't know" is resolved for this
 *   purpose — pressing on would be the trap.
 */

import type { CaseRecord, QuestionTopic } from "@/lib/contracts";

export type GapReason = "conflict" | "missing" | "unsupported";

export interface PlannedQuestion {
  id: string;
  topic: QuestionTopic;
  question: string;
  whyItMatters: string;
  /** Why this is being asked, so the UI can show conflicts differently from gaps. */
  reason: GapReason;
}

export interface TopicState {
  topic: QuestionTopic;
  label: string;
  status: "resolved" | "outstanding" | "set_aside";
}

const TOPIC_LABEL: Record<QuestionTopic, string> = {
  parties: "Who the other side is",
  agreement: "What was agreed",
  promised_performance: "What was promised, and by when",
  events: "What happened",
  payment: "What you paid",
  loss: "What it cost you",
  attempted_resolution: "What you have tried",
  other_party_response: "What they said",
  desired_outcome: "What you want",
};

interface Rule {
  topic: QuestionTopic;
  reason: GapReason;
  /** True when this is still outstanding. */
  outstanding: (r: CaseRecord) => boolean;
  question: string;
  whyItMatters: string;
}

/**
 * Ordered by priority, conflicts first.
 *
 * Every question is phrased so that no answer is the helpful one. "Did they
 * finish late?" invites yes; "What did you reply?" invites the truth. Anything
 * added here has to pass the same test — and there is a test asserting none of
 * them opens with a yes/no verb.
 */
const RULES: Rule[] = [
  {
    topic: "events",
    reason: "conflict",
    outstanding: (r) => r.facts.some((f) => f.disputed),
    question: "Two of your documents say different things about a date. What do you remember happening?",
    whyItMatters:
      "Your files point in two directions here. What you remember is a third piece of information, and it may settle which reading is right.",
  },
  {
    topic: "parties",
    reason: "missing",
    outstanding: (r) => !r.parties.some((p) => p.role === "respondent" && p.name),
    question: "Who are you claiming against — a person, or a business?",
    whyItMatters:
      "The tribunal needs to know exactly who the other side is, and a business has to be identified by its registered name.",
  },
  {
    topic: "agreement",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "agreement"),
    question: "What did you and the other side agree to?",
    whyItMatters: "Everything else is measured against what was agreed, so it is the starting point.",
  },
  {
    topic: "promised_performance",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "promised_performance"),
    question: "When was the work or the delivery meant to be finished?",
    whyItMatters:
      "Without a date it is hard to say anything was late, and the date also affects how long you have to bring a claim.",
  },
  {
    topic: "payment",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "payment"),
    question: "What have you paid so far, and how did you pay it?",
    whyItMatters:
      "How you paid decides what record exists. A bank transfer leaves one; cash usually does not.",
  },
  {
    topic: "loss",
    reason: "unsupported",
    outstanding: (r) =>
      r.facts.some((f) => f.kind === "loss" && f.excerptIds.length === 0 && !f.unknown),
    question: "For the amount you say you are out of pocket, what records do you have?",
    whyItMatters:
      "At the moment this rests on your account alone. A receipt or bank record would let you show it rather than assert it.",
  },
  {
    topic: "attempted_resolution",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "attempted_resolution"),
    question: "What have you already asked the other side to do about this?",
    whyItMatters:
      "The process expects parties to have tried to sort things out, and it affects which next steps are open to you.",
  },
  {
    topic: "other_party_response",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "other_party_response"),
    question: "What has the other side said about the problem?",
    whyItMatters:
      "Knowing their account now means you can prepare for it, rather than meeting it for the first time at a hearing.",
  },
  {
    topic: "desired_outcome",
    reason: "missing",
    outstanding: (r) => !r.facts.some((f) => f.kind === "desired_outcome"),
    question: "What outcome would put this right for you?",
    whyItMatters: "What you are asking for shapes the whole claim, including the amount.",
  },
];

/** Topics the user has already answered, skipped, or said they do not know. */
function setAside(record: CaseRecord): Set<QuestionTopic> {
  return new Set(
    record.openQuestions
      .filter((q) => q.status !== "open")
      .map((q) => q.topic),
  );
}

export function unresolvedTopics(record: CaseRecord): TopicState[] {
  const aside = setAside(record);
  return (Object.keys(TOPIC_LABEL) as QuestionTopic[]).map((topic) => {
    const rules = RULES.filter((r) => r.topic === topic);
    const outstanding = rules.some((r) => r.outstanding(record));
    return {
      topic,
      label: TOPIC_LABEL[topic],
      status: aside.has(topic) ? "set_aside" : outstanding ? "outstanding" : "resolved",
    };
  });
}

/**
 * The next question, or null when there is nothing worth asking.
 *
 * One at a time, on purpose. A form of nine questions invites skimming; a single
 * question with its reason attached invites an answer.
 */
export function planNextQuestion(record: CaseRecord): PlannedQuestion | null {
  const aside = setAside(record);

  // Questions already on the record and still open come first — they were asked
  // for a reason, and re-deriving them would renumber and re-ask.
  const existing = record.openQuestions.find((q) => q.status === "open");
  if (existing) {
    return {
      id: existing.id,
      topic: existing.topic,
      question: existing.question,
      whyItMatters: existing.whyItMatters,
      reason: record.facts.some((f) => f.disputed) ? "conflict" : "missing",
    };
  }

  for (const rule of RULES) {
    if (aside.has(rule.topic)) continue;
    if (!rule.outstanding(record)) continue;
    return {
      id: `planned_${rule.topic}_${rule.reason}`,
      topic: rule.topic,
      question: rule.question,
      whyItMatters: rule.whyItMatters,
      reason: rule.reason,
    };
  }
  return null;
}
