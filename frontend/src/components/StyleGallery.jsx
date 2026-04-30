/**
 * StyleGallery.jsx
 * Shows preset art styles as selectable cards.
 * User can pick a preset OR skip to upload their own style image.
 */

import { Palette } from "lucide-react";

// Fallback colors per preset (shown when thumbnail not available)
const PRESET_COLORS = {
  starry_night: "from-blue-900 to-yellow-700",
  the_scream:   "from-orange-800 to-blue-900",
  kandinsky:    "from-red-700 to-yellow-600",
  mosaic:       "from-amber-800 to-stone-700",
  wave:         "from-blue-700 to-white/20",
  udnie:        "from-green-900 to-amber-800",
};

// Emoji fallback icons per preset
const PRESET_ICONS = {
  starry_night: "🌌",
  the_scream:   "😱",
  kandinsky:    "🔺",
  mosaic:       "🔲",
  wave:         "🌊",
  udnie:        "🎨",
};

export default function StyleGallery({ presets, selected, onSelect }) {
  if (!presets || presets.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Loading styles...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Palette size={16} className="text-purple-400" />
        <span className="text-sm font-medium text-gray-300">
          Choose an art style
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const isSelected = selected?.key === preset.key;
          const gradientClass = PRESET_COLORS[preset.key] || "from-gray-800 to-gray-700";
          const icon = PRESET_ICONS[preset.key] || "🎨";

          return (
            <button
              key={preset.key}
              onClick={() => onSelect(isSelected ? null : preset)}
              className={`
                relative rounded-xl overflow-hidden transition-all duration-200 text-left group
                border-2 focus:outline-none
                ${isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-[1.02]"
                  : "border-white/10 hover:border-white/25 hover:scale-[1.01]"
                }
              `}
            >
              {/* Thumbnail or gradient fallback */}
              <div className={`h-20 bg-gradient-to-br ${gradientClass} flex items-center justify-center relative`}>
                {preset.thumbnail ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${preset.thumbnail}`}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <span className="text-3xl">{icon}</span>
                )}

                {/* Selected overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2 bg-gray-900/80">
                <p className="text-xs font-medium text-gray-200 truncate">{preset.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{preset.artist}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/40 rounded-lg px-3 py-2">
          Selected: <span className="font-medium">{selected.name}</span> by {selected.artist}
          <span className="text-gray-400"> — {selected.description}</span>
        </p>
      )}
    </div>
  );
}
