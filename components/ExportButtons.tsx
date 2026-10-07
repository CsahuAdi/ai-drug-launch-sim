"use client";

import { useState } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "./ui";

/** CSV is synchronous; PDF is generated lazily (jsPDF is code-split) and may take a moment. */
export function ExportButtons({
  onCsv,
  onPdf,
  disabled,
  csvLabel = "Export CSV",
}: {
  onCsv: () => void;
  onPdf?: () => Promise<void>;
  disabled?: boolean;
  csvLabel?: string;
}) {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);

  const pdf = async () => {
    if (!onPdf) return;
    setBusy(true);
    try {
      await onPdf();
    } catch (e) {
      notify(`PDF export failed: ${e instanceof Error ? e.message : "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={onCsv} disabled={disabled} title="Download the data as a CSV file">
        <FileDown className="h-3.5 w-3.5" /> {csvLabel}
      </Button>
      {onPdf && (
        <Button size="sm" onClick={pdf} disabled={disabled || busy} title="Download a formatted PDF report">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF report
        </Button>
      )}
    </>
  );
}
