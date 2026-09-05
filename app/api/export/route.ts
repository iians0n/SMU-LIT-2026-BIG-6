import { z } from "zod";
import { buildCasePdf } from "@/lib/export/case-pdf";
import { api, checkVersion, requireCase } from "@/lib/server/session";
import { getCase as getStoredCase } from "@/lib/store";
import { appendVerification, getWorkflow, verificationRecord } from "@/lib/workflow";

const ExportRequest = z.object({
  version: z.number().int(),
  kind: z.enum(["pack", "verification", "referral"]).default("pack"),
});

export async function POST(request: Request) {
  return api(request, async () => {
    const view = requireCase(request);
    const body = ExportRequest.parse(await request.json());
    checkVersion(view, body.version);

    appendVerification(view, {
      action: "exported",
      description: `Downloaded ${body.kind} PDF; filing status unchanged`,
      sourceCaseVersion: view.version,
      sourceRefs: [],
      aiDrafted: false,
    });

    const bytes = buildCasePdf({
      kind: body.kind,
      record: getStoredCase(),
      view,
      workflow: getWorkflow(view),
      verification: verificationRecord(view),
    });

    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="casepath-${body.kind}-v${view.version}.pdf"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
