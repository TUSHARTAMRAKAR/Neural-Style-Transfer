import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

export default function UploadPanel({ label, hint, file, onFile }) {
  const inputRef   = useRef(null);
  const [drag, setDrag] = useState(false);
  const preview    = file ? URL.createObjectURL(file) : null;

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    onFile(f);
  }, [onFile]);

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ImageIcon size={14} style={{ color: "var(--forest)" }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
      </div>

      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className="relative rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          minHeight: 180,
          border: `2px dashed ${drag ? "var(--forest)" : file ? "var(--sage-dark)" : "var(--border)"}`,
          background: drag ? "rgba(168,220,171,0.08)" : "var(--bg-elevated)",
          cursor: file ? "default" : "pointer",
          transform: drag ? "scale(1.01)" : "scale(1)",
        }}
      >
        {file && preview ? (
          <>
            <img src={preview} alt="preview"
                 className="w-full object-cover"
                 style={{ height: 180 }} />
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              <X size={14} color="white" />
            </button>
            <div className="absolute bottom-2 left-2 right-2">
              <span className="text-xs px-2 py-1 rounded-md truncate block"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                {file.name}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <div className="p-3 rounded-full" style={{ background: "rgba(81,151,85,0.12)" }}>
              <Upload size={22} style={{ color: "var(--forest)" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Drop image here or{" "}
                <span style={{ color: "var(--forest)", fontWeight: 500, textDecoration: "underline" }}>
                  browse
                </span>
              </p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{hint}</p>
            </div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
             onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}
