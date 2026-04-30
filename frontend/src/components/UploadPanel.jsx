/**
 * UploadPanel.jsx
 * Drag-and-drop (or click-to-browse) image upload zone.
 * Shows preview after file is selected.
 */

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

export default function UploadPanel({ label, hint, file, onFile, accept = "image/*" }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging] = useState(false);

  const preview = file ? URL.createObjectURL(file) : null;

  const handleFile = useCallback(
    (f) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        alert("Please upload an image file (JPG, PNG, WEBP).");
        return;
      }
      onFile(f);
    },
    [onFile]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const onInputChange = (e) => handleFile(e.target.files[0]);

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <ImageIcon size={16} className="text-indigo-400" />
        <span className="text-sm font-medium text-gray-300">{label}</span>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden
          ${file ? "border-indigo-500/50 cursor-default" : "cursor-pointer hover:border-indigo-400"}
          ${dragging ? "border-indigo-400 bg-indigo-950/50 scale-[1.01]" : "border-white/10"}
          ${!file ? "bg-white/[0.02] hover:bg-white/[0.04]" : ""}
        `}
        style={{ minHeight: "180px" }}
      >
        {file && preview ? (
          /* Image preview */
          <>
            <img
              src={preview}
              alt="preview"
              className="w-full h-48 object-cover rounded-xl"
            />
            {/* Remove button */}
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-900/80 text-white transition-colors"
              title="Remove image"
            >
              <X size={14} />
            </button>
            {/* Filename badge */}
            <div className="absolute bottom-2 left-2 right-2">
              <span className="text-xs bg-black/70 text-gray-300 px-2 py-1 rounded-md truncate block">
                {file.name}
              </span>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-center px-4">
            <div className="p-3 rounded-full bg-indigo-950/60 text-indigo-400">
              <Upload size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-300">
                Drop image here or{" "}
                <span className="text-indigo-400 font-medium underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">{hint}</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
