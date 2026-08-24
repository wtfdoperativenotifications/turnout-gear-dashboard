import type { DashboardPayload, DueStatus, GearAsset, LocationType, MemberCoverage, ReplacementItem, SourceDiagnostic, SupplyInventoryPayload } from "./types";

interface Env {
  ASSETS: Fetcher;
  TURNOUT_GEAR_SOURCE_URL?: string;
  OPERATIVE_BASE_URL?: string;
  OPERATIVE_TURNOUT_PATH?: string;
  OPERATIVE_ASSETS_PATH?: string;
  OPERATIVE_ASSIGNMENTS_PATH?: string;
  OPERATIVE_INSPECTIONS_PATH?: string;
  TURNOUT_GEAR_SOURCE_TOKEN?: string;
  OPERATIVE_API_TOKEN?: string;
  OPERATIVE_API_KEY?: string;
  OPERATIVE_BASIC_AUTH?: string;
  OPERATIVE_AUTH_HEADER?: string;
  DASHBOARD_ACCESS_KEY?: string;
  MAINTENANCE_LOOKAHEAD_DAYS?: string;
  TURNOUT_CATEGORY_PATTERN?: string;
}

type JsonRecord = Record<string, unknown>;
const DAY = 86_400_000;

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function flattenedEntries(record: JsonRecord, depth = 0, prefix = ""): Array<[string, unknown]> {
  if (depth > 4) return [];
  const result: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    result.push([path, value]);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenedEntries(value as JsonRecord, depth + 1, path));
    }
  }
  return result;
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  const wanted = new Set(keys.map(canonicalKey));
  for (const [path, value] of flattenedEntries(record)) {
    const leaf = path.split(".").at(-1) || path;
    if (wanted.has(canonicalKey(leaf)) || wanted.has(canonicalKey(path))) return value;
  }
  return undefined;
}

function firstText(record: JsonRecord, keys: string[]): string {
  const value = firstValue(record, keys);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function firstNumber(record: JsonRecord, keys: string[]): number | null {
  const value = firstValue(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dateValue(record: JsonRecord, keys: string[]): string | null {
  const raw = firstValue(record, keys);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();
  if (typeof raw === "number") {
    const parsed = new Date(raw < 10_000_000_000 ? raw * 1000 : raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function addYears(value: string, years: number): string {
  const date = new Date(value);
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function scoreArray(rows: unknown[]): number {
  if (!rows.length) return -1;
  const sample = rows.filter(isRecord).slice(0, 12);
  if (!sample.length) return -1;
  const hints = ["asset", "description", "serial", "barcode", "manufacturer", "inspection", "maintenance", "assigned", "location", "category", "service", "decommission", "retirement", "size"];
  let score = Math.min(rows.length, 100) / 100;
  for (const row of sample) {
    const keys = Object.keys(row).join(" ").toLowerCase();
    score += hints.filter(h => keys.includes(h)).length;
  }
  return score;
}

function discoverRecords(payload: unknown): { rows: JsonRecord[]; path: string } {
  const candidates: Array<{ rows: JsonRecord[]; path: string; score: number }> = [];
  const seen = new Set<unknown>();
  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > 9 || value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      const rows = value.filter(isRecord);
      if (rows.length) candidates.push({ rows, path, score: scoreArray(value) });
      value.slice(0, 30).forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value as JsonRecord)) walk(child, path ? `${path}.${key}` : key, depth + 1);
  };
  walk(payload, "$", 0);
  candidates.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
  return candidates[0] ? { rows: candidates[0].rows, path: candidates[0].path } : { rows: [], path: "" };
}

function daysFromToday(value: string | null): number | null {
  if (!value) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(value); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY);
}

function yearsFromDate(value: string | null): number | null {
  if (!value) return null;
  return Math.max(0, Math.round(((Date.now() - new Date(value).getTime()) / (DAY * 365.2425)) * 10) / 10);
}

function statusFor(days: number | null): DueStatus {
  if (days === null) return "Unknown";
  if (days < 0) return "Overdue";
  if (days <= 30) return "Due Soon";
  if (days <= 60) return "Due Later";
  return "Compliant";
}

function gearType(description: string, category: string): string {
  const text = `${description} ${category}`.toLowerCase();
  if (/coat|jacket/.test(text)) return "Coat";
  if (/pant|trouser/.test(text)) return "Pant";
  if (text.includes("helmet")) return "Helmet";
  if (text.includes("hood")) return "Hood";
  if (text.includes("boot")) return "Boots";
  if (text.includes("glove")) return "Gloves";
  return category || "Other";
}

function requiresAnnualInspection(asset: Pick<GearAsset, "gearType">): boolean {
  return asset.gearType === "Coat" || asset.gearType === "Pant";
}

function isPhoenixAsset(asset: Pick<GearAsset, "currentLocation" | "assignedTo">): boolean {
  return /phoenix\s*gear\s*repair\s*supply\s*room/i.test(`${asset.currentLocation} ${asset.assignedTo}`);
}

function normalizeLocationType(rawType: string, currentLocation: string, issuedTo: string): LocationType {
  const direct = rawType.trim().toLowerCase();
  const combined = `${currentLocation} ${issuedTo}`.toLowerCase();

  // Physical location takes priority over assignment metadata. OperativeIQ uses the
  // exact physical location name "Turnout Gear Supply Warehouse" for warehouse inventory.
  if (combined.includes("turnout gear supply warehouse") || combined.includes("turnout gear warehouse")) return "Warehouse";
  if (/\bwarehouse\b|logistics|supply/.test(combined)) return "Warehouse";
  if (/reserve|spare|cache/.test(combined)) return "Reserve";
  if (/station\s*4[1-5]|fire station/.test(combined)) return "Station";

  if (direct.includes("warehouse")) return "Warehouse";
  if (direct.includes("reserve") || direct.includes("spare") || direct.includes("cache")) return "Reserve";
  if (direct.includes("station")) return "Station";
  if (direct.includes("issued") || direct.includes("member") || direct.includes("crew")) return "Issued to Member";
  if (issuedTo && !/unassigned|warehouse|station|reserve|spare/i.test(issuedTo)) return "Issued to Member";
  return "Unassigned";
}

function location(record: JsonRecord): { assignedTo: string; currentLocation: string; locationType: LocationType } {
  // Version 8 uses the confirmed preview schema first.
  const assignedTo = firstText(record, ["issuedTo"]) || "Unassigned";
  const currentLocation = firstText(record, ["physicalLocation", "currentLocation", "location", "to"]) || assignedTo || "Unknown";
  const rawType = firstText(record, ["locationType"]);
  return { assignedTo, currentLocation, locationType: normalizeLocationType(rawType, currentLocation, assignedTo) };
}

function normalize(record: JsonRecord, index: number): GearAsset {
  // Confirmed fields from /preview-turnout-gear (61/61 records in the Data Explorer).
  const gearIdentifier = firstText(record, ["gearIdentifier"]);
  const partDescription = firstText(record, ["partDescription"]);
  const subcategory = firstText(record, ["subcategory"]);
  const assetDescription = partDescription || gearIdentifier || `Turnout gear ${index + 1}`;

  const lastMaintenanceDate = dateValue(record, ["lastServiceDate"]);
  const nextMaintenanceDate = dateValue(record, ["nextServiceDate"]);
  const plannedDecommissionDate = dateValue(record, ["plannedDecommissionDate"]);
  const sourceDaysLeft = firstNumber(record, ["daysLeft"]);
  const daysUntilDue = sourceDaysLeft ?? daysFromToday(nextMaintenanceDate);

  // The planned decommission date represents the ten-year lifecycle target.
  const explicitInServiceDate = dateValue(record, ["inServiceDate", "placedInServiceDate", "purchaseDate"]);
  const inferredInServiceDate = !explicitInServiceDate && plannedDecommissionDate
    ? addYears(plannedDecommissionDate, -10)
    : null;
  const inServiceDate = explicitInServiceDate || inferredInServiceDate;

  const sourceId = firstText(record, ["assetId", "partId", "id", "barcode", "serialNumber"]) || gearIdentifier || "turnout-gear";

  return {
    id: `${sourceId}-${index + 1}`,
    assetDescription,
    gearType: gearType(assetDescription, subcategory),
    manufacturer: firstText(record, ["manufacturer", "manufacturerName", "make", "brand"]),
    model: firstText(record, ["model", "modelName", "productModel"]),
    size: gearType(assetDescription, subcategory) === "Coat"
      ? firstText(record, ["coatSize", "coat_Size", "size", "assetSize", "itemSize"])
      : gearType(assetDescription, subcategory) === "Pant"
        ? firstText(record, ["pantSize", "pant_Size", "size", "assetSize", "itemSize"])
        : firstText(record, ["size", "assetSize", "itemSize"]),
    assetTag: firstText(record, ["assetTag", "assetTagNumber", "tagNumber", "assetNumber"]),
    serialNumber: firstText(record, ["serialNumber", "serial", "serialNo", "assetSerial"]),
    barcode: firstText(record, ["barcode", "assetNumber", "assetTag", "tagNumber"]),
    ...location(record),
    inServiceDate,
    retirementDate: plannedDecommissionDate,
    lastMaintenanceDate,
    nextMaintenanceDate,
    maintenanceDateSource: nextMaintenanceDate ? "OperativeIQ due date" : "Missing",
    daysUntilDue,
    yearsInService: yearsFromDate(inServiceDate),
    status: statusFor(daysUntilDue)
  };
}

function authHeaders(env: Env): { headers: Headers; mode: string } {
  const headers = new Headers({ Accept: "application/json" });
  const bearer = env.OPERATIVE_API_TOKEN || env.TURNOUT_GEAR_SOURCE_TOKEN;
  if (env.OPERATIVE_AUTH_HEADER) { headers.set("Authorization", env.OPERATIVE_AUTH_HEADER); return { headers, mode: "Custom Authorization" }; }
  if (bearer) { headers.set("Authorization", `Bearer ${bearer}`); return { headers, mode: "Bearer token" }; }
  if (env.OPERATIVE_API_KEY) { headers.set("x-api-key", env.OPERATIVE_API_KEY); return { headers, mode: "X-API-Key" }; }
  if (env.OPERATIVE_BASIC_AUTH) { headers.set("Authorization", `Basic ${env.OPERATIVE_BASIC_AUTH}`); return { headers, mode: "Basic authorization" }; }
  return { headers, mode: "None" };
}

async function fetchJson(url: string, headers: Headers): Promise<{ response: Response; text: string; payload?: unknown }> {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) return { response, text };
  try { return { response, text, payload: JSON.parse(text) }; }
  catch { return { response, text }; }
}

function endpointCandidates(env: Env): string[] {
  if (!env.OPERATIVE_BASE_URL) return [];
  const base = env.OPERATIVE_BASE_URL.endsWith("/") ? env.OPERATIVE_BASE_URL : `${env.OPERATIVE_BASE_URL}/`;
  const configured = [env.OPERATIVE_TURNOUT_PATH, env.OPERATIVE_ASSETS_PATH].filter((x): x is string => !!x && x.trim().length > 0);
  const defaults = [
    "/api/assets",
    "/api/assets/all",
    "/api/asset-management/assets",
    "/api/asset-management",
    "/api/assets?includeAssignments=true"
  ];
  const paths = [...configured, ...defaults];
  return [...new Set(paths)].map(path => new URL(path.replace(/^\//, ""), base).toString());
}

function mergeByAssetId(baseRows: JsonRecord[], childRows: JsonRecord[]): JsonRecord[] {
  if (!childRows.length) return baseRows;
  const byId = new Map<string, JsonRecord[]>();
  for (const row of childRows) {
    const id = firstText(row, ["assetId", "itemId", "asset.id", "id"]);
    if (!id) continue;
    byId.set(id, [...(byId.get(id) || []), row]);
  }
  return baseRows.map(row => {
    const id = firstText(row, ["id", "assetId", "itemId", "asset.id"]);
    const matches = byId.get(id) || [];
    return Object.assign({}, row, ...matches);
  });
}

async function loadOptionalRows(env: Env, path: string | undefined, headers: Headers): Promise<JsonRecord[]> {
  if (!env.OPERATIVE_BASE_URL || !path) return [];
  const url = new URL(path.replace(/^\//, ""), env.OPERATIVE_BASE_URL.endsWith("/") ? env.OPERATIVE_BASE_URL : `${env.OPERATIVE_BASE_URL}/`).toString();
  try {
    const result = await fetchJson(url, headers);
    if (!result.response.ok || result.payload === undefined) return [];
    return discoverRecords(result.payload).rows;
  } catch { return []; }
}

async function loadDirectOperative(env: Env, auth: { headers: Headers; mode: string }): Promise<{ gear: GearAsset[]; source: string; diagnostic: SourceDiagnostic } | null> {
  const candidates = endpointCandidates(env);
  if (!candidates.length) return null;
  const attemptedUrls: string[] = [];
  let lastStatus: number | undefined;
  let lastText = "";

  for (const url of candidates) {
    attemptedUrls.push(url);
    try {
      const result = await fetchJson(url, auth.headers);
      lastStatus = result.response.status;
      lastText = result.text;
      if (!result.response.ok || result.payload === undefined) continue;

      const discovered = discoverRecords(result.payload);
      if (!discovered.rows.length) continue;
      const assignments = await loadOptionalRows(env, env.OPERATIVE_ASSIGNMENTS_PATH, auth.headers);
      const inspections = await loadOptionalRows(env, env.OPERATIVE_INSPECTIONS_PATH, auth.headers);
      const merged = mergeByAssetId(mergeByAssetId(discovered.rows, assignments), inspections);
      const pattern = new RegExp(env.TURNOUT_CATEGORY_PATTERN || "turnout|coat|pant|trouser|bunker", "i");
      const normalized = merged.map(normalize).filter(item => pattern.test(`${item.assetDescription} ${item.gearType}`));
      if (!normalized.length) continue;
      return {
        gear: normalized,
        source: url,
        diagnostic: {
          ok: true, code: "LIVE", message: "Live turnout gear data loaded directly from OperativeIQ.",
          httpStatus: 200, sourceUrl: url, discoveredPath: discovered.path,
          recordCount: discovered.rows.length, matchedCount: normalized.length,
          topLevelKeys: isRecord(result.payload) ? Object.keys(result.payload).slice(0, 30) : [],
          authMode: auth.mode, sourceMode: "Direct OperativeIQ", attemptedUrls
        }
      };
    } catch (error) {
      lastText = error instanceof Error ? error.message : String(error);
    }
  }

  const code = lastStatus === 401 || lastStatus === 403 ? "AUTHENTICATION_FAILED" : "SOURCE_UNAVAILABLE";
  return {
    gear: [], source: env.OPERATIVE_BASE_URL || "Direct OperativeIQ",
    diagnostic: {
      ok: false, code,
      message: code === "AUTHENTICATION_FAILED"
        ? "OperativeIQ rejected the configured credentials."
        : "Direct OperativeIQ endpoints could not return usable turnout gear records.",
      httpStatus: lastStatus, sourceUrl: env.OPERATIVE_BASE_URL,
      responsePreview: lastText.slice(0, 800), authMode: auth.mode,
      sourceMode: "Direct OperativeIQ", attemptedUrls
    }
  };
}

async function loadLegacyPreview(env: Env, auth: { headers: Headers; mode: string }): Promise<{ gear: GearAsset[]; source: string; diagnostic: SourceDiagnostic }> {
  const sourceUrl = env.TURNOUT_GEAR_SOURCE_URL;
  if (!sourceUrl) return { gear: [], source: "Not configured", diagnostic: { ok: false, code: "NOT_CONFIGURED", message: "Neither direct OperativeIQ nor the legacy preview source is configured.", sourceMode: "Not configured" } };
  try {
    const result = await fetchJson(sourceUrl, auth.headers);
    if (!result.response.ok) {
      const code = result.response.status === 401 || result.response.status === 403 ? "AUTHENTICATION_FAILED" : "SOURCE_UNAVAILABLE";
      return { gear: [], source: sourceUrl, diagnostic: { ok: false, code, message: code === "AUTHENTICATION_FAILED" ? "The legacy preview Worker rejected the credentials." : `The legacy preview Worker returned HTTP ${result.response.status}.`, httpStatus: result.response.status, sourceUrl, responsePreview: result.text.slice(0, 800), authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
    }
    if (result.payload === undefined) return { gear: [], source: sourceUrl, diagnostic: { ok: false, code: "INVALID_JSON", message: "The legacy preview Worker did not return valid JSON.", httpStatus: result.response.status, sourceUrl, responsePreview: result.text.slice(0, 800), authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
    const discovered = discoverRecords(result.payload);
    const topLevelKeys = isRecord(result.payload) ? Object.keys(result.payload).slice(0, 30) : [];
    if (!discovered.rows.length) return { gear: [], source: sourceUrl, diagnostic: { ok: false, code: "NO_RECORDS", message: "JSON was returned, but no asset record array could be located.", httpStatus: 200, sourceUrl, topLevelKeys, authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
    const pattern = new RegExp(env.TURNOUT_CATEGORY_PATTERN || "turnout|coat|pant|trouser|bunker", "i");
    const normalized = discovered.rows.map(normalize).filter(item => pattern.test(`${item.assetDescription} ${item.gearType}`));
    if (!normalized.length) return { gear: [], source: sourceUrl, diagnostic: { ok: false, code: "NO_MATCHES", message: "Asset records were returned, but none matched the turnout gear filter.", httpStatus: 200, sourceUrl, discoveredPath: discovered.path, recordCount: discovered.rows.length, matchedCount: 0, topLevelKeys, authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
    return { gear: normalized, source: sourceUrl, diagnostic: { ok: true, code: "LIVE", message: "Live turnout gear data loaded through the legacy preview Worker.", httpStatus: 200, sourceUrl, discoveredPath: discovered.path, recordCount: discovered.rows.length, matchedCount: normalized.length, topLevelKeys, authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
  } catch (error) {
    return { gear: [], source: sourceUrl, diagnostic: { ok: false, code: "SOURCE_ERROR", message: error instanceof Error ? error.message : "Unknown source error", sourceUrl, authMode: auth.mode, sourceMode: "Legacy preview Worker", attemptedUrls: [sourceUrl] } };
  }
}

function safePreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (typeof value === "object") return "[Object]";
  return String(value);
}

function isSecretField(path: string): boolean {
  return /token|secret|password|authorization|apikey|api_key|credential|cookie/i.test(path);
}

function explorerFields(record: JsonRecord): Array<{ path: string; value: string }> {
  return flattenedEntries(record)
    .filter(([path, value]) => !isSecretField(path) && (value === null || typeof value !== "object"))
    .slice(0, 160)
    .map(([path, value]) => ({ path, value: safePreviewValue(value) }));
}

async function loadDataExplorer(env: Env): Promise<{ ok: boolean; status: number; body: unknown }> {
  const auth = authHeaders(env);
  const sourceUrl = env.TURNOUT_GEAR_SOURCE_URL;
  if (!sourceUrl) return { ok: false, status: 503, body: { message: "TURNOUT_GEAR_SOURCE_URL is not configured." } };
  try {
    const result = await fetchJson(sourceUrl, auth.headers);
    if (!result.response.ok) return { ok: false, status: 502, body: { message: `The source returned HTTP ${result.response.status}.`, responsePreview: result.text.slice(0, 500) } };
    if (result.payload === undefined) return { ok: false, status: 502, body: { message: "The source did not return valid JSON." } };
    const discovered = discoverRecords(result.payload);
    if (!discovered.rows.length) return { ok: false, status: 502, body: { message: "No record array was found in the source payload.", topLevelKeys: isRecord(result.payload) ? Object.keys(result.payload).slice(0, 40) : [] } };
    const rows = discovered.rows;
    const coverage = new Map<string, { present: number; samples: string[] }>();
    for (const row of rows) {
      const seen = new Set<string>();
      for (const [path, value] of flattenedEntries(row)) {
        if (isSecretField(path) || (value && typeof value === "object")) continue;
        if (seen.has(path)) continue;
        seen.add(path);
        const item = coverage.get(path) || { present: 0, samples: [] };
        item.present += 1;
        const sample = safePreviewValue(value);
        if (sample && !item.samples.includes(sample) && item.samples.length < 3) item.samples.push(sample);
        coverage.set(path, item);
      }
    }
    const fieldSummary = [...coverage.entries()]
      .map(([path, value]) => ({ path, present: value.present, samples: value.samples }))
      .sort((a, b) => b.present - a.present || a.path.localeCompare(b.path));
    return { ok: true, status: 200, body: {
      generatedAt: new Date().toISOString(), source: sourceUrl, discoveredPath: discovered.path,
      recordCount: rows.length, topLevelKeys: isRecord(result.payload) ? Object.keys(result.payload).slice(0, 40) : [],
      fieldSummary, records: rows.slice(0, 5).map((row, index) => ({ index: index + 1, fields: explorerFields(row) }))
    } };
  } catch (error) {
    return { ok: false, status: 502, body: { message: error instanceof Error ? error.message : "Unable to inspect source payload." } };
  }
}

async function loadGear(env: Env): Promise<{ gear: GearAsset[]; source: string; diagnostic: SourceDiagnostic }> {
  const auth = authHeaders(env);
  const direct = await loadDirectOperative(env, auth);
  if (direct?.diagnostic.ok) return direct;
  const legacy = await loadLegacyPreview(env, auth);
  if (legacy.diagnostic.ok) return legacy;
  if (direct) {
    return {
      gear: [], source: direct.source,
      diagnostic: {
        ...direct.diagnostic,
        message: `${direct.diagnostic.message} Legacy preview fallback also failed: ${legacy.diagnostic.message}`,
        responsePreview: [direct.diagnostic.responsePreview, legacy.diagnostic.responsePreview].filter(Boolean).join("\n--- legacy fallback ---\n").slice(0, 1200),
        attemptedUrls: [...(direct.diagnostic.attemptedUrls || []), ...(legacy.diagnostic.attemptedUrls || [])]
      }
    };
  }
  return legacy;
}

function emptySupplyInventory(note = "Supply inventory has not been loaded."): SupplyInventoryPayload {
  return { success:false, mode:"READ_ONLY_SUPPLY_INVENTORY_PREVIEW", sourceEndpoint:"", count:0, totals:{skuCount:0,totalOnHand:0,lowStock:0,outOfStock:0,quantityUnavailable:0}, inventory:[], note };
}

async function loadSupplyInventory(env: Env): Promise<SupplyInventoryPayload> {
  if (!env.TURNOUT_GEAR_SOURCE_URL) return emptySupplyInventory("TURNOUT_GEAR_SOURCE_URL is not configured.");
  const supplyUrl = env.TURNOUT_GEAR_SOURCE_URL.replace(/\/preview-turnout-gear(?:\?.*)?$/i, "/preview-supply-inventory");
  const auth = authHeaders(env);
  try {
    const result = await fetchJson(supplyUrl, auth.headers);
    if (!result.response.ok || result.payload === undefined) return emptySupplyInventory(`Supply source returned HTTP ${result.response.status}.`);
    const payload = result.payload as Partial<SupplyInventoryPayload>;
    if (!Array.isArray(payload.inventory)) return emptySupplyInventory("Supply source did not return an inventory array.");
    return {
      success: payload.success !== false,
      mode: String(payload.mode || "READ_ONLY_SUPPLY_INVENTORY_PREVIEW"),
      sourceEndpoint: String(payload.sourceEndpoint || ""),
      count: Number(payload.count ?? payload.inventory.length),
      totals: payload.totals || {skuCount:payload.inventory.length,totalOnHand:0,lowStock:0,outOfStock:0,quantityUnavailable:0},
      inventory: payload.inventory as SupplyInventoryPayload["inventory"],
      note: String(payload.note || ""),
      attempted: payload.attempted,
      excluded: Array.isArray((payload as any).excluded) ? (payload as any).excluded : [],
      filterRules: (payload as any).filterRules
    };
  } catch (error) {
    return emptySupplyInventory(error instanceof Error ? error.message : "Unable to load supply inventory.");
  }
}

function memberCoverage(gear: GearAsset[]): MemberCoverage[] {
  const map = new Map<string, GearAsset[]>();
  for (const item of gear) if (item.locationType === "Issued to Member" && item.assignedTo !== "Unassigned") map.set(item.assignedTo, [...(map.get(item.assignedTo) || []), item]);
  return [...map.entries()].map(([member, assets]) => {
    const coats = assets.filter(a => a.gearType === "Coat").length;
    const pants = assets.filter(a => a.gearType === "Pant").length;
    const status = coats >= 2 && pants >= 2 ? "Compliant" : coats < 2 && pants < 2 ? "Missing Coat and Pant" : coats < 2 ? "Missing Coat" : "Missing Pant";
    return { member, coats, pants, totalGear: assets.length, status, assets } as MemberCoverage;
  }).sort((a, b) => (a.status === "Compliant" ? 1 : 0) - (b.status === "Compliant" ? 1 : 0) || a.member.localeCompare(b.member));
}

function replacementPriority(gear: GearAsset[]): ReplacementItem[] {
  const year = new Date().getFullYear();
  return gear.map(asset => {
    let score = 0; const reasons: string[] = [];
    if (asset.yearsInService !== null) { score += Math.min(60, asset.yearsInService * 6); if (asset.yearsInService >= 10) reasons.push("Over 10 years"); else if (asset.yearsInService >= 9) reasons.push("Retiring within 1 year"); }
    if (requiresAnnualInspection(asset) && asset.status === "Overdue") { score += 30; reasons.push("Annual inspection overdue"); }
    if (requiresAnnualInspection(asset) && !asset.nextMaintenanceDate) { score += 8; reasons.push("Missing annual inspection date"); }
    if (asset.currentLocation === "Unknown") { score += 5; reasons.push("Unknown location"); }
    const recommendedYear = asset.retirementDate ? new Date(asset.retirementDate).getFullYear() : year + Math.max(0, Math.ceil(10 - (asset.yearsInService || 0)));
    return { rank: 0, asset, score: Math.round(score), reason: reasons.join("; ") || "Lifecycle review", recommendedYear };
  }).sort((a, b) => b.score - a.score).slice(0, 25).map((item, index) => ({ ...item, rank: index + 1 }));
}

function dashboard(gear: GearAsset[], source: string, diagnostic: SourceDiagnostic, lookaheadDays: number, supplyInventory: SupplyInventoryPayload): DashboardPayload {
  const currentYear = new Date().getFullYear();
  // Department policy: only structural coats and pants receive the annual inspection.
  // Gear transferred to Phoenix Gear Repair is already in the repair/inspection workflow,
  // so it is excluded from active due/overdue workload until it returns.
  const inspectionGear = gear.filter(x => requiresAnnualInspection(x) && !isPhoenixAsset(x));
  const maintenanceDue = inspectionGear.filter(x => x.daysUntilDue !== null && x.daysUntilDue <= lookaheadDays).sort((a,b)=>(a.daysUntilDue??9999)-(b.daysUntilDue??9999));
  const coverage = memberCoverage(gear);
  const forecast = Array.from({ length: 10 }, (_, i) => ({ year: currentYear + i, coats: 0, pants: 0, other: 0 }));
  for (const item of gear) {
    if (!item.retirementDate) continue;
    const bucket = forecast.find(x => x.year === new Date(item.retirementDate!).getFullYear());
    if (!bucket) continue;
    if (item.gearType === "Coat") bucket.coats++; else if (item.gearType === "Pant") bucket.pants++; else bucket.other++;
  }
  return {
    generatedAt: new Date().toISOString(), source, liveData: diagnostic.ok, lookaheadDays, diagnostic,
    metrics: {
      overdue: inspectionGear.filter(x=>x.status==="Overdue").length,
      dueToday: inspectionGear.filter(x=>x.daysUntilDue===0).length,
      dueNext7Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>=1&&x.daysUntilDue<=7).length,
      due8To30Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>=8&&x.daysUntilDue<=30).length,
      due31To90Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>=31&&x.daysUntilDue<=90).length,
      compliantOver90Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>90).length,
      dueNext30Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>=0&&x.daysUntilDue<=30).length,
      due31To60Days: inspectionGear.filter(x=>x.daysUntilDue!==null&&x.daysUntilDue>=31&&x.daysUntilDue<=60).length,
      compliant: inspectionGear.filter(x=>x.status==="Compliant").length,
      retiringThisYear: gear.filter(x=>x.retirementDate&&new Date(x.retirementDate).getFullYear()===currentYear).length,
      retiringNext3Years: gear.filter(x=>x.retirementDate&&new Date(x.retirementDate).getFullYear()>=currentYear&&new Date(x.retirementDate).getFullYear()<=currentYear+2).length,
      warehouseItems: gear.filter(x=>x.locationType==="Warehouse"&&!isPhoenixAsset(x)).length,
      reserveItems: gear.filter(x=>x.locationType==="Reserve").length,
      stationItems: gear.filter(x=>x.locationType==="Station").length,
      missingLocation: gear.filter(x=>x.currentLocation==="Unknown").length,
      totalAssets: gear.length,
      issuedAssets: gear.filter(x=>x.locationType==="Issued to Member").length,
      membersTracked: coverage.length,
      membersMissingGear: coverage.filter(x=>x.status!=="Compliant").length,
      missingMaintenanceDate: inspectionGear.filter(x=>x.maintenanceDateSource==="Missing").length,
      calculatedMaintenanceDate: inspectionGear.filter(x=>x.maintenanceDateSource==="Calculated from last inspection").length,
      missingInServiceDate: gear.filter(x=>!x.inServiceDate).length
    },
    maintenanceDue, allAssets: gear, memberCoverage: coverage,
    warehouseInventory: gear.filter(x=>!isPhoenixAsset(x)&&(x.locationType==="Warehouse"||x.locationType==="Reserve")),
    replacementPriority: replacementPriority(gear), decommissionForecast: forecast, supplyInventory
  };
}

function authorized(request: Request, env: Env): boolean { return !env.DASHBOARD_ACCESS_KEY || request.headers.get("x-dashboard-key") === env.DASHBOARD_ACCESS_KEY; }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") && !authorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
    if (url.pathname === "/api/health") return json({ ok: true, service: "turnout-gear-dashboard", version: "19.0.0", time: new Date().toISOString() });
    if (url.pathname === "/api/data-explorer") { const result = await loadDataExplorer(env); return json(result.body, { status: result.status }); }
    if (url.pathname === "/api/supply-diagnostic") {
      if (!env.TURNOUT_GEAR_SOURCE_URL) return json({error:"TURNOUT_GEAR_SOURCE_URL is not configured."},{status:500});
      const probeUrl = env.TURNOUT_GEAR_SOURCE_URL.replace(/\/preview-turnout-gear(?:\?.*)?$/i, "/probe-supply-inventory");
      const auth = authHeaders(env);
      const result = await fetchJson(probeUrl, auth.headers);
      return json(result.payload ?? {error:`Supply probe returned HTTP ${result.response.status}`}, {status:result.response.status});
    }
    if (["/api/dashboard","/api/maintenance-due","/api/assets","/api/members","/api/warehouse","/api/supplies","/api/replacement-plan","/api/source-diagnostic"].includes(url.pathname)) {
      const lookaheadDays = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || env.MAINTENANCE_LOOKAHEAD_DAYS || 30)));
      const [result, supplyInventory] = await Promise.all([loadGear(env), loadSupplyInventory(env)]);
      if (url.pathname === "/api/source-diagnostic") return json({gear:result.diagnostic,supplies:supplyInventory}, { status: result.diagnostic.ok ? 200 : 502 });
      const payload = dashboard(result.gear, result.source, result.diagnostic, lookaheadDays, supplyInventory);
      if (url.pathname === "/api/maintenance-due") return json({ generatedAt: payload.generatedAt, liveData: payload.liveData, diagnostic: payload.diagnostic, count: payload.maintenanceDue.length, items: payload.maintenanceDue });
      if (url.pathname === "/api/assets") return json({ generatedAt: payload.generatedAt, count: payload.allAssets.length, items: payload.allAssets });
      if (url.pathname === "/api/members") return json({ generatedAt: payload.generatedAt, count: payload.memberCoverage.length, items: payload.memberCoverage });
      if (url.pathname === "/api/warehouse") return json({ generatedAt: payload.generatedAt, count: payload.warehouseInventory.length, items: payload.warehouseInventory });
      if (url.pathname === "/api/supplies") return json(payload.supplyInventory, { status: payload.supplyInventory.success ? 200 : 502 });
      if (url.pathname === "/api/replacement-plan") return json({ generatedAt: payload.generatedAt, count: payload.replacementPriority.length, items: payload.replacementPriority, forecast: payload.decommissionForecast });
      return json(payload);
    }
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
