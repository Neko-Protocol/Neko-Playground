"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BannerPageProps {
  /** Main heading shown in large type. */
  title: string;
  /** Optional supporting text rendered below the title. */
  subtitle?: string;
  /**
   * Optional pill label displayed above the title (e.g. "See prices in real time").
   * Omit to hide the badge entirely.
   */
  badge?: string;
  /** Path or URL of the right-side illustration. */
  imageSrc?: string;
  /** Accessible description for the illustration (defaults to empty). */
  imageAlt?: string;
  /**
   * Slot for call-to-action buttons or links, rendered below the subtitle.
   * Accepts any ReactNode so callers decide the exact markup.
   */
  actions?: React.ReactNode;
  /** Escape hatch for one-off layout tweaks on the outer wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BannerPage — full-width hero banner used at the top of feature pages.
 *
 * Fixed design tokens:
 *  - background: #229EDF
 *  - border-radius: 24 px
 *  - min-height: 223 px (grows with content on smaller viewports)
 *  - max-width: 1169 px (enforced by the page layout, not the banner itself)
 *
 * All textual content is supplied via props so the same component can be
 * dropped into Swap, Borrow, Lend, Discover, and any future page without
 * modifications.
 */
export function BannerPage({
  title,
  subtitle,
  badge,
  imageSrc,
  imageAlt = "",
  actions,
  className,
}: BannerPageProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[1169px] overflow-hidden rounded-[24px] bg-[#229EDF]",
        "mx-auto flex min-h-[160px] sm:min-h-[210px] items-center pt-6",
        className
      )}
    >
      {/* Left — text content */}
      <div className="relative z-10 flex flex-col justify-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-5 sm:py-6">
        {badge && <Badge label={badge} />}

        <h2 className="text-2xl sm:text-[2rem] font-bold leading-tight tracking-tight text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="max-w-xs sm:max-w-sm text-xs sm:text-sm leading-relaxed text-white/70">
            {subtitle}
          </p>
        )}

        {actions && (
          <div className="mt-2 flex items-center gap-3">{actions}</div>
        )}
      </div>

      {/* Right — illustration (hidden on very small screens) */}
      {imageSrc && (
        <div className="hidden sm:block">
          <Illustration src={imageSrc} alt={imageAlt} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components — kept in this file to avoid fragmenting a simple UI
// ---------------------------------------------------------------------------

interface BadgeProps {
  label: string;
}

function Badge({ label }: BadgeProps) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
      {label}
    </span>
  );
}

interface IllustrationProps {
  src: string;
  alt: string;
}

function Illustration({ src, alt }: IllustrationProps) {
  return (
    // Occupies the right 45 % of the banner and is clipped by the parent's
    // overflow-hidden, which naturally creates the "image bleeding to the edge"
    // effect visible in the design.
    <div className="pointer-events-none absolute right-0 top-0 h-full w-[55%] select-none">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        priority
        className="object-contain object-right"
      />
    </div>
  );
}
