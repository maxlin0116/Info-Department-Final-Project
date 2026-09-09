export type ServiceType = "3dp" | "laser";

export interface FileSummary {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  downloadUrl?: string;
}

export interface FabricationJob {
  id: string;
  serviceType: ServiceType;
  title: string;
  status: string;
  user?: { id: string; name: string; grade?: string };
  sourceFile?: FileSummary;
  outputFile?: FileSummary;
  sliceSettings?: Record<string, unknown>;
  slicerError?: string;
  slicerProfileVersion?: string;
  estimatedSeconds?: number;
  estimatedMinutes?: number;
  filamentGrams?: number;
  layerCount?: number;
  requestedColor?: string;
  assignedColor?: string;
  assignedAmsSlot?: number;
  material?: string;
  thickness?: string;
  comment?: string;
  adminNote?: string;
  rejectionReason?: string;
  quotaReservedMinutes?: number;
  quotaConsumedMinutes?: number;
  queueEnteredAt?: string;
  startedAt?: string;
  expectedEndAt?: string;
  completedAt?: string;
  collectedAt?: string;
  collectedBy?: string;
  actualDurationMinutes?: number;
  createdAt: string;
  position?: number;
  estimatedStartAt?: string;
  estimatedEndAt?: string;
}

export interface AmsSlot {
  slot: number;
  colorName: string;
  colorHex: string;
  material: string;
  available: boolean;
}

export interface FabricationConfig {
  machines: Array<{ serviceType: ServiceType; name: string; status: string; serviceOpen: boolean; note: string }>;
  amsSlots: AmsSlot[];
}

export interface QuotaSummary {
  enabled: boolean;
  period: string;
  periodKey: string;
  limitMinutes: number;
  reservedMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  maxActiveJobs: number;
}

export function formatMinutes(value?: number | null) {
  if (!value) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function fabricationStatusLabel(status: string, collectedAt?: string | null) {
  if (status === "completed" && collectedAt) return "已取件";
  const labels: Record<string, string> = {
    slicing: "切片中",
    slice_ready: "等待送出確認",
    slice_failed: "切片失敗",
    pending_admin_estimate: "等待審核",
    pending_admin_review: "等待審核",
    queued: "排隊中",
    running: "製作中",
    completed: "已完成",
    rejected: "已拒絕",
    cancelled: "已取消",
    failed: "製作失敗"
  };
  return labels[status] || status;
}
