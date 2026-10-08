import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export interface PurgeResult {
  users?: number;
  listings: number;
  conversations: number;
  images: number;
}

type Phase = "confirm" | "running" | "done" | "error";

/**
 * Confirm → progress → result, all in one dialog, so a purge always ends on a
 * visible summary instead of a toast that's easy to miss.
 */
export default function PurgeDialog({
  title,
  description,
  onRun,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  onRun: (reason: string) => Promise<PurgeResult>;
  onClose: (purged: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [reason, setReason] = useState("spam");
  const [result, setResult] = useState<PurgeResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setPhase("running");
    try {
      setResult(await onRun(reason));
      setPhase("done");
    } catch (e: any) {
      setError(typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "Purge failed. Nothing was deleted, or only partly; reload to check.");
      setPhase("error");
    }
  }

  const closable = phase !== "running";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="purge-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => closable && onClose(phase === "done")} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {phase === "done" && result ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h2 id="purge-title" className="text-lg font-semibold text-gray-900">Purge complete</h2>
            </div>
            <ul className="text-sm text-gray-700 space-y-1 mb-6">
              {result.users !== undefined && <li><strong>{result.users}</strong> users deleted and their emails blocked</li>}
              {result.users === undefined && <li>Account deleted and email blocked from signing up again</li>}
              <li><strong>{result.listings}</strong> listings deleted</li>
              <li><strong>{result.images}</strong> photos removed from storage</li>
              <li><strong>{result.conversations}</strong> conversations deleted</li>
            </ul>
            <button autoFocus onClick={() => onClose(true)} className="btn-primary w-full">Done</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 id="purge-title" className="text-lg font-semibold text-gray-900">{title}</h2>
            </div>
            <div className="text-sm text-gray-600 mb-4">{description}</div>
            <label className="block text-sm mb-5">
              <span className="block font-medium text-gray-700 mb-1">Reason <span className="font-normal text-gray-400">(shown in the blocked-emails list)</span></span>
              <input className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} disabled={phase === "running"} />
            </label>
            {phase === "error" && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={run}
                disabled={phase === "running"}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {phase === "running" ? <><Loader2 className="w-4 h-4 animate-spin" /> Purging…</> : "Purge permanently"}
              </button>
              <button onClick={() => onClose(false)} disabled={phase === "running"} className="flex-1 btn-secondary">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
