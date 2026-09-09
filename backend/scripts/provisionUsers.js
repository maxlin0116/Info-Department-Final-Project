#!/usr/bin/env node

/**
 * MakerSpace Batch Account Provisioning Script
 *
 * Usage:
 *   node provisionUsers.js --input <path/to/roster.csv|json> [options]
 *
 * Options:
 *   --input <file>        Path to input CSV or JSON roster (required)
 *   --output <file>       Path to output credentials CSV (default: scripts/output/credentials_<timestamp>.csv)
 *   --update-existing     Reset password and update info if student ID already exists (default: skips)
 *   --dry-run             Validate and simulate without connecting to MongoDB or writing credentials
 *   --help, -h            Show this help text
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const User = require("../src/models/user.model");
const connectDatabase = require("../src/database/db");

const STUDENT_ID_REGEX = /^[a-zA-Z]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PWD_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

function generateSecurePassword(length = 10) {
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, PWD_CHARSET.length);
    result += PWD_CHARSET[idx];
  }
  return result;
}

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    updateExisting: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--input") {
      options.input = args[++i];
    } else if (arg === "--output") {
      options.output = args[++i];
    } else if (arg === "--update-existing") {
      options.updateExisting = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else {
      console.warn(`[WARN] Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
MakerSpace Batch User Provisioning Tool
---------------------------------------
Imports a roster of users from a CSV or JSON file into MongoDB.
Automatically generates high-entropy temporary passwords, hashes them with
bcrypt, marks 'mustChangePassword: true', and exports credentials for distribution.

Usage:
  node provisionUsers.js --input <roster-path> [options]

Options:
  --input <file>        Path to roster CSV or JSON (required)
  --output <file>       Custom path to save generated credentials CSV
  --update-existing     Update details and regenerate password for existing student IDs
  --dry-run             Validate syntax and input without modifying the database
  --help, -h            Show help documentation
  `);
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row.");
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const requiredHeaders = ["studentId", "name", "grade", "personalEmail"];
  for (const req of requiredHeaders) {
    if (!headers.includes(req)) {
      throw new Error(`CSV is missing required column: "${req}". Found columns: ${headers.join(", ")}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function loadRoster(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found at: ${resolvedPath}`);
  }

  const content = await fsp.readFile(resolvedPath, "utf-8");
  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === ".json") {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON file must be an array of user objects.");
    }
    return parsed;
  }

  return parseCsv(content);
}

function validateRow(row, index) {
  const studentId = row.studentId?.trim();
  const name = row.name?.trim();
  const grade = row.grade?.trim();
  const personalEmail = row.personalEmail?.trim().toLowerCase();
  const role = (row.role?.trim().toLowerCase()) || "user";

  const errors = [];
  if (!studentId) errors.push("Missing studentId");
  else if (!STUDENT_ID_REGEX.test(studentId)) errors.push(`Invalid studentId format "${studentId}" (must be 1 letter + 8 digits)`);

  if (!name) errors.push("Missing name");
  if (!grade) errors.push("Missing grade");

  if (!personalEmail) errors.push("Missing personalEmail");
  else if (!EMAIL_REGEX.test(personalEmail)) errors.push(`Invalid personalEmail format "${personalEmail}"`);

  if (role !== "user" && role !== "admin") errors.push(`Invalid role "${role}" (must be 'user' or 'admin')`);

  return {
    isValid: errors.length === 0,
    errors,
    data: { studentId, name, grade, personalEmail, role },
    rowIndex: index + 1,
  };
}

async function run() {
  const options = parseCommandLineArgs();

  if (!options.input) {
    console.error("[ERROR] Missing required option: --input <path/to/roster.csv|json>");
    printHelp();
    process.exit(1);
  }

  console.log("==================================================");
  console.log("  MakerSpace Centralized Account Provisioning");
  console.log("==================================================");
  console.log(`Input:           ${options.input}`);
  console.log(`Dry run:         ${options.dryRun ? "YES (Simulation only)" : "NO"}`);
  console.log(`Update existing: ${options.updateExisting ? "YES" : "NO (Skip existing)"}`);
  console.log("--------------------------------------------------");

  const rawRows = await loadRoster(options.input);
  console.log(`Loaded ${rawRows.length} entries from input.`);

  // Validation phase
  const validationResults = rawRows.map(validateRow);
  const invalidRows = validationResults.filter((r) => !r.isValid);

  if (invalidRows.length > 0) {
    console.error(`\n[ERROR] Found ${invalidRows.length} validation errors in input file:`);
    invalidRows.forEach((r) => {
      console.error(`  - Row ${r.rowIndex}: ${r.errors.join("; ")}`);
    });
    console.error("\nPlease correct these errors and re-run.");
    process.exit(1);
  }

  console.log("[OK] All rows passed schema and format validation.\n");

  if (options.dryRun) {
    console.log("--------------------------------------------------");
    console.log("[DRY RUN COMPLETE] Simulated processing of all rows.");
    console.log("Database was not connected, and no credentials were generated.");
    console.log("--------------------------------------------------");
    return;
  }

  // Connect to MongoDB
  console.log("Connecting to MongoDB...");
  await connectDatabase();

  const credentialsForExport = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    for (const item of validationResults) {
      const { studentId, name, grade, personalEmail, role } = item.data;
      const existing = await User.findOne({ studentId });

      if (existing && !options.updateExisting) {
        console.log(`[SKIP] ${studentId} (${name}) already exists.`);
        skippedCount++;
        continue;
      }

      const tempPassword = generateSecurePassword(10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      if (existing && options.updateExisting) {
        existing.name = name;
        existing.grade = grade;
        existing.personalEmail = personalEmail;
        existing.role = role;
        existing.passwordHash = passwordHash;
        existing.mustChangePassword = true;
        existing.isActive = true;
        await existing.save();

        console.log(`[UPDATED] ${studentId} (${name}) - new password generated.`);
        updatedCount++;
        credentialsForExport.push({ studentId, name, personalEmail, role, tempPassword, action: "updated" });
      } else {
        await User.create({
          studentId,
          name,
          grade,
          personalEmail,
          role,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        });

        console.log(`[CREATED] ${studentId} (${name}) - role: ${role}`);
        createdCount++;
        credentialsForExport.push({ studentId, name, personalEmail, role, tempPassword, action: "created" });
      }
    }

    // Write output credentials CSV
    if (credentialsForExport.length > 0) {
      const outputDir = path.resolve(__dirname, "output");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const defaultOutputPath = path.join(outputDir, `credentials_${timestamp}.csv`);
      const targetOutputPath = options.output ? path.resolve(options.output) : defaultOutputPath;

      const csvLines = [
        "studentId,name,personalEmail,role,temporaryPassword,action",
        ...credentialsForExport.map(
          (c) => `"${c.studentId}","${c.name}","${c.personalEmail}","${c.role}","${c.tempPassword}","${c.action}"`
        ),
      ];

      await fsp.writeFile(targetOutputPath, csvLines.join("\n"), "utf-8");

      console.log("\n==================================================");
      console.log("  PROVISIONING SUMMARY");
      console.log("==================================================");
      console.log(`Total processed:    ${validationResults.length}`);
      console.log(`Created:            ${createdCount}`);
      console.log(`Updated:            ${updatedCount}`);
      console.log(`Skipped:            ${skippedCount}`);
      console.log("--------------------------------------------------");
      console.log(`[CREDENTIALS EXPORTED] -> ${targetOutputPath}`);
      console.log("\n[SECURITY NOTICE]:");
      console.log("  1. Distribute temporary passwords to users through secure channels.");
      console.log("  2. Instruct users to change their password on first login.");
      console.log("  3. Delete or securely archive the export file after distribution.");
      console.log("==================================================\n");
    } else {
      console.log("\nNo new credentials were generated (all accounts were skipped).");
    }
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
}

run().catch((error) => {
  console.error("\n[FATAL ERROR]:", error.message);
  process.exit(1);
});
