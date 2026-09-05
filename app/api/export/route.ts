import { z } from "zod";
import { buildCjtsEntryGuide } from "@/lib/cjts/entry-guide";
import { buildCjtsEntryGuidePdf } from "@/lib/export/cjts-entry-guide-pdf";
import { buildCasePdf } from "@/lib/export/case-pdf";
import { api, checkVersion, requireCase } from "@/lib/server/session";
import { getCase as getStoredCase } from "@/lib/store";
import { appendVerification, getWorkflow, verificationRecord } from "@/lib/workflow";

const ExportRequest = z.object({
  version: z.number().int(),
  kind: z.enum(["pack", "verification", "referral", "cjts-guide"]).default("pack"),
});

export async function POST(request: Request) {
  return api(request, async () => {
    const view = requireCase(request);
    const body = ExportRequest.parse(await request.json());
    checkVersion(view, body.version);

    const isCjtsGuide = body.kind === "cjts-guide";
    appendVerification(view, {
      action: "exported",
      description: isCjtsGuide
        ? "Downloaded filled CJTS entry guide; filing status unchanged"
        : `Downloaded ${body.kind} PDF; filing status unchanged`,
      sourceCaseVersion: view.version,
      sourceRefs: [],
      aiDrafted: false,
    });

    const record = getStoredCase();
    const workflow = getWorkflow(view);
    const bytes = body.kind === "cjts-guide"
      ? buildCjtsEntryGuidePdf(buildCjtsEntryGuide(record, view, workflow))
      : buildCasePdf({
          kind: body.kind,
          record,
          view,
          workflow,
          verification: verificationRecord(view),
        });
    const filename = isCjtsGuide
      ? `casepath-cjts-entry-guide-v${view.version}.pdf`
      : `casepath-${body.kind}-v${view.version}.pdf`;

    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
