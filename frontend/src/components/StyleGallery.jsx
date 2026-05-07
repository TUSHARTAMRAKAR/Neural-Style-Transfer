import { Palette } from "lucide-react";

const PRESET_COLORS = {
  starry_night: "linear-gradient(135deg, #1a237e, #fbc02d)",
  the_scream:   "linear-gradient(135deg, #e65100, #1565c0)",
  kandinsky:    "linear-gradient(135deg, #b71c1c, #f9a825)",
  mosaic:       "linear-gradient(135deg, #4e342e, #a1887f)",
  wave:         "linear-gradient(135deg, #0277bd, #e0f7fa)",
  udnie:        "linear-gradient(135deg, #2e7d32, #a1887f)",
};

const PRESET_ICONS = {
  starry_night: "🌌", the_scream: "😱", kandinsky: "🔺",
  mosaic: "🔲", wave: "🌊", udnie: "🎨",
};

export default function StyleGallery({ presets, selected, onSelect }) {
  if (!presets || presets.length === 0) return (
    <div style={{ textAlign: "center", padding: "24px", color: "var(--text-tertiary)", fontSize: 13 }}>
      Loading styles...
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Palette size={14} style={{ color: "var(--mauve-dark)" }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
          Choose an art style
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const isSelected = selected?.key === preset.key;
          return (
            <button
              key={preset.key}
              onClick={() => onSelect(isSelected ? null : preset)}
              className="relative rounded-2xl overflow-hidden text-left transition-all duration-200"
              style={{
                border:     `2px solid ${isSelected ? "var(--forest)" : "var(--border)"}`,
                transform:  isSelected ? "scale(1.03)" : "scale(1)",
                boxShadow:  isSelected ? "0 4px 16px rgba(81,151,85,0.25)" : "none",
              }}
            >
              {/* Thumbnail */}
              <div className="relative h-20 flex items-center justify-center"
                   style={{ background: PRESET_COLORS[preset.key] }}>
                {preset.thumbnail ? (
                  <img
                    src={`/style_images/${preset.key}.jpg`}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <span style={{ fontSize: 28 }}>{PRESET_ICONS[preset.key] || "🎨"}</span>
                )}

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center"
                       style={{ background: "rgba(81,151,85,0.2)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                         style={{ background: "var(--forest)" }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                           stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2" style={{ background: "var(--bg-surface)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}
                   className="truncate">{preset.name}</p>
                <p style={{ fontSize: 10, color: "var(--text-tertiary)" }}
                   className="truncate">{preset.artist}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <p style={{
          fontSize: 11, color: "var(--forest-dark)",
          background: "rgba(168,220,171,0.15)",
          border: "1px solid rgba(81,151,85,0.25)",
          borderRadius: 10, padding: "8px 12px", lineHeight: 1.6,
        }}>
          <strong>{selected.name}</strong> by {selected.artist}
          <span style={{ color: "var(--text-tertiary)" }}> — {selected.description}</span>
        </p>
      )}
    </div>
  );
}
