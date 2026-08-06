import type { DashboardPayload, Env, GearAsset } from "./types";
import { loadTurnoutGear } from "./operative";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.DASHBOARD_ACCESS_KEY) return true;
  return request.headers.get("x-dashboard-key") === env.DASHBOARD_ACCESS_KEY;
}

function buildDashboard(gear: GearAsset[], lookaheadDays: number): DashboardPayload {
  const now = new Date();
  const currentYear = now.getFullYear();
  const maintenanceDue = gear
    .filter((item) => item.daysUntilDue !== null && item.daysUntilDue <= lookaheadDays)
    .sort((a, b) => (a.daysUntilDue ?? 99999) - (b.daysUntilDue ?? 99999));

  const forecast = new Map<number, { coats: number; pants: number; other: number }>();
  for (let year = currentYear; year <= currentYear + 9; year++) forecast.set(year, { coats: 0, pants: 0, other: 0 });
  for (const item of gear) {
    if (!item.retirementDate) continue;
    const year = new Date(item.retirementDate).getFullYear();
    const bucket = forecast.get(year);
    if (!bucket) continue;
    if (item.gearType === "Coat") bucket.coats++;
    else if (item.gearType === "Pant") bucket.pants++;
    else bucket.other++;
  }

  return {
    generatedAt: new Date().toISOString(),
    lookaheadDays,
    metrics: {
      overdue: gear.filter((x) => x.status === "Overdue").length,
      dueNext30Days: gear.filter((x) => x.daysUntilDue !== null && x.daysUntilDue >= 0 && x.daysUntilDue <= 30).length,
      due31To60Days: gear.filter((x) => x.daysUntilDue !== null && x.daysUntilDue >= 31 && x.daysUntilDue <= 60).length,
      retiringThisYear: gear.filter((x) => x.retirementDate && new Date(x.retirementDate).getFullYear() === currentYear).length,
      retiringNext3Years: gear.filter((x) => {
        if (!x.retirementDate) return false;
        const year = new Date(x.retirementDate).getFullYear();
        return year >= currentYear && year <= currentYear + 2;
      }).length,
      warehouseItems: gear.filter((x) => x.locationType === "Warehouse").length,
      missingLocation: gear.filter((x) => x.currentLocation === "Unknown").length
    },
    maintenanceDue,
    decommissionForecast: [...forecast.entries()].map(([year, counts]) => ({ year, ...counts }))
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") && !isAuthorized(request, env)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, service: "wtfd-turnout-gear-dashboard", time: new Date().toISOString() });
      }

      if (url.pathname === "/api/dashboard") {
        const lookaheadDays = Number(env.MAINTENANCE_LOOKAHEAD_DAYS || 30);
        const gear = await loadTurnoutGear(env);
        return json(buildDashboard(gear, lookaheadDays));
      }

      if (url.pathname === "/api/maintenance-due") {
        const days = Math.max(0, Math.min(365, Number(url.searchParams.get("days") || env.MAINTENANCE_LOOKAHEAD_DAYS || 30)));
        const gear = await loadTurnoutGear(env);
        const items = gear
          .filter((item) => item.daysUntilDue !== null && item.daysUntilDue <= days)
          .sort((a, b) => (a.daysUntilDue ?? 99999) - (b.daysUntilDue ?? 99999));
        return json({ generatedAt: new Date().toISOString(), days, count: items.length, items });
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
    }
  }
} satisfies ExportedHandler<Env>;
