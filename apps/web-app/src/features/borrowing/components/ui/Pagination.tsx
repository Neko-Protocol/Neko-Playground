import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageBtn } from "./PageBtn";
import { ROWS_PER_PAGE_OPTIONS } from "../../hooks/useBorrow";

interface PaginationProps {
  page: number;
  totalRows: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (value: number) => void;
}

export function Pagination({
  page,
  totalRows,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: PaginationProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i)
    .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
    .reduce<(number | "…")[]>((acc, i, idx, arr) => {
      if (idx > 0 && (i as number) - (arr[idx - 1] as number) > 1)
        acc.push("…");
      acc.push(i);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
      <div className="flex items-center gap-2 text-white/40 text-xs">
        <span>Rows per page</span>
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          className="bg-[#2A2A2A] border border-white/10 rounded-lg px-2 py-1 text-white/60 text-xs outline-none cursor-pointer"
        >
          {ROWS_PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          {page * rowsPerPage} – {Math.min((page + 1) * rowsPerPage, totalRows)}{" "}
          of {totalRows} rows
        </span>
      </div>

      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPageChange(0)} disabled={page === 0}>
          <ChevronFirst className="h-3.5 w-3.5" />
        </PageBtn>
        <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 0}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageBtn>

        {pageNumbers.map((item, idx) =>
          item === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1 text-white/30 text-xs"
            >
              …
            </span>
          ) : (
            <PageBtn
              key={item}
              onClick={() => onPageChange(item as number)}
              active={page === item}
            >
              {(item as number) + 1}
            </PageBtn>
          )
        )}

        <PageBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageBtn>
        <PageBtn
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronLast className="h-3.5 w-3.5" />
        </PageBtn>
      </div>
    </div>
  );
}
