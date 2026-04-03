import React from "react";

interface Props {
  className?: string;
}

/** Aruban flag icon */
export default function FofotiLogo({ className = "w-10 h-10" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Light blue background */}
      <rect width="24" height="16" fill="#418FDE" rx="1.5"/>

      {/* Two narrow yellow stripes — lower third */}
      <rect x="0" y="10.5" width="24" height="1.6" fill="#FBE122"/>
      <rect x="0" y="13"   width="24" height="1.6" fill="#FBE122"/>

      {/* Red 4-pointed star with white outline — upper left */}
      {/* White outline star (slightly larger) */}
      <path
        d="M5 2 L5.55 3.8 L7.4 3.8 L5.9 4.9 L6.5 6.7 L5 5.55 L3.5 6.7 L4.1 4.9 L2.6 3.8 L4.45 3.8 Z"
        fill="white"
      />
      {/* Red star */}
      <path
        d="M5 2.5 L5.45 3.95 L7 3.95 L5.75 4.85 L6.2 6.3 L5 5.35 L3.8 6.3 L4.25 4.85 L3 3.95 L4.55 3.95 Z"
        fill="#C8102E"
      />
    </svg>
  );
}
