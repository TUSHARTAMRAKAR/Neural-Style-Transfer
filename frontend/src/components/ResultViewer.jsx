/**
 * ResultViewer.jsx
 * Before/after comparison slider with blur reveal effect + download
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, RotateCcw, SplitSquareHorizontal, Image } from "lucide-react";
import { Loader2, Brain } from "lucide-react";

// ─────────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────────
export function ProgressBar({ status, progress, step, totalSteps, losses }) {
  const pct = Math.round(progress * 100);

  const stages = [
    { min: 0,  max: 25, label: "Loading VGG-19 model...",           color: "var(--sage-dark)" },
    { min: 25, max: 55, label: "Extracting content features...",     color: "var(--forest)" },
    { min: 55, max: 85, label: "Applying style via Gram matrices...", color: "var(--mauve-dark)" },
    { min: 85, max: 100,label: "Final refinement...",                color: "var(--rose-dark)" },
  ];
  const stage = stages.find(s => pct >= s.min && pct < s.max) || stages[3];

  const lossColors = {
    "Content loss": "var(--forest)",
    "Style loss":   "var(--mauve-dark)",
    "Total loss":   "var(--rose-dark)",
  };

  return (
    <div className="card p-6 flex flex-col gap-5" style={{ borderColor: "var(--sage-dark)" }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center animate-pulse-ring"
             style={{ background: "var(--forest-muted)", border: "1.5px solid var(--forest)" }}>
          {status === "processing" || status === "pending"
            ? <Loader2 size={20} style={{ color: "var(--forest)" }} className="animate-spin" />
            : <Brain   size={20} style={{ color: "var(--forest)" }} />}
        </div>
        <div className="flex-1">
          <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
            {status === "completed" ? "✨ Style transfer complete!" :
             status === "failed"    ? "❌ Something went wrong" :
             stage.label}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            VGG-19 is iteratively painting your image — step {step} of {totalSteps}
          </p>
        </div>
        <span className="mono font-semibold text-sm"
              style={{ color: stage.color, fontSize: 17, fontWeight: 700 }}>{pct}%</span>
      </div>

      {/* Progress track */}
      <div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {/* Stage indicators */}
        <div className="flex justify-between mt-2">
          {stages.map((s, i) => (
            <span key={i} style={{
              fontSize: 11, color: pct >= s.min ? s.color : "var(--text-tertiary)",
              fontWeight: pct >= s.min ? 600 : 400, transition: "color 0.3s ease",
            }}>
              {["Load","Extract","Style","Refine"][i]}
            </span>
          ))}
        </div>
      </div>

      {/* Loss cards — sage, forest, mauve, rose */}
      {losses.total !== null && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Content loss", value: losses.content },
            { label: "Style loss",   value: losses.style   },
            { label: "Total loss",   value: losses.total   },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3 text-center"
                 style={{ background: `${lossColors[label]}11`, border: `1px solid ${lossColors[label]}33` }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {label}
              </p>
              <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: lossColors[label], fontWeight: 500 }}>
                {value !== null ? value.toExponential(2) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="rounded-xl p-3 flex items-center gap-2"
           style={{ background: "var(--rose-muted)", border: "1px solid var(--rose)" }}>
        <span style={{ fontSize: 14 }}>💡</span>
        <p style={{ fontSize: 13, color: "var(--rose-dark)", lineHeight: 1.6 }}>
          CPU: ~3-5 min per image · GPU on Colab: ~30 sec · Don't close this tab
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// CompareSlider
// ─────────────────────────────────────────────
function CompareSlider({ originalUrl, styledUrl }) {
  const [pos,  setPos]  = useState(50);
  const [drag, setDrag] = useState(false);
  const wrapRef         = useRef(null);

  const toPercent = useCallback((clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onStart = useCallback((clientX) => {
    setDrag(true);
    setPos(toPercent(clientX));
  }, [toPercent]);

  const onMove = useCallback((clientX) => {
    if (drag) setPos(toPercent(clientX));
  }, [drag, toPercent]);

  const onStop = useCallback(() => setDrag(false), []);

  useEffect(() => {
    const mm = (e) => onMove(e.clientX);
    const tm = (e) => onMove(e.touches[0].clientX);
    const mu = () => onStop();
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
  }, [onMove, onStop]);

  // Blur logic:
  // Slider at 50  → both images sharp
  // Drag LEFT  (pos→0)   → original blurs out (up to 14px), stylized stays sharp
  // Drag RIGHT (pos→100) → stylized blurs out (up to 14px), original stays sharp
  const originalBlur = ((100 - pos) / 100) * 14;
  const styledBlur   = (pos / 100) * 14;

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-xl overflow-hidden border border-indigo-500/30"
      style={{ cursor: drag ? "grabbing" : "ew-resize", userSelect: "none" }}
      onMouseDown={(e) => { e.preventDefault(); onStart(e.clientX); }}
      onTouchStart={(e) => onStart(e.touches[0].clientX)}
    >
      {/* ORIGINAL — base layer, blurs as slider goes left */}
      <img
        src={originalUrl}
        alt="Original"
        draggable={false}
        className="block w-full"
        style={{
          maxHeight:       480,
          objectFit:       "cover",
          display:         "block",
          filter:          `blur(${originalBlur}px)`,
          transform:       "scale(1.05)",
          transformOrigin: "center",
          transition:      drag ? "none" : "filter 0.1s ease",
        }}
      />

      {/* STYLIZED — top layer clipped from left, blurs as slider goes right */}
      <img
        src={styledUrl}
        alt="Stylized"
        draggable={false}
        className="absolute inset-0 block w-full h-full"
        style={{
          objectFit:       "cover",
          objectPosition:  "top left",
          clipPath:        `inset(0 0 0 ${pos}%)`,
          filter:          `blur(${styledBlur}px)`,
          transform:       "scale(1.05)",
          transformOrigin: "center",
          transition:      drag ? "none" : "filter 0.1s ease",
        }}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-[2px]"
        style={{
          left:          `${pos}%`,
          transform:     "translateX(-50%)",
          pointerEvents: "none",
          background:    "linear-gradient(to bottom, transparent, white 8%, white 92%, transparent)",
          boxShadow:     "0 0 12px 3px rgba(255,255,255,0.4)",
        }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-10 h-10 rounded-full bg-white shadow-2xl
                     flex items-center justify-center"
          style={{
            pointerEvents: "none",
            boxShadow:     "0 0 0 2px rgba(255,255,255,0.6), 0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <SplitSquareHorizontal size={18} className="text-gray-700" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 bg-black/60 text-white text-[11px]
                       px-2.5 py-1 rounded-full font-medium pointer-events-none">
        ← Original
      </span>
      <span className="absolute top-3 right-3 bg-indigo-600/90 text-white text-[11px]
                       px-2.5 py-1 rounded-full font-medium pointer-events-none">
        Stylized →
      </span>

      {/* Hint */}
      {!drag && pos === 50 && (
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

  const apiBase     = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const styledUrl   = resultUrl?.startsWith("/") ? `${apiBase}${resultUrl}` : resultUrl;
  const originalUrl = contentFile ? URL.createObjectURL(contentFile) : null;

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
        <a href={styledUrl} target="_blank" rel="noreferrer"
           className="text-indigo-400 underline">
          Open directly in browser
        </a>
      </p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium
                     transition-colors"
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
