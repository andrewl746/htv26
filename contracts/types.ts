// contracts/types.ts
// Coordinates: LocalPoint = [x east, y north] in metres from the lot centroid (EPSG:2952).
// LonLat = [longitude, latitude] (EPSG:4326). Months are "YYYY-MM". Dates are "YYYY-MM-DD".

export type DesignId = "fourplex_narrow" | "fourplex_wide" | "sixplex_narrow" | "sixplex_wide";
export type DesignKey = "fn" | "fw" | "sn" | "sw";
export type Result = "fits" | "borderline" | "no_fit" | "not_checked";
export type LotClass = "condo" | "non_residential" | "older_bylaw" | "larger_building"
  | "unmeasurable" | "attached" | "checked";
export type RuleId = "detached_building" | "units_allowed" | "lot_width" | "lot_depth"
  | "building_length" | "height" | "lot_coverage";
export type FlagId = "heritage_register" | "heritage_district" | "ravine" | "trca" | "site_exception" | "vacant";
export type FlagKey = "hr" | "hd" | "rv" | "tr" | "ex" | "vc";
export type PermitKind = "multiplex" | "secondary_suite" | "laneway_garden" | "other";
export type ZoneCode = "R" | "RD" | "RS" | "RT" | "RM";
export type WardId = string;                         // "01" .. "25"
export type Lang = "en" | "fr" | "zh-Hans" | "zh-Hant" | "es" | "tl" | "ta" | "pt";
export type LocalPoint = [number, number];
export type LonLat = [number, number];

// ---------- designs.json ----------
export interface DesignHome { id: number; label: string; bedrooms: number; levels: number[];
  accessible: boolean; walkout: boolean; }
export interface DesignLevel { level: number; name: string; height_m: number; visible_m: number;
  area_m2: number | null; stepped_back: boolean; }
export interface Design {
  id: DesignId; key: DesignKey; name: string; units: number; bedrooms: number;
  width_m: number; length_m: number; height_m: number; storeys: number;
  building_area_m2: number; gfa_m2: number;
  side_yards_m: [number, number]; front_setback_m: number; rear_setback_m: number;
  min_lot_width_m: number; min_lot_depth_m: { r_rt: number; rd_rs_rm: number };
  where_allowed: "all_residential" | "sixplex_overlay";
  top_floor_stepback_m: number; homes: DesignHome[]; levels: DesignLevel[];
  source: { file: string; sheet: string; page: number; url: string };
}
export interface DesignsFile { version: string; released: string; designs: Design[]; }

// ---------- engine_config.json ----------
export interface EngineConfig {
  version: string;
  uncertainty_band_m: number; uncertainty_band_coverage_pp: number;
  larger_building: { avg_height_m: number; footprint_m2: number; address_points: number };
  attached: { on_lot_m2: number; cross_lot_m2: number; shared_edge_m: number; tolerance_m: number };
  vacant_min_footprint_m2: number;
  street_edge: { corridor_distance_m: number; merge_angle_deg: number; min_length_m: number };
  sample_step_m: number; nearby_permits_radius_m: number; context_radius_m: number;
  permits_since: string; permits_trend_since: string;
  sixplex_wards: WardId[]; partial_sixplex_wards: WardId[];
}

// ---------- GET /search ----------
export interface SearchResult { address_id: string; address_full: string; ward_id: WardId;
  ward_name: string; lon: number; lat: number; }
export interface SearchResponse { query: string; results: SearchResult[]; }

// ---------- GET /check ----------
export interface Reason { id: LotClass | "outside_toronto"; label: string; text: string; }
// Informational flags (site_exception) are still returned in CheckResponse.lot.flags, but never appear in
// LotFeatureProps.f or in flags.any_on_fitting_lots ("need extra review").
export interface Flag { id: FlagId; label: string; text: string; source_url: string | null; detail: string | null; }
export interface ZoneInfo {
  zn_zone: string | null; zn_string: string | null; gen_zone: number | null; zbl_sectn: string | null;
  zn_status: number | null; frontage_min_m: number | null; units_max: number | null;
  ht_overlay_m: number | null; coverage_overlay_pct: number | null; exception_no: number | null;
  sixplex_overlay: boolean;
}
// footprint_m2 and footprint_local are the footprint clipped to the lot (one massing polygon can cover a whole row).
export interface ExistingBuilding { building_id: number; avg_height_m: number; footprint_m2: number;
  footprint_local: LocalPoint[]; }
export interface Lot {
  lot_id: string; class: LotClass; reason: Reason | null; ward_id: WardId; ward_name: string;
  zone: ZoneInfo; width_m: number | null; depth_m: number | null; area_m2: number; stated_area: string | null;
  front_bearing_deg: number | null; frontage_edge_local: [LocalPoint, LocalPoint] | null;
  polygon_local: LocalPoint[]; polygon_wgs84: LonLat[];
  existing_building: ExistingBuilding | null; attached: boolean; vacant: boolean; flags: Flag[];
}
export interface RuleRow {
  rule_id: RuleId; label: string;
  required: number | string | null; actual: number | string | null; unit: "m" | "pct" | "units" | null;
  margin: number | null;            // positive = passes by this much; banded rules compare |margin| to the band
  pass: boolean | null;             // null when not_applicable
  borderline: boolean; not_applicable: boolean;
  bylaw_section: string;            // e.g. "10.20.40.70(3)"
  detail: string | null;            // e.g. "5.5 m building + 1.2 m + 0.9 m side yards"
}
export interface DesignResult {
  design_id: DesignId; result: Result; blocking_rule: RuleId | null; rules: RuleRow[];
  placement_local: LocalPoint[] | null;                    // 4 corners, front wall first
  buildable_local: LocalPoint[] | null;
  setbacks_local: { front: LocalPoint[]; rear: LocalPoint[]; left: LocalPoint[]; right: LocalPoint[] } | null;
  fail_slices_local: LocalPoint[][];                       // parts of the footprint outside buildable_local
}
export interface PermitsNearby { radius_m: number; since: string; count: number; points: LonLat[]; points_local: LocalPoint[]; }
// A footprint crossing the lot line comes as its on-lot part (on_lot true) plus each off-lot part (on_lot false)
// under the same building_id, so building_id can repeat in Context.buildings: never use it alone as a key.
export interface ContextBuilding { building_id: number; avg_height_m: number; kind: "house" | "large";
  on_lot: boolean; footprint_local: LocalPoint[]; }
export interface Context { origin: { lon: number; lat: number; x_2952: number; y_2952: number };
  radius_m: number; buildings: ContextBuilding[]; trees: LocalPoint[]; }
export interface Meta { engine_version: string; designs_version: string; config_version: string;
  data_dates: Record<string, string>; disclaimer: string; generated_at: string; cached: boolean; }
export interface CheckResponse {
  address: { address_id: string | null; address_full: string | null; lon: number; lat: number };
  lot: Lot; designs: DesignResult[]; not_checked: string[];
  permits_nearby: PermitsNearby; context: Context; meta: Meta;
}

// ---------- ward_summary.json and GET /ward/{id} ----------
export interface ResultCounts { fits: number; borderline: number; no_fit: number; not_checked: number; }
export interface WardSummaryEntry {
  ward_id: WardId; ward_name: string; sixplex_overlay: "full" | "partial" | "none";
  lots_total: number;                       // COMMON + CONDO parcels in the ward
  house_lots: number;                       // classes attached + checked
  classes: Record<LotClass, number>;
  any_design: ResultCounts;                 // best result across the four designs
  by_design: Record<DesignId, ResultCounts>;
  top_blocking_rules: { rule_id: RuleId; count: number }[];   // descending, over designs that do not fit
  attached_share_pct: number;
  flags: { heritage_register: number; heritage_district: number; ravine: number; trca: number;
           site_exception: number; vacant: number; any_on_fitting_lots: number };
  permits: { rule: string; since_may_2023: number; by_kind_since_may_2023: Record<PermitKind, number>;
             by_year: Record<string, number>; units_since_may_2023: number; source: "tigerdata" | "local" };
  headline: { could: number; could_pct_of_house_lots: number; did: number; lots_per_permit: number | null };
  data_dates: Record<string, string>; generated_at: string;
}
export interface WardSummaryFile { version: string; engine_version: string; designs_version: string;
  permit_rule: string; generated_at: string; data_dates: Record<string, string>;
  wards: Record<WardId, WardSummaryEntry>; city: WardSummaryEntry; }
export interface WardResponse extends WardSummaryEntry { lots_url: string; permits_url: string;
  trend_url: string; briefing_url: string; }

// ---------- GET /ward/{id}/trend ----------
export interface TrendPoint { month: string; permits: number; units: number; }
export interface TrendMarker { month: string; label: string; }
export interface TrendResponse { ward_id: WardId; source: "tigerdata" | "cache" | "local"; since: string;
  series: TrendPoint[]; markers: TrendMarker[]; generated_at: string; }

// ---------- wards/{id}.geojson and permits.geojson feature properties ----------
export interface LotFeatureProps { id: number; c: LotClass; b: Result; r: Record<DesignKey, Result>;
  k: RuleId | null;                 // the rule that limits the best design (blocking or borderline); null when it fits
  f: FlagKey[];                     // review flags only: informational flags (site_exception, "ex") never appear here
  a: 0 | 1; v: 0 | 1; }
export interface PermitFeatureProps { id: number; d: string; w: WardId; u: number; k: PermitKind; }

// ---------- AI service ----------
export interface NumberEntry { value: number; unit: string | null; label: string; source_url: string; }
export interface ExplainRequest { check: CheckResponse; design_id: DesignId | null; lang: Lang; }
export interface ExplainResponse {
  lang: Lang; design_id: DesignId; template_text: string; text: string;
  numbers: Record<string, NumberEntry>; validated: true; source: "gemini" | "template";
  model: string | null; cached: boolean; translation_unavailable: boolean; disclaimer: string;
}
export interface BriefingRequest { ward: WardSummaryEntry; trend: TrendResponse | null; lang: Lang; }
export interface BriefingSection { id: "what_may_fit" | "blocking_rule" | "permits" | "not_checked" | "questions";
  heading: string; template_text: string; text: string; }
export interface BriefingResponse {
  ward_id: WardId; ward_name: string; lang: Lang; title: string; sections: BriefingSection[];
  questions: string[]; numbers: Record<string, NumberEntry>;
  links: { ward_map: string; datasets: { label: string; url: string }[]; methodology: string };
  disclaimer: string; data_dates: Record<string, string>; generated_at: string;
  validated: true; source: "gemini" | "template"; model: string | null; cached: boolean;
  translation_unavailable: boolean;
}
