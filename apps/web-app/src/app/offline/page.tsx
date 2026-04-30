import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#121212] px-6 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#229EDF]/20 text-2xl font-semibold text-[#7dd3fc]">
          N
        </div>
        <h1 className="text-2xl font-semibold">Sin acceso a internet</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Neko cargo el ultimo shell disponible. Revisa tu conexion para
          continuar con datos en tiempo real y acciones onchain.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-full bg-[#229EDF] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1b8fcb]"
        >
          Ir al dashboard
        </Link>
      </div>
    </main>
  );
}
