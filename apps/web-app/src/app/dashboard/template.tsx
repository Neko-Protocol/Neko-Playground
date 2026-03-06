import { ReactNode } from "react";

export default function DashboardTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="animate__animated animate__fadeInRight w-full min-w-0 max-w-full flex flex-col items-center overflow-x-hidden px-4 sm:px-6 py-6 sm:py-8">
      {children}
    </div>
  );
}
