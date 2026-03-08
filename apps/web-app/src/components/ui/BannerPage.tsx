"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BannerPageProps {
  title: string;

  subtitle?: string;

  badge?: string;

  imageSrc?: string;

  imageAlt?: string;

  actions?: React.ReactNode;

  className?: string;
}

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
        "relative w-full max-w-full min-w-0 overflow-hidden rounded-2xl sm:rounded-[24px] bg-[#229EDF]",
        "mx-auto flex min-h-[140px] sm:min-h-[210px] items-center pt-6",
        className
      )}
    >
      {}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-2 sm:gap-2.5 px-4 sm:px-8 py-4 sm:py-6">
        {badge && <Badge label={badge} />}

        <h2 className="text-xl sm:text-[2rem] font-bold leading-tight tracking-tight text-white wrap-break-word">
          {title}
        </h2>

        {subtitle && (
          <p className="w-full max-w-full min-w-0 text-xs sm:text-sm leading-relaxed text-white/90 wrap-break-word">
            {subtitle}
          </p>
        )}

        {actions && (
          <div className="mt-2 flex items-center gap-3">{actions}</div>
        )}
      </div>

      {}
      {imageSrc && (
        <div className="hidden sm:block">
          <Illustration src={imageSrc} alt={imageAlt} />
        </div>
      )}
    </div>
  );
}

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
