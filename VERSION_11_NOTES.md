export type LocationType = "Issued to Member" | "Warehouse" | "Station" | "Reserve" | "Unassigned";
export type DueStatus = "Overdue" | "Due Soon" | "Due Later" | "Compliant" | "Unknown";

export interface GearAsset {
  id: string;
  assetDescription: string;
  gearType: string;
  manufacturer: string;
  model: string;
  size: string;
  assetTag: string;
  serialNumber: string;
  barcode: string;
  assignedTo: string;
  currentLocation: string;
  locationType: LocationType;
  inServiceDate: string | null;
  retirementDate: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  maintenanceDateSource: "OperativeIQ due date" | "Calculated from last inspection" | "Missing";
  daysUntilDue: number | null;
  yearsInService: number | null;
  status: DueStatus;
}

export interface SourceDiagnostic {
  ok: boolean;
  code: "LIVE" | "NOT_CONFIGURED" | "AUTHENTICATION_FAILED" | "SOURCE_UNAVAILABLE" | "INVALID_JSON" | "NO_RECORDS" | "NO_MATCHES" | "SOURCE_ERROR";
  message: string;
  httpStatus?: number;
  sourceUrl?: string;
  discoveredPath?: string;
  recordCount?: number;
  matchedCount?: number;
  topLevelKeys?: string[];
  responsePreview?: string;
  authMode?: string;
  sourceMode?: "Direct OperativeIQ" | "Legacy preview Worker" | "Not configured";
  attemptedUrls?: string[];
}

export interface MemberCoverage {
  member: string;
  coats: number;
  pants: number;
  totalGear: number;
  status: "Compliant" | "Missing Coat" | "Missing Pant" | "Missing Coat and Pant";
  assets: GearAsset[];
}

export interface ReplacementItem {
  rank: number;
  asset: GearAsset;
  score: number;
  reason: string;
  recommendedYear: number;
}


export interface SupplyPart {
  id: string;
  name: string;
  sku: string;
  assetType?: string;
  category: string;
  subcategory: string;
  size: string;
  location: string;
  onHand: number | null;
  minimum: number | null;
  maximum: number | null;
  stockOrderQuantity?: number | null;
  stockLocation?: string;
  supplier?: string;
  partUpc?: string;
  unitPrice?: number | null;
  raw?: Record<string, unknown>;
  status: "In stock" | "Near minimum" | "Low stock" | "Out of stock" | "Quantity unavailable";
  manufacturer: string;
  unitOfMeasure: string;
}

export interface SupplyInventoryPayload {
  success: boolean;
  mode: string;
  sourceEndpoint: string;
  count: number;
  totals: { skuCount:number; totalOnHand:number; lowStock:number; outOfStock:number; quantityUnavailable:number };
  inventory: SupplyPart[];
  note: string;
  attempted?: Array<{endpoint:string;status:number;count:number;error?:string|null}>;
  excluded?: Array<{id:string;name:string;sku:string;assetType?:string;category:string;subcategory:string;location:string;reason:string}>;
  filterRules?: { assetTypeEquals?:string; categoryEquals?:string; warehouseLocationContains?:string; excludePattern:string; includePattern?:string };
}

export interface SupplyProbeField { path:string; present:number; samples:Array<string|number>; }
export interface SupplyProbeResult { endpoint:string; status:number; count:number; fields:SupplyProbeField[]; numericCandidates:SupplyProbeField[]; sample:Record<string,unknown>; error?:string|null; }
export interface SupplyProbePayload { success:boolean; mode:string; filterRules:{assetTypeEquals?:string;categoryEquals?:string;warehouseLocationContains?:string;includePattern?:string;excludePattern:string}; results:SupplyProbeResult[]; note:string; }

export interface DashboardPayload {
  generatedAt: string;
  source: string;
  liveData: boolean;
  lookaheadDays: number;
  diagnostic: SourceDiagnostic;
  metrics: {
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    due8To30Days: number;
    due31To90Days: number;
    compliantOver90Days: number;
    dueNext30Days: number;
    due31To60Days: number;
    compliant: number;
    retiringThisYear: number;
    retiringNext3Years: number;
    warehouseItems: number;
    reserveItems: number;
    stationItems: number;
    missingLocation: number;
    totalAssets: number;
    issuedAssets: number;
    membersTracked: number;
    membersMissingGear: number;
    missingMaintenanceDate: number;
    calculatedMaintenanceDate: number;
    missingInServiceDate: number;
  };
  maintenanceDue: GearAsset[];
  allAssets: GearAsset[];
  memberCoverage: MemberCoverage[];
  warehouseInventory: GearAsset[];
  replacementPriority: ReplacementItem[];
  decommissionForecast: Array<{ year: number; coats: number; pants: number; other: number }>;
  supplyInventory: SupplyInventoryPayload;
}
