import { NextResponse } from "next/server";
import { kycStore } from "@/server/kycStore";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  const entry = kycStore.getByAddress(address);
  return NextResponse.json({ entry });
}
