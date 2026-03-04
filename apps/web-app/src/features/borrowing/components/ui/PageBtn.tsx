import { ReactNode } from "react";

interface PageBtnProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

export function PageBtn({ children, onClick, disabled, active }: PageBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "bg-[#229EDF] text-white"
          : "text-white/50 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
