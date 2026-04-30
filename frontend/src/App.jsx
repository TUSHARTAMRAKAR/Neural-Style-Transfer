/**
 * App.jsx — Main application component
 *
 * UI Flow:
 *   IDLE → upload content + pick style → READY → click Stylize
 *   → PROCESSING (poll progress) → COMPLETED (show result)
 *
 * State machine:
 *   "idle"       — nothing uploaded yet
 *   "ready"      — content + style selected, ready to submit
 *   "processing" — job submitted, polling for progress
 *   "done"       — result available
 *   "error"      — something failed
 */

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Sparkles, Settings, Github, BookOpen } from "lucide-react";

import UploadPanel          from "./components/UploadPanel.jsx";
import StyleGallery         from "./components/StyleGallery.jsx";
import { ProgressBar }      from "./components/ResultViewer.jsx";
import { ResultViewer }     from "./components/ResultViewer.jsx";
import { useJobPoller }     from "./hooks/useJobPoller.js";
import { fetchStyles, submitStylizeJob } from "./utils/api.js";

export default function App() {
  // ── Image state ────────────────────────────────────────
  const [contentFile,    setContentFile]    = useState(null);
  const [styleFile,      setStyleFile]      = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // ── Style presets from API ──────────────────────────────
  const [presets,        setPresets]        = useState([]);
  const [useCustomStyle, setUseCustomStyle] = useState(false);

  // ── Advanced params ─────────────────────────────────────
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [subjectMode,    setSubjectMode]    = useState("portrait"); // portrait | landscape | abstract
  const [numSteps,       setNumSteps]       = useState(300);
  const [contentWeight,  setContentWeight]  = useState(15000);
  const [styleWeight,    setStyleWeight]    = useState(80000000);

  // Subject mode presets — apply recommended settings instantly
  const SUBJECT_PRESETS = {
    portrait:  { label: "Portrait / Face", numSteps: 300, contentWeight: 15000,  styleWeight: 80000000,   hint: "Safe for faces — preserves face structure, adds subtle artistic texture" },
    landscape: { label: "Landscape / Scene", numSteps: 400, contentWeight: 5000,  styleWeight: 400000000,  hint: "Bold style for scenery — strong effect without destroying structure" },
    abstract:  { label: "Max Style / Abstract", numSteps: 400, contentWeight: 1000,  styleWeight: 900000000,  hint: "Maximum style — great for scenery, objects. Face will distort heavily" },
  };

  const applySubjectMode = (mode) => {
    const p = SUBJECT_PRESETS[mode];
    setSubjectMode(mode);
    setNumSteps(p.numSteps);
    setContentWeight(p.contentWeight);
    setStyleWeight(p.styleWeight);
  };

  // ── Job tracking ────────────────────────────────────────
  const [jobId,          setJobId]          = useState(null);
  const [appState,       setAppState]       = useState("idle");

  // Poll job status while processing
  const { status, progress, step, totalSteps, losses, resultUrl, error: pollError } =
    useJobPoller(jobId);

  // ── Load presets on mount ───────────────────────────────
  useEffect(() => {
    fetchStyles()
      .then((data) => setPresets(data.presets || []))
      .catch(() => toast.error("Could not load style presets. Is the backend running?"));
  }, []);

  // ── Sync job status → appState ──────────────────────────
  useEffect(() => {
    if (!jobId) return;
    if (status === "completed") setAppState("done");
    if (status === "failed")    setAppState("error");
  }, [status, jobId]);

  // ── Derived: can we submit? ─────────────────────────────
  const hasStyle  = selectedPreset || styleFile;
  const canSubmit = contentFile && hasStyle && appState === "idle";

  // ── Submit job ──────────────────────────────────────────
  const handleStylize = async () => {
    if (!canSubmit) return;
    try {
      setAppState("processing");
      const data = await submitStylizeJob(
        contentFile,
        useCustomStyle ? styleFile : null,
        useCustomStyle ? null : selectedPreset?.key,
        { num_steps: numSteps, content_weight: contentWeight, style_weight: styleWeight }
      );
      setJobId(data.job_id);
      toast.success("Job started! Sit back while AI works its magic 🎨");
    } catch (err) {
      toast.error(err.message || "Failed to start job.");
      setAppState("idle");
    }
  };

  // ── Reset ───────────────────────────────────────────────
  const handleReset = () => {
    setContentFile(null);
    setStyleFile(null);
    setSelectedPreset(null);
    setJobId(null);
    setAppState("idle");
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎨</div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-none">
                Neural Style Transfer
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Powered by VGG-19 + PyTorch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/yourusername/neural-style-transfer"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Github size={15} /> GitHub
            </a>
            <a
              href="https://colab.research.google.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <BookOpen size={15} /> Colab
            </a>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Turn your photos into{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              masterpieces
            </span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            Upload your photo, pick an artistic style, and watch deep learning
            paint your image in the style of Van Gogh, Hokusai, or Kandinsky.
          </p>
        </div>

        {appState === "done" ? (
          /* ── Result view ── */
          <div className="max-w-2xl mx-auto">
            <ResultViewer resultUrl={resultUrl} onReset={handleReset} />
          </div>
        ) : appState === "processing" ? (
          /* ── Progress view ── */
          <div className="max-w-xl mx-auto">
            <ProgressBar
              status={status}
              progress={progress}
              step={step}
              totalSteps={totalSteps}
              losses={losses}
            />
          </div>
        ) : (
          /* ── Upload + configure view ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* LEFT: content + style upload */}
            <div className="flex flex-col gap-6">
              <UploadPanel
                label="Your photo (content image)"
                hint="JPG, PNG or WEBP · any size"
                file={contentFile}
                onFile={setContentFile}
              />

              {/* Style source toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
                <button
                  onClick={() => setUseCustomStyle(false)}
                  className={`flex-1 py-2.5 font-medium transition-colors ${
                    !useCustomStyle
                      ? "bg-indigo-600 text-white"
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  Use preset
                </button>
                <button
                  onClick={() => setUseCustomStyle(true)}
                  className={`flex-1 py-2.5 font-medium transition-colors ${
                    useCustomStyle
                      ? "bg-indigo-600 text-white"
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  Custom artwork
                </button>
              </div>

              {useCustomStyle ? (
                <UploadPanel
                  label="Your artwork (style image)"
                  hint="Any painting or texture — JPG, PNG"
                  file={styleFile}
                  onFile={setStyleFile}
                />
              ) : (
                <StyleGallery
                  presets={presets}
                  selected={selectedPreset}
                  onSelect={setSelectedPreset}
                />
              )}
            </div>

            {/* RIGHT: settings + submit */}
            <div className="flex flex-col gap-6">
              {/* Subject mode picker — most important setting */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  What are you stylizing?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(SUBJECT_PRESETS).map(([mode, p]) => (
                    <button
                      key={mode}
                      onClick={() => applySubjectMode(mode)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border
                        ${subjectMode === mode
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20"
                        }`}
                    >
                      {mode === "portrait" ? "🧑 Portrait" : mode === "landscape" ? "🌄 Landscape" : "🎨 Abstract"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {SUBJECT_PRESETS[subjectMode].hint}
                </p>
              </div>

              {/* Advanced settings */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <Settings size={15} className="text-gray-500" />
                  Fine-tune settings
                  <span className="ml-auto text-gray-600 text-xs">
                    {showAdvanced ? "▲" : "▼"}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/5">
                    {/* Live value display */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Steps",   value: numSteps },
                        { label: "Style",   value: styleWeight >= 1e9 ? `${(styleWeight/1e9).toFixed(1)}B` : `${(styleWeight/1e6).toFixed(0)}M` },
                        { label: "Content", value: contentWeight >= 1000 ? `${(contentWeight/1000).toFixed(0)}K` : contentWeight },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-900/60 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">{label}</p>
                          <p className="text-xs font-mono text-indigo-300 font-medium">{value}</p>
                        </div>
                      ))}
                    </div>

                    <Slider
                      label="Quality steps"
                      hint="100=fast preview · 300=good · 500=best quality"
                      min={50} max={500} step={50}
                      value={numSteps}
                      onChange={setNumSteps}
                    />

                    <div className="flex flex-col gap-1.5 mt-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-300">Style strength</span>
                        <span className="text-xs font-mono text-indigo-400">
                          {styleWeight >= 1e9 ? `${(styleWeight/1e9).toFixed(1)}B` : `${(styleWeight/1e6).toFixed(0)}M`}
                        </span>
                      </div>
                      <input type="range" min={1} max={100} step={1}
                        value={Math.round(styleWeight / 10000000)}
                        onChange={(e) => setStyleWeight(Number(e.target.value) * 10000000)}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Subtle (10M)</span><span>Portrait (100M)</span><span>Scene (500M)</span><span>Max (1B)</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-300">Content preservation</span>
                        <span className="text-xs font-mono text-indigo-400">
                          {contentWeight >= 1000 ? `${(contentWeight/1000).toFixed(0)}K` : contentWeight}
                        </span>
                      </div>
                      <input type="range" min={100} max={50000} step={100}
                        value={contentWeight}
                        onChange={(e) => setContentWeight(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Abstract (100)</span><span>Portrait (10K)</span><span>Photo-like (50K)</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-600 mt-1 text-center">
                      Tip: Use the subject buttons above to reset to recommended values
                    </p>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
                  How it works
                </p>
                <ol className="flex flex-col gap-2">
                  {[
                    ["1", "VGG-19 extracts features from both images"],
                    ["2", "Content loss preserves your photo's structure"],
                    ["3", "Style loss (Gram matrices) captures texture"],
                    ["4", "L-BFGS optimizer blends them iteratively"],
                  ].map(([n, text]) => (
                    <li key={n} className="flex items-start gap-2.5 text-xs text-gray-500">
                      <span className="w-4 h-4 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center flex-shrink-0 font-medium text-[10px]">
                        {n}
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Submit button */}
              <button
                onClick={handleStylize}
                disabled={!canSubmit}
                className={`
                  w-full flex items-center justify-center gap-2.5 py-4 rounded-xl
                  text-base font-semibold transition-all duration-200
                  ${canSubmit
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 hover:scale-[1.01]"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                  }
                `}
              >
                <Sparkles size={18} />
                {canSubmit
                  ? "Stylize my image"
                  : !contentFile
                    ? "Upload your photo first"
                    : !hasStyle
                      ? "Pick a style"
                      : "Ready!"}
              </button>

              {!canSubmit && contentFile && (
                <p className="text-center text-xs text-gray-600">
                  {!hasStyle ? "Select a preset or upload a custom style image" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error banner */}
        {(appState === "error" || pollError) && (
          <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-800/30 text-sm text-red-300">
            <strong>Error:</strong> {pollError || "Style transfer failed. Please try again."}
            <button
              onClick={handleReset}
              className="ml-3 underline text-red-400 hover:text-white"
            >
              Reset
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 mt-20">

        {/* Tech stack cards */}
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { icon: "🧠", title: "AI Engine",    desc: "VGG-19 + PyTorch\nGram Matrix Optimization" },
              { icon: "⚡", title: "Backend",      desc: "FastAPI + Uvicorn\nAsync Job Queue" },
              { icon: "⚛️", title: "Frontend",    desc: "React 18 + Vite\nTailwindCSS" },
              { icon: "☁️", title: "Cloud",        desc: "Hugging Face Spaces\nGoogle Colab GPU" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-2xl">{icon}</span>
                <p className="text-xs font-medium text-gray-300">{title}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">{desc}</p>
              </div>
            ))}
          </div>

          {/* Gradient divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {[
              { label: "GitHub",         href: "https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer", icon: "⭐" },
              { label: "Live Demo",      href: "https://huggingface.co/spaces/TUSHARTAMRAKAR/neural-style-transfer", icon: "🌐" },
              { label: "Colab Notebook", href: "https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb", icon: "📓" },
              { label: "API Docs",       href: "http://localhost:8000/docs", icon: "📡" },
              { label: "Original Paper", href: "https://arxiv.org/abs/1508.06576", icon: "📄" },
            ].map(({ label, href, icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                <span>{icon}</span>{label}
              </a>
            ))}
          </div>

          {/* Gradient divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

          {/* Research citation */}
          <div className="text-center mb-8">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Based on{" "}
              <a href="https://arxiv.org/abs/1508.06576" target="_blank" rel="noreferrer"
                className="text-indigo-500/70 hover:text-indigo-400 transition-colors">
                Gatys, Ecker & Bethge — "A Neural Algorithm of Artistic Style" (2015)
              </a>
              {" "}·{" "}
              <a href="https://arxiv.org/abs/1409.1556" target="_blank" rel="noreferrer"
                className="text-indigo-500/70 hover:text-indigo-400 transition-colors">
                VGG-19 by Simonyan & Zisserman (2014)
              </a>
            </p>
          </div>

          {/* Made with love */}
          <div className="text-center pb-10">
            <p className="text-sm text-gray-500">
              Made with{" "}
              <span className="text-red-500 animate-pulse inline-block">❤️</span>
              {" "}by{" "}
              <a href="https://github.com/TUSHARTAMRAKAR" target="_blank" rel="noreferrer"
                className="font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:from-indigo-300 hover:to-purple-300 transition-all">
                Tushar Tamrakar
              </a>
            </p>
            <p className="text-[11px] text-gray-700 mt-2">
              © {new Date().getFullYear()} Neural Style Transfer · MIT License
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable Slider component ── */
function Slider({ label, hint, min, max, step, value, onChange, displayValue }) {
  return (
    <div className="flex flex-col gap-1.5 mt-3">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <span className="text-xs font-mono text-indigo-400">
          {displayValue ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <p className="text-[10px] text-gray-600">{hint}</p>
    </div>
  );
}
