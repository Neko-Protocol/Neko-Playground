import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#121212] px-6">
      {/* Decorative blur orbs */}
      <div className="pointer-events-none absolute right-[-80px] top-[-80px] h-[400px] w-[400px] rounded-full bg-[#294cab]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-80px] left-[-80px] h-[360px] w-[360px] rounded-full bg-[#39bfb7]/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#334eac]/10 blur-2xl" />

      {/* Logo */}
      <Link href="/dashboard" className="mb-12">
        <Image
          src="/Neko.svg"
          alt="Neko Protocol"
          width={80}
          height={80}
          className="w-auto opacity-90 transition-opacity duration-200 hover:opacity-100"
          priority
        />
      </Link>

      {/* 404 display */}
      <div className="relative text-center">
        <p className="font-boldmb-2 select-none text-[160px] leading-none text-white/5 sm:text-[220px]">
          404
        </p>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold mb-1 text-[72px] leading-none tracking-tight text-white sm:text-[96px]">
            4<span className="text-[#359edf]">0</span>4
          </span>
        </div>
      </div>

      {/* Copy */}
      <div className="relative z-10 mt-2 flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          We lost this page.
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-white/40">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back to familiar territory.
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 mt-10 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
