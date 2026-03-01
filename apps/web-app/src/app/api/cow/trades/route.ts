/**
 * CoW Protocol Trades API Route
 * Handles trade history operations with CoW Protocol APIs
 */

import { NextRequest, NextResponse } from "next/server";
import {
  COW_API_BASE_URLS,
  COW_API_ENDPOINTS,
} from "@/lib/constants/cowswapConfig";
import type { CowTradesResponse } from "@/lib/types";

/**
 * GET /api/cow/trades - Get raw trades for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const chainId = parseInt(searchParams.get("chainId") || "1");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!owner) {
      return NextResponse.json(
        { error: "Owner address is required" },
        { status: 400 }
      );
    }

    const baseUrl = COW_API_BASE_URLS[chainId] || COW_API_BASE_URLS[1];
    const url = new URL(`${baseUrl}${COW_API_ENDPOINTS.TRADES}`);
    url.searchParams.set("owner", owner);
    url.searchParams.set("offset", offset.toString());
    url.searchParams.set("limit", limit.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`CoW API Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `CoW API Error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: CowTradesResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /api/cow/trades:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
