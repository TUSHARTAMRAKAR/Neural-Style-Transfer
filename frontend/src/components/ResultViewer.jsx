/**
 * ProgressBar.jsx
 * Shows style transfer progress with animated bar and loss metrics.
 */

import { Loader2, Brain } from "lucide-react";

export function ProgressBar({ status, progress, step, totalSteps, losses }) {
  const pct = Math.round(progress * 100);

  const statusMessages = {
    pending:    "Queued — waiting to start...",
    processing: `Optimizing pixels... step ${step} of ${totalSteps}`,
    completed:  "Style transfer complete!",
    failed:     "Something went wrong.",
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl bg-indigo-950/40 border border-indigo-800/30">
      {/* Header */}
      <div className="flex items-center gap-3">
        {status === "processing" || status === "pending" ? (
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
        ) : (
          <Brain size={18} className="text-indigo-400" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-200">
            {statusMessages[status] || "Processing..."}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            VGG-19 is iteratively painting your image
          </p>
        </div>
        <span className="ml-auto text-sm font-mono text-indigo-300 font-medium">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Loss metrics */}
      {losses.total !== null && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Content loss", value: losses.content },
            { label: "Style loss",   value: losses.style },
            { label: "Total loss",   value: losses.total },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900/60 rounded-lg p-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="text-xs font-mono text-indigo-300 mt-0.5">
                {value !== null ? value.toExponential(2) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-600 text-center">
        CPU: ~3-5 min · GPU: ~20-30 sec · Don't close this tab
      </p>
    </div>
  );
}


/**
 * ResultViewer.jsx
 * Shows the final stylized image with download button.
 * Exported as named export from same file for simplicity.
 */

import { Download, RotateCcw, ExternalLink } from "lucide-react";

export function ResultViewer({ resultUrl, onReset }) {
  // resultUrl comes from backend as "/result/{job_id}"
  // We must point directly to FastAPI on port 8000, NOT through Vite proxy
  // because the Vite proxy strips auth headers needed for file download
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const fullUrl = resultUrl?.startsWith("/")
    ? `${apiBase}${resultUrl}`
    : resultUrl;

  const handleDownload = async () => {
    try {
      // Fetch the image as a blob then trigger browser download
      // This avoids CORS issues with the <a download> attribute
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "stylized_result.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Result image */}
      <div className="relative rounded-xl overflow-hidden border border-indigo-500/30">
        <img
          src={fullUrl}
          alt="Stylized result"
          className="w-full object-cover rounded-xl"
          style={{ maxHeight: "500px" }}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        <div
          style={{ display: "none" }}
          className="w-full h-48 items-center justify-center text-gray-500 text-sm"
        >
          Image failed to load — try opening {fullUrl} directly
        </div>
        <div className="absolute top-3 right-3">
          <span className="bg-green-900/80 text-green-300 text-xs px-2 py-1 rounded-full border border-green-700/50">
            ✓ Complete
          </span>
        </div>
      </div>

      {/* Direct link to verify image loads */}
      <p className="text-xs text-gray-500 text-center">
        Can&#39;t see it?{" "}
        <a href={fullUrl} target="_blank" rel="noreferrer" className="text-indigo-400 underline">
          Open image directly in browser
        </a>
      </p>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium
                     transition-colors"
        >
          <Download size={16} />
          Download PNG
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium
                     border border-white/10 transition-colors"
        >
          <RotateCcw size={16} />
          New image
        </button>
      </div>
    </div>
  );
}
