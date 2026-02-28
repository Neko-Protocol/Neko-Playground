"use client";

import React from "react";

interface ModalCloseButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
  onClick,
  ariaLabel = "Close",
  className = "text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-200",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={className}
    aria-label={ariaLabel}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5L5 15M5 5l10 10" />
    </svg>
  </button>
);
