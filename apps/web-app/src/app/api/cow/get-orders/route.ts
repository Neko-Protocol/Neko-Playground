/**
 * CoW Protocol Orders API Route
 * Handles order-related operations with CoW Protocol APIs
 */

import { NextRequest, NextResponse } from "next/server";
import {
  COW_API_BASE_URLS,
  COW_API_ENDPOINTS,
} from "@/lib/constants/cowswapConfig";
import type { CowOrder } from "@/lib/types/cowswapTypes";
import { cowSwapService } from "@/lib/services/cowswap.service";

/**
 * GET /api/cow/get-orders - Get processed orders for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return NextResponse.json(
        { error: "Owner address is required" },
        { status: 400 }
      );
    }

    const rawOrders: CowOrder[] = [];
    const orders = cowSwapService.processOrders(rawOrders, 1);

    return NextResponse.json({
      orders,
      meta: { total: 0, hasMore: false },
      message:
        "Order management functionality coming soon. Check your orders on CoW Explorer.",
    });
  } catch (error) {
    console.error("Error in /api/cow/get-orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cow/get-orders - Cancel orders
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderUids, signature, signingScheme, chainId = 1 } = body;

    if (!orderUids || !signature) {
      return NextResponse.json(
        { error: "orderUids and signature are required" },
        { status: 400 }
      );
    }

    const baseUrl = COW_API_BASE_URLS[chainId] || COW_API_BASE_URLS[1];
    const url = `${baseUrl}${COW_API_ENDPOINTS.ORDERS}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderUids,
        signature,
        signingScheme: signingScheme || "eip712",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`CoW API Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `CoW API Error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/cow/get-orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
