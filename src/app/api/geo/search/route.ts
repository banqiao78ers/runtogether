import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";

const NOMINATIM_URL =
  process.env.NOMINATIM_BASE_URL?.replace(/\/$/, "") ||
  "https://nominatim.openstreetmap.org";

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  place_id: number;
};

/**
 * 地名搜尋代理（Nominatim）。
 * GET /api/geo/search?q=板橋
 */
export async function GET(request: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) return jsonError("QUERY_REQUIRED");

    const url = new URL(`${NOMINATIM_URL}/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "BanqiaoRunningPWA/1.0 (route-planner; contact@local)",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("Nominatim error", res.status);
      return jsonError("GEO_UPSTREAM", 502);
    }

    const data = (await res.json()) as NominatimItem[];
    const results = (data ?? []).map((item) => ({
      id: String(item.place_id),
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));

    return jsonOk({ results });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return jsonError("GEO_TIMEOUT", 504);
    }
    return handleRouteError(err);
  }
}
