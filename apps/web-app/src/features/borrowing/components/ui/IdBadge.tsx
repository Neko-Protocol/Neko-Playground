export function IdBadge({ id, isActive }: { id: string; isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? "text-[#76C464]" : "bg-white/5 text-white/40"
      }`}
      style={
        isActive ? { backgroundColor: "rgba(118,196,100,0.30)" } : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#76C464]" : "bg-white/20"}`}
      />
      {id}
    </span>
  );
}
