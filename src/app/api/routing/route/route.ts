import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";

type PointBody = { lat: number; lng: number };

type OsrmRouteResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number;
    geometry: { type: string; coordinates: [number, number][] };
  }>;
};

type GhRouteResponse = {
  message?: string;
  paths?: Array<{
    distance: number;
    points: { type: string; coordinates: [number, number][] };
  }>;
};

function isValidPoint(p: unknown): p is PointBody {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as PointBody;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 步行貼路路由代理。
 * 優先 GraphHopper（若設 GRAPHHOPPER_*）；否則 OSRM foot。
 * POST { points: [{lat,lng}, ...] }
 */
export async function POST(request: Request) {
  try {
    await requireUser();

    const body = (await request.json()) as { points?: PointBody[] };
    const points = body.points;
    if (!Array.isArray(points) || points.length < 2) {
      return jsonError("POINTS_REQUIRED");
    }
    if (points.length > 50) return jsonError("TOO_MANY_POINTS");
    if (!points.every(isValidPoint)) return jsonError("INVALID_POINTS");

    const ghBase = process.env.GRAPHHOPPER_BASE_URL?.replace(/\/$/, "");
    const ghKey = process.env.GRAPHHOPPER_API_KEY;

    if (ghBase) {
      return jsonOk(await routeGraphHopper(points, ghBase, ghKey));
    }

    const osrmBase =
      process.env.OSRM_BASE_URL?.replace(/\/$/, "") ||
      "https://routing.openstreetmap.de/routed-foot";

    return jsonOk(await routeOsrm(points, osrmBase));
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return jsonError("ROUTING_TIMEOUT", 504);
    }
    if (err instanceof UpstreamError) {
      return jsonError(err.code, err.status);
    }
    return handleRouteError(err);
  }
}

class UpstreamError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function routeOsrm(points: PointBody[], base: string) {
  // FOSSGIS routed-foot 仍用 path 內的 driving segment（profile 在主機路徑）
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error("OSRM HTTP", res.status);
    throw new UpstreamError("ROUTING_UPSTREAM", 502);
  }

  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code && data.code !== "Ok") {
    console.error("OSRM code", data.code, data.message);
    throw new UpstreamError("ROUTING_FAILED", 422);
  }

  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new UpstreamError("ROUTING_FAILED", 422);
  }

  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  return {
    distance_m: Math.round(route.distance),
    geometry: {
      type: "LineString" as const,
      coordinates: route.geometry.coordinates,
    },
    coordinates,
  };
}

async function routeGraphHopper(
  points: PointBody[],
  base: string,
  apiKey?: string,
) {
  const url = new URL(`${base}/route`);
  if (apiKey) url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile: "foot",
      points: points.map((p) => [p.lng, p.lat]),
      points_encoded: false,
      instructions: false,
      elevation: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error("GraphHopper HTTP", res.status);
    throw new UpstreamError("ROUTING_UPSTREAM", 502);
  }

  const data = (await res.json()) as GhRouteResponse;
  const path = data.paths?.[0];
  if (!path?.points?.coordinates?.length) {
    console.error("GraphHopper fail", data.message);
    throw new UpstreamError("ROUTING_FAILED", 422);
  }

  const coordinates = path.points.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  return {
    distance_m: Math.round(path.distance),
    geometry: {
      type: "LineString" as const,
      coordinates: path.points.coordinates,
    },
    coordinates,
  };
}
