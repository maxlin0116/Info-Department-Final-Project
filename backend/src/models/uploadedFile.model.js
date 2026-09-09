const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceType: { type: String, enum: ["3dp", "laser"], required: true, index: true },
    kind: { type: String, enum: ["source", "sliced_output"], default: "source" },
    originalFilename: { type: String, required: true, trim: true },
    storedFilename: { type: String, required: true, unique: true },
    relativePath: { type: String, required: true },
    extension: { type: String, required: true, lowercase: true },
    mimeType: { type: String, default: "application/octet-stream" },
    sizeBytes: { type: Number, required: true, min: 0 },
    sha256: { type: String, required: true, index: true },
    validationStatus: {
      type: String,
      enum: ["ready", "generated", "rejected"],
      default: "ready"
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

uploadedFileSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model("UploadedFile", uploadedFileSchema);
