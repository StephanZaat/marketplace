import React, { useState } from "react";
import { MapPin, X } from "lucide-react";

interface Props {
  location: string;
  className?: string;
}

// Approximate lat/lon for known Aruba areas
const AREA_COORDS: Record<string, [number, number]> = {
  // "Alto Vista":     [12.569559, -70.024117],
  "Babijn":         [12.540645, -69.994163],
  "Barcadera":      [12.482954, -69.989916],
  // "Boegoeroei":     [12.557642, -70.031179],
  // "Bringamosa":     [12.491402, -69.962128],
  "Bubali":         [12.552396, -70.048419],
  "Bushiri":        [12.539316, -70.048636],
  // "Calbas":         [12.557485, -70.004976],
  "Catiri":         [12.543221, -70.016148],
  // "Cunucu Abao":    [12.547913, -70.045587],
  "Dakota":         [12.513267, -70.022359],
  "Punta Brabo":    [12.547767, -70.058225],
  // "Hooiberg":       [12.520799, -69.997972],
  "Madiki":         [12.528580, -70.040636],
  // "Malmok":         [12.600855, -70.050156],
  "Noord":          [12.563350, -70.032058],
  "Oranjestad":     [12.520102, -70.037133],
  "Palm Beach":     [12.568921, -70.042718],
  "Paradera":       [12.535126, -70.006878],
  "Piedra Plat":    [12.525197, -69.992029],
  "Ponton":         [12.537419, -70.030974],
  "Pos Chikito":    [12.464947, -69.964812],
  // "Sabana Liber":   [12.559653, -70.022358],
  "San Nicolas":    [12.436142, -69.910839],
  "Santa Cruz":     [12.509444, -69.980974],
  "Savaneta":       [12.451928, -69.950037],
  // "Seroe Blanco":   [12.526601, -70.023099],
  // "Sero Colorado":  [12.419849, -69.884601],
  "Tanki Flip":     [12.545861, -70.030650],
  "Tanki Leendert": [12.542426, -70.026199],
  "Tierra del Sol": [12.603617, -70.042606],
  "Washington":     [12.558909, -70.037101],
  // "Wayaca":         [12.503611, -70.002564],
  "Westpunt":       [12.592513, -70.038169],
};

const ARUBA_CENTER: [number, number] = [12.5211, -69.9683];

export default function LocationMap({ location, className = "" }: Props) {
  const [open, setOpen] = useState(false);

  const [lat, lon] = AREA_COORDS[location] ?? ARUBA_CENTER;
  const d = 0.045;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const linkUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${location}, Aruba`)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 hover:text-ocean-600 hover:underline transition-colors ${className}`}
        title="Show on map"
      >
        <MapPin className="w-4 h-4 shrink-0" />
        <span>{location}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MapPin className="w-4 h-4 text-ocean-600" />
                {location}, Aruba
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title={`Map of ${location}`}
              src={embedUrl}
              className="w-full h-72 border-0"
              loading="lazy"
            />
            <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-400 flex items-center justify-between">
              <span>Approximate location only</span>
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean-600 hover:underline"
              >
                Open in OpenStreetMap ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
