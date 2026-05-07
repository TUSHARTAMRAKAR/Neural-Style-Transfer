import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Sparkles, Settings, Github, BookOpen, Sun, Moon } from "lucide-react";
import UploadPanel from "./components/UploadPanel.jsx";
import StyleGallery from "./components/StyleGallery.jsx";
import { ProgressBar, ResultViewer } from "./components/ResultViewer.jsx";
import { useJobPoller } from "./hooks/useJobPoller.js";
import { fetchStyles, submitStylizeJob } from "./utils/api.js";

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" &&
    (localStorage.getItem("theme") === "dark" ||
     (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches))
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

const SUBJECT_MODES = {
  portrait:  { label: "Portrait",  emoji: "🧑", hint: "Preserves face structure, adds artistic texture",   contentWeight: 15000, styleWeight: 80_000_000,  numSteps: 300 },
  landscape: { label: "Landscape", emoji: "🌄", hint: "Bold dramatic transformation for scenes",            contentWeight: 5000,  styleWeight: 400_000_000, numSteps: 400 },
  abstract:  { label: "Max Style", emoji: "🎨", hint: "Maximum artistic effect — great for objects/scenes", contentWeight: 1000,  styleWeight: 900_000_000, numSteps: 400 },
};

const TAGLINES = [
  "Where pixels meet the paintbrush.",
  "Deep learning. Timeless art.",
  "Van Gogh never uploaded a selfie. You can.",
];

export default function App() {
  const [dark, setDark] = useDarkMode();
  const [contentFile,    setContentFile]    = useState(null);
  const [styleFile,      setStyleFile]      = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [useCustomStyle, setUseCustomStyle] = useState(false);
  const [presets,        setPresets]        = useState([]);
  const [subjectMode,    setSubjectMode]    = useState("portrait");
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [numSteps,       setNumSteps]       = useState(300);
  const [contentWeight,  setContentWeight]  = useState(15000);
  const [styleWeight,    setStyleWeight]    = useState(80_000_000);
  const [jobId,          setJobId]          = useState(null);
  const [appState,       setAppState]       = useState("idle");

  const { status, progress, step, totalSteps, losses, resultUrl, error: pollError } = useJobPoller(jobId);

  useEffect(() => {
    fetchStyles().then(d => setPresets(d.presets||[])).catch(() => toast.error("Backend not responding"));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    if (status === "completed") setAppState("done");
    if (status === "failed")    setAppState("error");
  }, [status, jobId]);

  const applyMode = (key) => {
    setSubjectMode(key);
    const m = SUBJECT_MODES[key];
    setNumSteps(m.numSteps); setContentWeight(m.contentWeight); setStyleWeight(m.styleWeight);
  };

  const hasStyle  = selectedPreset || styleFile;
  const canSubmit = contentFile && hasStyle && appState === "idle";

  const handleStylize = async () => {
    if (!canSubmit) return;
    try {
      setAppState("processing");
      const data = await submitStylizeJob(
        contentFile, useCustomStyle ? styleFile : null,
        useCustomStyle ? null : selectedPreset?.key,
        { num_steps: numSteps, content_weight: contentWeight, style_weight: styleWeight }
      );
      setJobId(data.job_id);
      toast.success("AI is painting your image! 🎨");
    } catch (err) { toast.error(err.message||"Failed to start."); setAppState("idle"); }
  };

  const handleReset = () => {
    setContentFile(null); setStyleFile(null); setSelectedPreset(null); setJobId(null); setAppState("idle");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>

      {/* ══ HEADER ══════════════════════════════════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
        backdropFilter: "blur(16px)",
      }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo area */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl animate-float"
                 style={{ background: "linear-gradient(135deg, var(--sage), var(--mauve))", flexShrink:0 }}>
              🎨
            </div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"1.35rem", color:"var(--text-primary)", lineHeight:1.2, letterSpacing:"-0.01em" }}>
                Neural Style Transfer
              </div>
              {/* Always-animating tagline */}
              <div style={{ position:"relative", height:20, overflow:"hidden", width:280, marginTop:3 }}>
                {TAGLINES.map((t,i) => (
                  <div key={i} className="tagline-item"
                       style={{ fontSize:12, color:"var(--mauve-dark)", fontStyle:"italic", lineHeight:1.5, fontWeight:500 }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-2">
            <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer"
               target="_blank" rel="noreferrer"
               className="tag-mauve flex items-center gap-2 hover:opacity-80 transition-opacity" style={{fontSize:14,padding:"6px 16px"}}>
              <Github size={16}/> GitHub
            </a>
            <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb"
               target="_blank" rel="noreferrer"
               className="tag-mauve flex items-center gap-2 hover:opacity-80 transition-opacity" style={{fontSize:14,padding:"6px 16px"}}>
              <BookOpen size={16}/> Colab
            </a>
            <button onClick={() => setDark(!dark)}
                    title={dark?"Light mode":"Dark mode"}
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                    style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)" }}>
              {dark
                ? <Sun  size={18} style={{ color:"var(--rose)" }}/>
                : <Moon size={18} style={{ color:"var(--mauve-dark)" }}/>}
            </button>
          </div>
        </div>
      </header>

      {/* ══ MAIN ══════════════════════════════════ */}
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Hero */}
        <div className="text-center mb-12 animate-fadeup">
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(2rem,5vw,3rem)", fontWeight:800, color:"var(--text-primary)", marginBottom:10 }}>
            Turn your photos into{" "}
            <span className="shimmer-text">masterpieces</span>
          </h2>

          {/* Subtitle with rose accent */}
          <p style={{ color:"var(--text-secondary)", maxWidth:560, margin:"0 auto", fontSize:17, lineHeight:1.85 }}>
            Upload your photo, pick a master artwork, and watch{" "}
            <span style={{ color:"var(--forest)", fontWeight:500 }}>VGG-19 deep learning</span>{" "}
            paint it in that exact artistic style — powered by{" "}
            <span style={{ color:"var(--mauve-dark)", fontWeight:500 }}>Gram matrix optimization</span>.
          </p>

          {/* Wildflowers palette swatches — all 4 visible */}
          <div className="flex justify-center gap-3 mt-6">
            {[
              { color:"#A8DCAB", label:"Sage — upload zones" },
              { color:"#519755", label:"Forest — actions" },
              { color:"#DBAAA7", label:"Rose — accents" },
              { color:"#BE91BE", label:"Mauve — tags" },
            ].map(({ color, label }) => (
              <div key={color} title={label}
                   className="w-9 h-9 rounded-full shadow-md hover:scale-110 transition-transform cursor-default"
                   style={{ background:color, boxShadow:`0 2px 8px ${color}55` }}/>
            ))}
          </div>
        </div>

        {/* ══ DONE STATE ═══ */}
        {appState === "done" ? (
          <div className="max-w-2xl mx-auto animate-fadeup">
            <ResultViewer resultUrl={resultUrl} contentFile={contentFile} onReset={handleReset}/>
          </div>

        ) : appState === "processing" ? (
        /* ══ PROCESSING STATE ═══ */
          <div className="max-w-xl mx-auto animate-fadeup">
            <ProgressBar status={status} progress={progress} step={step} totalSteps={totalSteps} losses={losses}/>
          </div>

        ) : (
        /* ══ IDLE STATE ═══ */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeup">

            {/* LEFT */}
            <div className="flex flex-col gap-5">
              {/* Upload panel — SAGE colored */}
              <UploadPanel
                label="Your photo (content image)"
                hint="JPG, PNG or WEBP · any size"
                file={contentFile} onFile={setContentFile}
              />

              {/* Toggle — Forest colored active state */}
              <div className="flex rounded-2xl overflow-hidden" style={{ border:"1px solid var(--border)" }}>
                {[["preset","Use preset"],["custom","Custom artwork"]].map(([v,lbl]) => (
                  <button key={v} onClick={() => setUseCustomStyle(v==="custom")}
                          className="flex-1 py-2.5 text-sm font-medium transition-all"
                          style={{
                            background: (v==="custom")===useCustomStyle ? "var(--forest)" : "var(--bg-elevated)",
                            color:      (v==="custom")===useCustomStyle ? "#fff" : "var(--text-secondary)",
                          }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {useCustomStyle
                ? <UploadPanel label="Your artwork (style image)" hint="Any painting · JPG, PNG" file={styleFile} onFile={setStyleFile}/>
                : <StyleGallery presets={presets} selected={selectedPreset} onSelect={setSelectedPreset}/>
              }
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-5">

              {/* Subject mode — MAUVE selected state */}
              <div className="card p-5">
                <p className="tag-mauve inline-block mb-3">What are you stylizing?</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(SUBJECT_MODES).map(([key, m]) => (
                    <button key={key} onClick={() => applyMode(key)}
                            className="py-4 px-3 rounded-xl text-sm font-medium transition-all text-center"
                            style={{
                              background:  subjectMode===key ? "var(--mauve-muted)" : "var(--bg-elevated)",
                              color:       subjectMode===key ? "var(--mauve-dark)" : "var(--text-secondary)",
                              border:      `1.5px solid ${subjectMode===key ? "var(--mauve)" : "var(--border)"}`,
                              transform:   subjectMode===key ? "scale(1.04)" : "scale(1)",
                              fontWeight:  subjectMode===key ? 600 : 400,
                            }}>
                      <div style={{ fontSize:24, marginBottom:6 }}>{m.emoji}</div>
                      {m.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:13, color:"var(--text-tertiary)", marginTop:10, fontStyle:"italic" }}>
                  {SUBJECT_MODES[subjectMode].hint}
                </p>
              </div>

              {/* Advanced — ROSE accent on values */}
              <div className="card p-5">
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center gap-2 text-base hover:opacity-80 transition-opacity"
                        style={{ color:"var(--text-secondary)" }}>
                  <Settings size={14} style={{ color:"var(--rose-dark)" }}/>
                  Fine-tune settings
                  <span style={{ marginLeft:"auto", color:"var(--text-tertiary)", fontSize:11 }}>
                    {showAdvanced?"▲":"▼"}
                  </span>
                </button>
                {showAdvanced && (
                  <div className="flex flex-col gap-4 pt-4 mt-3" style={{ borderTop:"1px solid var(--border)" }}>
                    {[
                      { label:"Quality steps", hint:"More = better, slower", min:50, max:500, step:50, val:numSteps, set:setNumSteps, disp:numSteps },
                      { label:"Style strength", hint:"Higher = more painterly",
                        min:1, max:10, step:1,
                        val:Math.round(Math.log10(styleWeight/1e8)*2+5),
                        set:(v)=>setStyleWeight(Math.pow(10,(v-5)/2+8)),
                        disp:styleWeight>=1e9?`${(styleWeight/1e9).toFixed(1)}B`:`${(styleWeight/1e6).toFixed(0)}M` },
                      { label:"Content preservation", hint:"Higher = photo-like",
                        min:1, max:10, step:1,
                        val:Math.round(Math.log10(contentWeight)-1),
                        set:(v)=>setContentWeight(Math.pow(10,v+1)),
                        disp:contentWeight>=1000?`${(contentWeight/1000).toFixed(1)}K`:contentWeight },
                    ].map(({ label,hint,min,max,step,val,set,disp }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span style={{ fontSize:12, fontWeight:500, color:"var(--text-secondary)" }}>{label}</span>
                          <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:"var(--rose-dark)", fontWeight:500 }}>{disp}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={val}
                               onChange={e=>set(Number(e.target.value))} className="w-full"/>
                        <p style={{ fontSize:10, color:"var(--text-tertiary)" }}>{hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How it works — SAGE numbered steps */}
              <div className="card p-5">
                <p className="tag-mauve inline-block mb-3">How it works</p>
                <ol className="flex flex-col gap-2.5">
                  {[
                    { text:"VGG-19 extracts features from both images",    color:"var(--sage-dark)" },
                    { text:"Content loss preserves your photo's structure", color:"var(--forest)" },
                    { text:"Style loss via Gram matrices captures texture", color:"var(--mauve-dark)" },
                    { text:"L-BFGS optimizer blends them iteratively",      color:"var(--rose-dark)" },
                  ].map(({ text, color }, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color:"var(--text-secondary)" }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs"
                            style={{ background:`${color}22`, color, border:`1px solid ${color}55` }}>
                        {i+1}
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Submit — FOREST button */}
              <button onClick={handleStylize} disabled={!canSubmit}
                      className={`w-full flex items-center justify-center gap-2.5 py-5 rounded-2xl text-lg font-semibold transition-all ${canSubmit?"btn-forest":""}`}
                      style={!canSubmit?{ background:"var(--bg-elevated)", color:"var(--text-tertiary)", border:"1px solid var(--border)", cursor:"not-allowed" }:{}}>
                <Sparkles size={20}/>
                {!contentFile ? "Upload your photo first" : !hasStyle ? "Pick a style" : "Stylize my image"}
              </button>
            </div>
          </div>
        )}

        {/* Error — ROSE */}
        {(appState==="error"||pollError) && (
          <div className="mt-6 p-4 alert-rose text-sm">
            <strong>Error:</strong> {pollError||"Style transfer failed."}
            <button onClick={handleReset} className="ml-3 underline">Reset</button>
          </div>
        )}
      </main>

      {/* ══ FOOTER ═══════════════════════════════════ */}
      <footer style={{ borderTop:"1px solid var(--border)", marginTop:80 }}>
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-8">

          {/* Tech stack — each card uses a different accent color */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { icon:"🧠", title:"AI Engine",  desc:"VGG-19 · PyTorch\nGram Matrix",   accent:"var(--sage-dark)",   bg:"var(--sage-muted)" },
              { icon:"⚡", title:"Backend",    desc:"FastAPI · Uvicorn\nAsync Jobs",    accent:"var(--forest)",      bg:"var(--forest-muted)" },
              { icon:"⚛️", title:"Frontend",  desc:"React 18 · Vite\nTailwindCSS",     accent:"var(--rose-dark)",   bg:"var(--rose-muted)" },
              { icon:"☁️", title:"Cloud",      desc:"Vercel · Render\nHF Spaces",       accent:"var(--mauve-dark)",  bg:"var(--mauve-muted)" },
            ].map(({ icon,title,desc,accent,bg }) => (
              <div key={title}
                   className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl transition-all hover:scale-105"
                   style={{ background:bg, border:`1px solid ${accent}33` }}>
                <span className="text-3xl">{icon}</span>
                <p style={{ fontSize:14, fontWeight:600, color:accent }}>{title}</p>
                <p style={{ fontSize:12, color:"var(--text-tertiary)", lineHeight:1.8, whiteSpace:"pre-line" }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ height:1, background:"linear-gradient(to right,transparent,var(--border),transparent)", marginBottom:24 }}/>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-5 mb-8">
            {[
              { label:"GitHub",   href:"https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer", icon:"⭐", color:"var(--forest)" },
              { label:"Live App", href:"https://neural-style-transfer-pied.vercel.app",            icon:"🌐", color:"var(--sage-dark)" },
              { label:"Colab",    href:"https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb", icon:"📓", color:"var(--mauve-dark)" },
              { label:"API Docs", href:"https://neural-style-transfer-api.onrender.com/docs",      icon:"📡", color:"var(--rose-dark)" },
              { label:"Paper",    href:"https://arxiv.org/abs/1508.06576",                         icon:"📄", color:"var(--forest)" },
            ].map(({ label,href,icon,color }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer"
                 className="flex items-center gap-2 text-sm hover:opacity-80 transition-all hover:scale-105"
                 style={{ color }}>
                <span>{icon}</span>{label}
              </a>
            ))}
          </div>

          <div style={{ height:1, background:"linear-gradient(to right,transparent,var(--border),transparent)", marginBottom:24 }}/>

          {/* Made with love */}
          <div className="text-center">
            <p style={{ fontSize:17, color:"var(--text-secondary)" }}>
              Made with <span style={{ color:"var(--rose)", display:"inline-block" }} className="animate-pulse">❤️</span> by{" "}
              <a href="https://github.com/TUSHARTAMRAKAR" target="_blank" rel="noreferrer"
                 className="shimmer-text font-semibold" style={{ textDecoration:"none" }}>
                Tushar Tamrakar
              </a>
            </p>
            <p style={{ fontSize:13, color:"var(--text-tertiary)", marginTop:8 }}>
              © {new Date().getFullYear()} Neural Style Transfer · MIT License
            </p>
            {/* Wildflowers palette strip */}
            <div className="flex justify-center gap-0 mt-5 overflow-hidden rounded-full w-32 mx-auto" style={{ height:4 }}>
              {["#A8DCAB","#519755","#DBAAA7","#BE91BE"].map(c=>(
                <div key={c} style={{ flex:1, background:c }}/>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
