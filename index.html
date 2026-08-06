import type { Env, GearAsset } from "./types";

type JsonRecord = Record<string, unknown>;

function asArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => !!item && typeof item === "object");
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    for (const key of ["data", "items", "records", "results", "assets"]) {
      if (Array.isArray(record[key])) return asArray(record[key]);
    }
  }
  return [];
}

function firstText(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function firstDate(record: JsonRecord, keys: string[]): string | null {
  const value = firstText(record, keys);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLocation(asset: JsonRecord): Pick<GearAsset, "assignedTo" | "currentLocation" | "locationType"> {
  const member = firstText(asset, ["assignedToName", "assignedPersonName", "employeeName", "memberName", "assigneeName"]);
  const warehouse = firstText(asset, ["warehouseName", "warehouseLocation", "storageLocation"]);
  const station = firstText(asset, ["stationName", "unitLocationName", "facilityName", "locationName"]);
  const rawLocationType = firstText(asset, ["locationType", "assignmentType", "ownerType"]).toLowerCase();

  if (member || rawLocationType.includes("member") || rawLocationType.includes("person")) {
    return {
      assignedTo: member || "Assigned member",
      currentLocation: member || station || "Issued",
      locationType: "Issued to Member"
    };
  }

  if (warehouse || rawLocationType.includes("warehouse")) {
    return {
      assignedTo: "Warehouse",
      currentLocation: warehouse || station || "Warehouse",
      locationType: "Warehouse"
    };
  }

  if (station) {
    return {
      assignedTo: "Unassigned",
      currentLocation: station,
      locationType: "Station"
    };
  }

  return {
    assignedTo: "Unassigned",
    currentLocation: "Unknown",
    locationType: "Unassigned"
  };
}

function classifyDue(nextMaintenanceDate: string | null, lookaheadDays: number): Pick<GearAsset, "status" | "daysUntilDue"> {
  if (!nextMaintenanceDate) return { status: "Unknown", daysUntilDue: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextMaintenanceDate);
  due.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (daysUntilDue < 0) return { status: "Overdue", daysUntilDue };
  if (daysUntilDue <= lookaheadDays) return { status: "Due Soon", daysUntilDue };
  if (daysUntilDue <= 60) return { status: "Due Later", daysUntilDue };
  return { status: "Compliant", daysUntilDue };
}

function inferGearType(description: string, category: string): string {
  const value = `${description} ${category}`.toLowerCase();
  if (value.includes("coat")) return "Coat";
  if (value.includes("pant") || value.includes("trouser")) return "Pant";
  if (value.includes("helmet")) return "Helmet";
  if (value.includes("hood")) return "Hood";
  if (value.includes("boot")) return "Boots";
  if (value.includes("glove")) return "Gloves";
  return "Other";
}

async function operativeFetch(env: Env, path: string): Promise<unknown> {
  const url = new URL(path, env.OPERATIVE_BASE_URL);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.OPERATIVE_API_TOKEN}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`OperativeIQ request failed (${response.status}) for ${url.pathname}: ${await response.text()}`);
  }
  return response.json();
}

export async function loadTurnoutGear(env: Env): Promise<GearAsset[]> {
  const [assetsPayload, assignmentsPayload, inspectionsPayload] = await Promise.all([
    operativeFetch(env, env.OPERATIVE_ASSETS_PATH),
    operativeFetch(env, env.OPERATIVE_ASSIGNMENTS_PATH).catch(() => []),
    operativeFetch(env, env.OPERATIVE_INSPECTIONS_PATH).catch(() => [])
  ]);

  const assets = asArray(assetsPayload);
  const assignments = asArray(assignmentsPayload);
  const inspections = asArray(inspectionsPayload);
  const assignmentByAsset = new Map(assignments.map((row) => [firstText(row, ["assetId", "itemId", "id"]), row]));
  const inspectionByAsset = new Map<string, JsonRecord>();

  for (const row of inspections) {
    const assetId = firstText(row, ["assetId", "itemId"]);
    if (!assetId) continue;
    const existing = inspectionByAsset.get(assetId);
    const existingDate = existing ? firstDate(existing, ["nextMaintenanceDate", "nextInspectionDate", "dueDate", "inspectionDate"]) : null;
    const candidateDate = firstDate(row, ["nextMaintenanceDate", "nextInspectionDate", "dueDate", "inspectionDate"]);
    if (!existing || (candidateDate && (!existingDate || candidateDate > existingDate))) inspectionByAsset.set(assetId, row);
  }

  const turnoutPattern = new RegExp(env.TURNOUT_CATEGORY_PATTERN || "turnout|coat|pant|bunker", "i");
  const lookaheadDays = Number(env.MAINTENANCE_LOOKAHEAD_DAYS || 30);

  return assets
    .filter((asset) => turnoutPattern.test(`${firstText(asset, ["description", "assetDescription", "name"])} ${firstText(asset, ["categoryName", "assetType", "groupName"])}`))
    .map((asset): GearAsset => {
      const id = firstText(asset, ["id", "assetId", "itemId"]);
      const assignment = assignmentByAsset.get(id) ?? {};
      const inspection = inspectionByAsset.get(id) ?? {};
      const merged = { ...asset, ...assignment, ...inspection };
      const assetDescription = firstText(merged, ["assetDescription", "description", "name", "itemName"]) || `Asset ${id}`;
      const category = firstText(merged, ["categoryName", "assetType", "groupName"]);
      const inServiceDate = firstDate(merged, ["inServiceDate", "serviceDate", "placedInServiceDate", "purchaseDate"]);
      const retirementDate = firstDate(merged, ["decommissionDate", "retirementDate"]) ?? (inServiceDate ? new Date(new Date(inServiceDate).setFullYear(new Date(inServiceDate).getFullYear() + 10)).toISOString() : null);
      const nextMaintenanceDate = firstDate(merged, ["nextMaintenanceDate", "nextInspectionDate", "maintenanceDueDate", "dueDate"]);
      const location = normalizeLocation(merged);

      return {
        id,
        assetDescription,
        gearType: inferGearType(assetDescription, category),
        manufacturer: firstText(merged, ["manufacturerName", "manufacturer", "make"]),
        serialNumber: firstText(merged, ["serialNumber", "serial", "barcode", "assetNumber"]),
        inServiceDate,
        retirementDate,
        lastMaintenanceDate: firstDate(merged, ["lastMaintenanceDate", "lastInspectionDate", "inspectionDate", "completedDate"]),
        nextMaintenanceDate,
        ...location,
        ...classifyDue(nextMaintenanceDate, lookaheadDays)
      };
    });
}
