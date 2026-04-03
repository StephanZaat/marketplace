import React, { useId } from "react";

interface Props {
  rating: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  showCount?: boolean;
}

const STAR_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

export default function StarDisplay({ rating, count, size = "sm", showCount = true }: Props) {
  const uid = useId();
  const px = size === "xs" ? 12 : size === "sm" ? 14 : 18;
  const textSize = size === "xs" ? "text-xs" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={`flex items-center gap-0.5 ${textSize}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPct = Math.round(Math.min(1, Math.max(0, rating - (star - 1))) * 100);
        const gradId = `${uid}-${star}`;
        return (
          <svg key={star} width={px} height={px} viewBox="0 0 20 20">
            <defs>
              <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fillPct}%`} stopColor="#FFD200" />
                <stop offset={`${fillPct}%`} stopColor="#d1d5db" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradId})`} />
          </svg>
        );
      })}
      {showCount && count !== undefined && (
        <span className="text-gray-400 ml-0.5">({count})</span>
      )}
    </div>
  );
}
