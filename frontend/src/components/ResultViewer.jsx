/**
 * ResultViewer.jsx
 * Before/after comparison slider + download button
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, RotateCcw, SplitSquareHorizontal, Image } from "lucide-react";
import { Loader2, Brain } from "lucide-react";

// ─────────────────────────────────────────────
// ProgressBar
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
        {status === "processing" || status === "pending"
          ? <Loader2 size={18} className="text-indigo-400 animate-spin" />
          : <Brain   size={18} className="text-indigo-400" />}
        <div>
          <p className="text-sm font-medium text-gray-200">{statusMessages[status] || "Processing..."}</p>
          <p className="text-xs text-gray-500 mt-0.5">VGG-19 is iteratively painting your image</p>
        </div>
        <span className="ml-auto text-sm font-mono text-indigo-300 font-medium">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
             style={{ width: `${pct}%` }} />
      </div>
      {losses.total !== null && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Content loss", value: losses.content },
            { label: "Style loss",   value: losses.style   },
            { label: "Total loss",   value: losses.total   },
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
// CompareSlider — the real deal
// ─────────────────────────────────────────────
function CompareSlider({ originalUrl, styledUrl }) {
  const [pos, setPos]       = useState(50); // 0-100%
  const [drag, setDrag]     = useState(false);
  const wrapRef             = useRef(null);

  // Convert clientX → percentage inside the container
  const toPercent = useCallback((clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const start = useCallback((clientX) => {
    setDrag(true);
    setPos(toPercent(clientX));
  }, [toPercent]);

  const move = useCallback((clientX) => {
    if (drag) setPos(toPercent(clientX));
  }, [drag, toPercent]);

  const stop = useCallback(() => setDrag(false), []);

  useEffect(() => {
    const mm = (e) => move(e.clientX);
    const tm = (e) => move(e.touches[0].clientX);
    const mu = () => stop();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup",   mu);
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("touchend",  mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup",   mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend",  mu);
    };
  }, [move, stop]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-xl overflow-hidden border border-indigo-500/30"
      style={{ cursor: drag ? "grabbing" : "ew-resize", userSelect: "none" }}
      onMouseDown={(e) => { e.preventDefault(); start(e.clientX); }}
      onTouchStart={(e) => start(e.touches[0].clientX)}
    >
      {/* ── ORIGINAL image — full width, always underneath ── */}
      <img
        src={originalUrl}
        alt="Original"
        draggable={false}
        className="block w-full"
        style={{ maxHeight: 480, objectFit: "cover", display: "block" }}
      />

      {/* ── STYLED image — clipped from the RIGHT side ── */}
      <img
        src={styledUrl}
        alt="Stylized"
        draggable={false}
        className="absolute inset-0 block w-full h-full"
        style={{
          objectFit:      "cover",
          clipPath:       `inset(0 0 0 ${pos}%)`,
          objectPosition: "top left",
        }}
      />

      {/* ── Blur overlay on ORIGINAL side (left of divider) ──
           A gradient that goes from transparent → blurred white
           right near the divider edge, softening the cut      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(
            to right,
            transparent ${Math.max(0, pos - 18)}%,
            rgba(0,0,0,0.01) ${Math.max(0, pos - 10)}%,
            rgba(255,255,255,0.08) ${pos - 3}%,
            transparent ${pos}%
          )`,
          backdropFilter: `blur(${
            pos > 5 && pos < 95 ? "6px" : "0px"
          })`,
          WebkitBackdropFilter: `blur(${
            pos > 5 && pos < 95 ? "6px" : "0px"
          })`,
          clipPath: `inset(0 ${100 - pos + 1}% 0 0)`,
        }}
      />

      {/* ── Blur overlay on STYLED side (right of divider) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(
            to left,
            transparent ${Math.max(0, 100 - pos - 18)}%,
            rgba(0,0,0,0.01) ${Math.max(0, 100 - pos - 10)}%,
            rgba(255,255,255,0.08) ${100 - pos - 3}%,
            transparent ${100 - pos}%
          )`,
          backdropFilter: `blur(${
            pos > 5 && pos < 95 ? "6px" : "0px"
          })`,
          WebkitBackdropFilter: `blur(${
            pos > 5 && pos < 95 ? "6px" : "0px"
          })`,
          clipPath: `inset(0 0 0 ${pos - 1}%)`,
        }}
      />

      {/* ── Divider line ── */}
      <div
        className="absolute top-0 bottom-0 w-[2px]"
        style={{
          left:        `${pos}%`,
          transform:   "translateX(-50%)",
          pointerEvents: "none",
          background:  "linear-gradient(to bottom, transparent, white 10%, white 90%, transparent)",
          boxShadow:   "0 0 12px 3px rgba(255,255,255,0.35)",
        }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-10 h-10 rounded-full bg-white shadow-2xl
                     flex items-center justify-center"
          style={{
            pointerEvents: "none",
            boxShadow:     "0 0 0 2px rgba(255,255,255,0.4), 0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <SplitSquareHorizontal size={18} className="text-gray-700" />
        </div>
      </div>

      {/* ── Labels ── */}
      <span className="absolute top-3 left-3 bg-black/60 text-white text-[11px]
                       px-2.5 py-1 rounded-full font-medium pointer-events-none">
        ← Original
      </span>
      <span className="absolute top-3 right-3 bg-indigo-600/90 text-white text-[11px]
                       px-2.5 py-1 rounded-full font-medium pointer-events-none">
        Stylized →
      </span>

      {/* ── Hint ── */}
      {!drag && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2
                         bg-black/50 text-gray-300 text-[11px] px-3 py-1
                         rounded-full pointer-events-none whitespace-nowrap">
          ← drag to compare →
        </span>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// ResultViewer — main export
// ─────────────────────────────────────────────
export function ResultViewer({ resultUrl, contentFile, onReset }) {
  const [viewMode, setViewMode] = useState("slider");

  const apiBase      = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const styledUrl    = resultUrl?.startsWith("/") ? `${apiBase}${resultUrl}` : resultUrl;
  const originalUrl  = contentFile ? URL.createObjectURL(contentFile) : null;

  const handleDownload = async () => {
    try {
      const res     = await fetch(styledUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = "stylized_result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* View mode toggle */}
      {originalUrl && (
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
          <button
            onClick={() => setViewMode("slider")}
            className={`flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 transition-colors
              ${viewMode === "slider"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white"}`}
          >
            <SplitSquareHorizontal size={13} /> Compare slider
          </button>
          <button
            onClick={() => setViewMode("stylized")}
            className={`flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 transition-colors
              ${viewMode === "stylized"
                ? "bg-indigo-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white"}`}
          >
            <Image size={13} /> Result only
          </button>
        </div>
      )}

      {/* Image display */}
      {viewMode === "slider" && originalUrl ? (
        <CompareSlider originalUrl={originalUrl} styledUrl={styledUrl} />
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-indigo-500/30">
          <img
            src={styledUrl}
            alt="Stylized result"
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: 480 }}
          />
          <div className="absolute top-3 right-3">
            <span className="bg-green-900/80 text-green-300 text-xs px-2 py-1
                             rounded-full border border-green-700/50">
              ✓ Complete
            </span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Can't see it?{" "}
        <a href={styledUrl} target="_blank" rel="noreferrer" className="text-indigo-400 underline">
          Open directly in browser
        </a>
      </p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Download size={16} /> Download PNG
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium
                     border border-white/10 transition-colors"
        >
          <RotateCcw size={16} /> New image
        </button>
      </div>
    </div>
  );
}
