import type { Metadata } from "next";
import Borrow from "@/features/borrowing/components/pages/Borrow";

export const metadata: Metadata = {
  title: "Borrowing | Neko Protocol",
  description: "Borrow assets against your collateral in Neko Protocol.",
};

export default function BorrowingPage() {
  return <Borrow />;
}
