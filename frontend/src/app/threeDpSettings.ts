import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";

export type SupportType = "none" | "normal-auto" | "tree-auto" | "normal-manual" | "tree-manual";
export type BrimType = "no_brim" | "auto_brim" | "outer_only" | "inner_only" | "outer_and_inner";

export interface ThreeDpSettings {
  scalePercent: number;
  autoOrient: boolean;
  layerHeight: number;
  initialLayerHeight: number;
  wallGenerator: "classic" | "arachne";
  seamPosition: "aligned" | "nearest" | "back" | "random";
  sliceClosingRadius: number;
  resolution: number;
  arcFitting: boolean;
  preciseZHeight: boolean;
  xyContourCompensation: number;
  xyHoleCompensation: number;
  elephantFootCompensation: number;
  wallLoops: number;
  topShellLayers: number;
  bottomShellLayers: number;
  infillPercent: number;
  infillPattern: string;
  outerWallSpeed: number;
  innerWallSpeed: number;
  infillSpeed: number;
  topSurfaceSpeed: number;
  travelSpeed: number;
  supportType: SupportType;
  supportThresholdAngle: number;
  supportOnBuildPlateOnly: boolean;
  supportXyDistance: number;
  supportTopZDistance: number;
  brimType: BrimType;
  brimWidth: number;
  brimObjectGap: number;
  ironingType: "no ironing" | "top" | "topmost" | "all solid";
  ironingFlow: number;
  ironingSpeed: number;
}

export interface ThreeMfImportInfo {
  processProfile: string;
  printerModel: string;
  printerProfile: string;
  filamentProfile: string;
  embeddedScalePercent: number | null;
  importedSettingCount: number;
}

export const DEFAULT_THREE_DP_SETTINGS: ThreeDpSettings = {
  scalePercent: 100,
  autoOrient: false,
  layerHeight: 0.2,
  initialLayerHeight: 0.2,
  wallGenerator: "classic",
  seamPosition: "aligned",
  sliceClosingRadius: 0.049,
  resolution: 0.012,
  arcFitting: true,
  preciseZHeight: false,
  xyContourCompensation: 0,
  xyHoleCompensation: 0,
  elephantFootCompensation: 0.15,
  wallLoops: 2,
  topShellLayers: 5,
  bottomShellLayers: 3,
  infillPercent: 15,
  infillPattern: "grid",
  outerWallSpeed: 200,
  innerWallSpeed: 300,
  infillSpeed: 270,
  topSurfaceSpeed: 200,
  travelSpeed: 500,
  supportType: "none",
  supportThresholdAngle: 30,
  supportOnBuildPlateOnly: false,
  supportXyDistance: 0.4,
  supportTopZDistance: 0.2,
  brimType: "no_brim",
  brimWidth: 5,
  brimObjectGap: 0.1,
  ironingType: "no ironing",
  ironingFlow: 10,
  ironingSpeed: 30,
};

type RawSettings = Record<string, unknown>;

function scalar(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(String(scalar(value) ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  const parsed = String(scalar(value) ?? "").toLowerCase();
  if (["1", "true", "yes"].includes(parsed)) return true;
  if (["0", "false", "no"].includes(parsed)) return false;
  return fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const parsed = String(scalar(value) ?? "") as T;
  return allowed.includes(parsed) ? parsed : fallback;
}

function parseSupportType(raw: RawSettings): SupportType {
  if (!booleanValue(raw.enable_support, false)) return "none";
  const type = String(scalar(raw.support_type) ?? "").toLowerCase();
  if (type.includes("tree")) return type.includes("manual") ? "tree-manual" : "tree-auto";
  return type.includes("manual") ? "normal-manual" : "normal-auto";
}

function parseBrimType(value: unknown): BrimType {
  return enumValue(value, ["no_brim", "auto_brim", "outer_only", "inner_only", "outer_and_inner"] as const, "no_brim");
}

function parseEmbeddedScale(modelSettings: string | undefined) {
  const transform = modelSettings?.match(/<assemble_item\b[^>]*\btransform="([^"]+)"/i)?.[1];
  if (!transform) return null;
  const values = transform.trim().split(/\s+/).map(Number);
  if (values.length < 9 || values.some((value) => !Number.isFinite(value))) return null;
  const scaleX = Math.hypot(values[0], values[1], values[2]);
  const scaleY = Math.hypot(values[3], values[4], values[5]);
  const scaleZ = Math.hypot(values[6], values[7], values[8]);
  if (Math.max(scaleX, scaleY, scaleZ) - Math.min(scaleX, scaleY, scaleZ) > 0.001) return null;
  return Math.round(((scaleX + scaleY + scaleZ) / 3) * 1000) / 10;
}

export async function readThreeMfSettings(file: File): Promise<{ settings: ThreeDpSettings; info: ThreeMfImportInfo }> {
  if (!file.name.toLowerCase().endsWith(".3mf")) throw new Error("只有 3MF 包含可匯入的 Bambu 專案設定");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const settingsEntry = Object.keys(archive).find((name) => /(^|\/)Metadata\/project_settings\.config$/i.test(name));
  if (!settingsEntry) throw new Error("這個 3MF 沒有 Bambu Studio project settings");

  const decoder = new TextDecoder("utf-8");
  const raw = JSON.parse(decoder.decode(archive[settingsEntry])) as RawSettings;
  const modelEntry = Object.keys(archive).find((name) => /(^|\/)Metadata\/model_settings\.config$/i.test(name));
  const modelSettings = modelEntry ? decoder.decode(archive[modelEntry]) : undefined;
  const defaults = DEFAULT_THREE_DP_SETTINGS;
  const settings: ThreeDpSettings = {
    ...defaults,
    // 3MF already stores and previews its object transform. This scale is an
    // additional adjustment, so importing the embedded transform again would double-scale it.
    scalePercent: 100,
    autoOrient: false,
    layerHeight: numberValue(raw.layer_height, defaults.layerHeight),
    initialLayerHeight: numberValue(raw.initial_layer_print_height, defaults.initialLayerHeight),
    wallGenerator: enumValue(raw.wall_generator, ["classic", "arachne"] as const, defaults.wallGenerator),
    seamPosition: enumValue(raw.seam_position, ["aligned", "nearest", "back", "random"] as const, defaults.seamPosition),
    sliceClosingRadius: numberValue(raw.slice_closing_radius, defaults.sliceClosingRadius),
    resolution: numberValue(raw.resolution, defaults.resolution),
    arcFitting: booleanValue(raw.enable_arc_fitting, defaults.arcFitting),
    preciseZHeight: booleanValue(raw.precise_z_height, defaults.preciseZHeight),
    xyContourCompensation: numberValue(raw.xy_contour_compensation, defaults.xyContourCompensation),
    xyHoleCompensation: numberValue(raw.xy_hole_compensation, defaults.xyHoleCompensation),
    elephantFootCompensation: numberValue(raw.elefant_foot_compensation, defaults.elephantFootCompensation),
    wallLoops: numberValue(raw.wall_loops, defaults.wallLoops),
    topShellLayers: numberValue(raw.top_shell_layers, defaults.topShellLayers),
    bottomShellLayers: numberValue(raw.bottom_shell_layers, defaults.bottomShellLayers),
    infillPercent: numberValue(raw.sparse_infill_density, defaults.infillPercent),
    infillPattern: enumValue(raw.sparse_infill_pattern, ["grid", "gyroid", "honeycomb", "rectilinear", "cubic", "adaptivecubic", "lightning"] as const, defaults.infillPattern),
    outerWallSpeed: numberValue(raw.outer_wall_speed, defaults.outerWallSpeed),
    innerWallSpeed: numberValue(raw.inner_wall_speed, defaults.innerWallSpeed),
    infillSpeed: numberValue(raw.sparse_infill_speed, defaults.infillSpeed),
    topSurfaceSpeed: numberValue(raw.top_surface_speed, defaults.topSurfaceSpeed),
    travelSpeed: numberValue(raw.travel_speed, defaults.travelSpeed),
    supportType: parseSupportType(raw),
    supportThresholdAngle: numberValue(raw.support_threshold_angle, defaults.supportThresholdAngle),
    supportOnBuildPlateOnly: booleanValue(raw.support_on_build_plate_only, defaults.supportOnBuildPlateOnly),
    supportXyDistance: numberValue(raw.support_object_xy_distance, defaults.supportXyDistance),
    supportTopZDistance: numberValue(raw.support_top_z_distance, defaults.supportTopZDistance),
    brimType: parseBrimType(raw.brim_type),
    brimWidth: numberValue(raw.brim_width, defaults.brimWidth),
    brimObjectGap: numberValue(raw.brim_object_gap, defaults.brimObjectGap),
    ironingType: enumValue(raw.ironing_type, ["no ironing", "top", "topmost", "all solid"] as const, defaults.ironingType),
    ironingFlow: numberValue(raw.ironing_flow, defaults.ironingFlow),
    ironingSpeed: numberValue(raw.ironing_speed, defaults.ironingSpeed),
  };

  return {
    settings,
    info: {
      processProfile: String(scalar(raw.print_settings_id) ?? ""),
      printerModel: String(scalar(raw.printer_model) ?? ""),
      printerProfile: String(scalar(raw.printer_settings_id) ?? ""),
      filamentProfile: String(scalar(raw.filament_settings_id) ?? ""),
      embeddedScalePercent: parseEmbeddedScale(modelSettings),
      importedSettingCount: Object.keys(settings).length - 2,
    },
  };
}
