import { ReactNode } from "react";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return (
    <div
      className="animate__animated animate__fadeInRight w-full flex flex-col items-center"
    >
      {children}
    </div>
  );
}
