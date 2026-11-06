import type { CSSProperties } from "react";
import type { Badge as BadgeInfo, BadgeIcon, BadgeTier } from "@/lib/badges";

// Drawn in code: a shape per tier, colored from the badge's hue with the site's accent scale, and a label or icon in
// the middle. Locked badges are the same shape in gray.

/** The outer shape, on a 64 by 64 box. */
const SHAPES: Record<BadgeTier, string> = {
  // A round medal.
  chapter: "M32 6a26 26 0 1 1 0 52a26 26 0 1 1 0-52z",
  // A shield.
  level: "M32 4l24 8v18c0 15-10 26-24 30C18 56 8 45 8 30V12z",
  // A ten-point star.
  course: "M32 2l7 14 15-4-4 15 12 7-12 7 4 15-15-4-7 14-7-14-15 4 4-15-12-7 12-7-4-15 15 4z",
  // A rosette: a scalloped circle.
  milestone:
    "M32 4l5 4 6-2 3 6 6 1v7l5 4-3 6 3 6-5 4v7l-6 1-3 6-6-2-5 4-5-4-6 2-3-6-6-1v-7l-5-4 3-6-3-6 5-4v-7l6-1 3-6 6 2z",
};

const ICONS: Record<BadgeIcon, string> = {
  check: "M22 33l7 7 14-15",
  flame: "M32 18c6 7 10 11 10 17a10 10 0 1 1-20 0c0-4 2-7 5-9 0 4 2 6 4 6-1-6 1-10 1-14z",
  bolt: "M35 16L23 35h9l-3 13 12-19h-9z",
  up: "M32 18v28M21 29l11-11 11 11",
  star: "M32 20l3.5 7.5 8 1-6 5.5 1.6 8L32 38l-7.1 4 1.6-8-6-5.5 8-1z",
};

/** Icons drawn as lines, not filled shapes. */
const STROKED: BadgeIcon[] = ["check", "up"];

export default function Badge({ badge, size = 56, locked = false }: { badge: BadgeInfo; size?: number; locked?: boolean }) {
  const label = badge.label ?? "";
  const fontSize = label.length >= 3 ? 15 : label.length === 2 ? 18 : 22;
  const icon = badge.icon;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      style={{ "--hue": badge.hue } as CSSProperties}
      className={`shrink-0 ${locked ? "opacity-60" : ""}`}
    >
      <path d={SHAPES[badge.tier]} className={locked ? "fill-stone-200 dark:fill-stone-800" : "fill-accent-500 dark:fill-accent-600"} />
      {/* An inner ring, so the badge reads as a badge and not a button. */}
      <circle
        cx="32"
        cy={badge.tier === "level" ? 30 : 32}
        r="17"
        className={locked ? "fill-stone-100 dark:fill-stone-900" : "fill-accent-100 dark:fill-accent-950"}
      />
      {icon ? (
        <path
          d={ICONS[icon]}
          className={
            locked
              ? STROKED.includes(icon)
                ? "fill-none stroke-stone-400"
                : "fill-stone-400"
              : STROKED.includes(icon)
                ? "fill-none stroke-accent-700 dark:stroke-accent-300"
                : "fill-accent-700 dark:fill-accent-300"
          }
          strokeWidth={STROKED.includes(icon) ? 4 : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={badge.tier === "level" ? "translate(0 -2)" : undefined}
        />
      ) : (
        <text
          x="32"
          y={badge.tier === "level" ? 30 : 32}
          dy="0.35em"
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          className={locked ? "fill-stone-400" : "fill-accent-800 dark:fill-accent-200"}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
