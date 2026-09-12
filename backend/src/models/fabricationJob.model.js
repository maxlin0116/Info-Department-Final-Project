const mongoose = require("mongoose");

const sliceSettingsSchema = new mongoose.Schema(
  {
    scalePercent: { type: Number, min: 10, max: 400, default: 100 },
    rotationX: { type: Number, default: 0 },
    rotationY: { type: Number, default: 0 },
    rotationZ: { type: Number, default: 0 },
    layerHeight: { type: Number, min: 0.08, max: 0.28, default: 0.2 },
    initialLayerHeight: { type: Number, min: 0.08, max: 0.4, default: 0.2 },
    wallGenerator: { type: String, enum: ["classic", "arachne"], default: "classic" },
    seamPosition: { type: String, enum: ["aligned", "nearest", "back", "random"], default: "aligned" },
    sliceClosingRadius: { type: Number, min: 0, max: 1, default: 0.049 },
    resolution: { type: Number, min: 0.001, max: 1, default: 0.012 },
    arcFitting: { type: Boolean, default: true },
    preciseZHeight: { type: Boolean, default: false },
    xyContourCompensation: { type: Number, min: -2, max: 2, default: 0 },
    xyHoleCompensation: { type: Number, min: -2, max: 2, default: 0 },
    elephantFootCompensation: { type: Number, min: 0, max: 1, default: 0.15 },
    wallLoops: { type: Number, min: 1, max: 10, default: 2 },
    topShellLayers: { type: Number, min: 0, max: 20, default: 5 },
    bottomShellLayers: { type: Number, min: 0, max: 20, default: 3 },
    infillPercent: { type: Number, min: 0, max: 100, default: 15 },
    infillPattern: {
      type: String,
      enum: ["grid", "gyroid", "honeycomb", "rectilinear", "cubic", "adaptivecubic", "lightning"],
      default: "grid"
    },
    supportType: {
      type: String,
      enum: ["none", "normal-auto", "tree-auto", "normal-manual", "tree-manual"],
      default: "none"
    },
    outerWallSpeed: { type: Number, min: 10, max: 500, default: 200 },
    innerWallSpeed: { type: Number, min: 10, max: 500, default: 300 },
    infillSpeed: { type: Number, min: 10, max: 500, default: 270 },
    topSurfaceSpeed: { type: Number, min: 10, max: 500, default: 200 },
    travelSpeed: { type: Number, min: 10, max: 700, default: 500 },
    supportThresholdAngle: { type: Number, min: 0, max: 90, default: 30 },
    supportOnBuildPlateOnly: { type: Boolean, default: false },
    supportXyDistance: { type: Number, min: 0, max: 2, default: 0.4 },
    supportTopZDistance: { type: Number, min: 0, max: 1, default: 0.2 },
    brimType: { type: String, enum: ["no_brim", "auto_brim", "outer_only", "inner_only", "outer_and_inner"], default: "no_brim" },
    brimEnabled: { type: Boolean, default: false },
    brimWidth: { type: Number, min: 0, max: 30, default: 5 },
    brimObjectGap: { type: Number, min: 0, max: 2, default: 0.1 },
    ironingType: { type: String, enum: ["no ironing", "top", "topmost", "all solid"], default: "no ironing" },
    ironingFlow: { type: Number, min: 1, max: 100, default: 10 },
    ironingSpeed: { type: Number, min: 1, max: 150, default: 30 },
    autoOrient: { type: Boolean, default: false }
  },
  { _id: false }
);

const fabricationJobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceType: { type: String, enum: ["3dp", "laser"], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    sourceFile: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile", required: true },
    outputFile: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile", default: null },
    status: {
      type: String,
      enum: [
        "slicing",
        "slice_ready",
        "slice_failed",
        "pending_admin_estimate",
        "pending_admin_review",
        "queued",
        "running",
        "completed",
        "rejected",
        "cancelled",
        "failed"
      ],
      required: true,
      index: true
    },
    sliceSettings: { type: sliceSettingsSchema, default: undefined },
    slicerError: { type: String, default: "" },
    slicerProfileVersion: { type: String, default: "" },
    sliceWorkerId: { type: String, default: "", index: true },
    sliceStartedAt: { type: Date, default: null },
    estimatedSeconds: { type: Number, min: 0, default: null },
    estimatedMinutes: { type: Number, min: 0, default: null },
    filamentGrams: { type: Number, min: 0, default: null },
    layerCount: { type: Number, min: 0, default: null },
    requestedColor: { type: String, default: "", trim: true },
    assignedColor: { type: String, default: "", trim: true },
    assignedAmsSlot: { type: Number, min: 1, max: 4, default: null },
    material: { type: String, default: "", trim: true },
    thickness: { type: String, default: "", trim: true },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
    adminNote: { type: String, default: "", trim: true, maxlength: 1000 },
    rejectionReason: { type: String, default: "", trim: true, maxlength: 1000 },
    quotaPeriodKey: { type: String, default: "" },
    quotaReservedMinutes: { type: Number, min: 0, default: 0 },
    quotaConsumedMinutes: { type: Number, min: 0, default: 0 },
    queueEnteredAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: null },
    expectedEndAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    collectedAt: { type: Date, default: null, index: true },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actualDurationMinutes: { type: Number, min: 0, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true, optimisticConcurrency: true }
);

fabricationJobSchema.index({ serviceType: 1, status: 1, queueEnteredAt: 1 });
fabricationJobSchema.index({ serviceType: 1, status: 1, collectedAt: 1 });
fabricationJobSchema.index({ user: 1, createdAt: -1 });
fabricationJobSchema.index(
  { serviceType: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "running" } }
);

module.exports = mongoose.model("FabricationJob", fabricationJobSchema);
