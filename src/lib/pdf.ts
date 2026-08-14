/**
 * Client Summary PDF (spec Phase 3). Renders the Client AI Opportunity Summary
 * to a PDF buffer using @react-pdf/renderer (fast, no headless browser →
 * supports the <10s delivery SLA, spec §3).
 */
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React from "react";
import type { ClientReport } from "@/lib/synthesis";
import { ClientSummaryPdf } from "@/components/pdf/client-summary-pdf";

export async function renderClientSummaryPdf(report: ClientReport): Promise<Uint8Array> {
  const element = React.createElement(ClientSummaryPdf, { report }) as unknown as React.ReactElement<DocumentProps>;
  const buf = await renderToBuffer(element);
  // Node Buffer → Uint8Array (Buffer is a Uint8Array subclass already).
  return buf as unknown as Uint8Array;
}
