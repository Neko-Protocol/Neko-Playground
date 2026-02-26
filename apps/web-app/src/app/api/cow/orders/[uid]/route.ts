/**
 * Individual Order API Route
 * Handles operations for specific orders by UID
 */

import { NextRequest, NextResponse } from "next/server";
import {
  COW_API_BASE_URLS,
  COW_API_ENDPOINTS,
} from "@/lib/constants/cowswapConfig";
import type { CowOrder, CowOrderStatus } from "@/lib/types/cowswapTypes";

/**
 * GET /api/cow/orders/[uid] - Get specific order by UID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const uid = params.uid;
    const { searchParams } = new URL(request.url);
    const chainId = parseInt(searchParams.get("chainId") || "1");

    if (!uid) {
      return NextResponse.json(
        { error: "Order UID is required" },
        { status: 400 }
      );
    }

    const baseUrl = COW_API_BASE_URLS[chainId] || COW_API_BASE_URLS[1];
    const url = `${baseUrl}${COW_API_ENDPOINTS.ORDER_BY_UID(uid)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      console.error(`CoW API Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `CoW API Error: ${response.status}` },
        { status: response.status }
      );
    }

    const order: CowOrder = await response.json();
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error in GET /api/cow/orders/[uid]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cow/orders/[uid]/status - Get order status
 */
export async function getOrderStatus(
  uid: string,
  chainId: number = 1
): Promise<CowOrderStatus | null> {
  try {
    const baseUrl = COW_API_BASE_URLS[chainId] || COW_API_BASE_URLS[1];
    const url = `${baseUrl}${COW_API_ENDPOINTS.ORDER_STATUS(uid)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Order not found
      }
      throw new Error(
        `CoW API Error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching order status:", error);
    return null;
  }
}
