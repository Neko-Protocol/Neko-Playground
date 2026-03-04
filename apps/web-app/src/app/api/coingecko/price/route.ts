import { NextRequest, NextResponse } from "next/server";

function getCoinGeckoApiKey(): string | null {
  const envKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  if (envKey && typeof envKey === "string" && envKey.trim() !== "") {
    return envKey.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get("ids");
    const vsCurrencies = searchParams.get("vs_currencies") || "usd";

    if (!ids) {
      return NextResponse.json(
        { error: "Missing required parameter: ids" },
        { status: 400 }
      );
    }

    const apiKey = getCoinGeckoApiKey();
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["x-cg-demo-api-key"] = apiKey;
    }

    const include24hrChange = searchParams.get("include_24hr_change");
    let url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}`;
    if (include24hrChange === "true") {
      url += "&include_24hr_change=true";
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }

      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `CoinGecko API error: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch price",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
