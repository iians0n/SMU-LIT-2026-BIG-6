import { getCase } from "@/lib/store";
import { STAGE_LABEL, STAGE_STATUS_LABEL } from "@/lib/contracts";

/**
 * Placeholder. Clarence owns this page — the real overview lands in his M2
 * (see clarence.md §2). This exists only so Hour 0 has a visible smoke test
 * that contracts + store + fixture actually load together.
 */
export default function Home() {
  const record = getCase();

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        Hour 0 scaffold — Clarence owns this page
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Small Claims Preparation Dashboard</h1>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-neutral-500">Case</dt>
        <dd>{record.case.id}</dd>
        <dt className="text-neutral-500">Version</dt>
        <dd>{record.case.version}</dd>
        <dt className="text-neutral-500">Stage</dt>
        <dd>
          {STAGE_LABEL[record.case.stage]} —{" "}
          {STAGE_STATUS_LABEL[record.case.stageStatus[record.case.stage]]}
        </dd>
      </dl>

      <ul className="mt-6 space-y-1 text-sm text-neutral-600">
        <li>{record.documents.length} documents</li>
        <li>{record.facts.length} facts</li>
        <li>{record.issues.length} issue assessments</li>
        <li>{record.contradictions.length} contradictions detected</li>
        <li>{record.openQuestions.filter((q) => q.status === "open").length} open questions</li>
      </ul>

      <p className="mt-6 text-sm">
        <a className="underline" href="/api/case">
          GET /api/case
        </a>
      </p>
    </main>
  );
}
