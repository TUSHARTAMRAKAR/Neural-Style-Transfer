/**
 * ResultViewer.jsx
 * Shows final stylized image with:
 *   1. Before/after comparison slider (drag to reveal original vs stylized)
 *   2. Download button
 *   3. New image button
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, RotateCcw, SplitSquareHorizontal, Image } from "lucide-react";
import { Loader2, Brain } from "lucide-react";

// ─────────────────────────────────────────────
// ProgressBar component
// ─────────────────────────────────────────────
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

      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

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


// ─────────────────────────────────────────────
// Before/After Slider component
// ─────────────────────────────────────────────
function CompareSlider({ beforeUrl, afterUrl }) {
  const [sliderPos, setSliderPos]   = useState(50); // percentage
  const [dragging, setDragging]     = useState(false);
  const containerRef                = useRef(null);

  const updateSlider = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect   = containerRef.current.getBoundingClientRect();
    const x      = clientX - rect.left;
    const pct    = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  // Mouse events
  const onMouseDown = (e) => { e.preventDefault(); setDragging(true); updateSlider(e.clientX); };
  const onMouseMove = useCallback((e) => { if (dragging) updateSlider(e.clientX); }, [dragging, updateSlider]);
  const onMouseUp   = useCallback(() => setDragging(false), []);

  // Touch events
  const onTouchStart = (e) => { setDragging(true); updateSlider(e.touches[0].clientX); };
  const onTouchMove  = useCallback((e) => { if (dragging) updateSlider(e.touches[0].clientX); }, [dragging, updateSlider]);
  const onTouchEnd   = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend",  onTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend",  onTouchEnd);
    };
  }, [dragging, onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-indigo-500/30 select-none"
      style={{ cursor: dragging ? "grabbing" : "col-resize" }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* AFTER image (stylized) — full width base layer */}
      <img
        src={afterUrl}
        alt="Stylized result"
        className="w-full block"
        style={{ maxHeight: "480px", objectFit: "cover" }}
        draggable={false}
      />

      {/* BEFORE image (original) — clipped to left side of slider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={beforeUrl}
          alt="Original photo"
          className="w-full block"
          style={{
            maxHeight: "480px",
            objectFit: "cover",
            width: containerRef.current
              ? `${containerRef.current.offsetWidth}px`
              : "100%",
          }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
      >
        {/* Drag handle circle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-9 h-9 rounded-full bg-white shadow-xl
                     flex items-center justify-center"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
        >
          <SplitSquareHorizontal size={18} className="text-gray-700" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3">
        <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-medium">
          Original
        </span>
      </div>
      <div className="absolute top-3 right-3">
        <span className="bg-indigo-600/80 text-white text-[10px] px-2 py-1 rounded-full font-medium">
          ✦ Stylized
        </span>
      </div>

      {/* Hint shown only when not dragging */}
      {!dragging && sliderPos === 50 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <span className="bg-black/50 text-gray-300 text-[10px] px-3 py-1 rounded-full">
            ← drag to compare →
          </span>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// ResultViewer — main export
// ─────────────────────────────────────────────
export function ResultViewer({ resultUrl, contentFile, onReset }) {
  const [viewMode, setViewMode] = useState("slider"); // "slider" | "stylized"

  const apiBase   = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const fullUrl   = resultUrl?.startsWith("/") ? `${apiBase}${resultUrl}` : resultUrl;

  // Create object URL for the original uploaded file
  const originalUrl = contentFile ? URL.createObjectURL(contentFile) : null;

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob    = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link    = document.createElement("a");
      link.href     = blobUrl;
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

      {/* View mode toggle — only show slider option if we have original */}
      {originalUrl && (
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
          <button
            onClick={() => setViewMode("slider")}
            className={`flex-1 py-2 font-medium flex items-center justify-center gap-1.5 transition-colors
              ${viewMode === "slider"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white"}`}
          >
            <SplitSquareHorizontal size={13} />
            Compare slider
          </button>
          <button
            onClick={() => setViewMode("stylized")}
            className={`flex-1 py-2 font-medium flex items-center justify-center gap-1.5 transition-colors
              ${viewMode === "stylized"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white"}`}
          >
            <Image size={13} />
            Stylized only
          </button>
        </div>
      )}

      {/* Image display */}
      {viewMode === "slider" && originalUrl ? (
        <CompareSlider beforeUrl={originalUrl} afterUrl={fullUrl} />
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-indigo-500/30">
          <img
            src={fullUrl}
            alt="Stylized result"
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: "480px" }}
          />
          <div className="absolute top-3 right-3">
            <span className="bg-green-900/80 text-green-300 text-xs px-2 py-1 rounded-full border border-green-700/50">
              ✓ Complete
            </span>
          </div>
        </div>
      )}

      {/* Can't see it? link */}
      <p className="text-xs text-gray-500 text-center">
        Can&#39;t see it?{" "}
        <a href={fullUrl} target="_blank" rel="noreferrer" className="text-indigo-400 underline">
          Open directly in browser
        </a>
      </p>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
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
