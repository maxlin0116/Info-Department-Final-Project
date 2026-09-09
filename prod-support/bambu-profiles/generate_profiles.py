#!/usr/bin/env python3
"""Build the full P1S CLI profiles from an extracted Bambu Studio AppImage."""

import argparse
import json
from pathlib import Path


MACHINE_NAME = "Bambu Lab P1S 0.4 nozzle"


def load_presets(profile_root: Path):
    presets = {}
    for profile_path in profile_root.rglob("*.json"):
        try:
            data = json.loads(profile_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            continue
        name = data.get("name") if isinstance(data, dict) else None
        if not isinstance(name, str):
            continue
        if name in presets and presets[name][1] != data:
            raise RuntimeError(f"duplicate preset name with different content: {name}")
        presets[name] = (profile_path, data)
    return presets


def flatten(presets, name, stack=()):
    if name in stack:
        raise RuntimeError(f"profile inheritance cycle: {' -> '.join((*stack, name))}")
    if name not in presets:
        raise RuntimeError(f"missing profile dependency: {name}")

    _path, data = presets[name]
    merged = {}
    parent = data.get("inherits")
    if parent:
        merged.update(flatten(presets, parent, (*stack, name)))

    includes = data.get("include", [])
    if isinstance(includes, str):
        includes = [includes]
    for include in includes:
        merged.update(flatten(presets, include, (*stack, name)))

    merged.update(data)
    merged.pop("include", None)
    return merged


def require(profile, expected_type, required_keys):
    if profile.get("type") != expected_type:
        raise RuntimeError(f"expected a {expected_type} profile, got {profile.get('type')!r}")
    missing = [key for key in required_keys if key not in profile]
    if missing:
        raise RuntimeError(f"flattened {expected_type} profile is incomplete; missing: {', '.join(missing)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("profile_root", type=Path, help="extracted resources/profiles/BBL directory")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()

    if not args.profile_root.is_dir():
        parser.error(f"profile directory does not exist: {args.profile_root}")

    presets = load_presets(args.profile_root)
    machine = flatten(presets, MACHINE_NAME)
    process_name = machine.get("default_print_profile")
    filament_names = machine.get("default_filament_profile", [])
    if not process_name or not filament_names:
        raise RuntimeError("P1S machine preset does not declare its default process/filament")

    process = flatten(presets, process_name)
    filament = flatten(presets, filament_names[0])

    require(machine, "machine", ["printer_model", "printer_variant", "printable_area", "machine_start_gcode"])
    require(process, "process", ["layer_height", "sparse_infill_density", "wall_loops"])
    require(filament, "filament", ["filament_type", "filament_diameter", "nozzle_temperature"])

    args.output.mkdir(parents=True, exist_ok=True)
    outputs = {"machine.json": machine, "process.json": process, "filament.json": filament}
    for filename, profile in outputs.items():
        destination = args.output / filename
        destination.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{destination}: {profile['name']} ({len(profile)} settings)")


if __name__ == "__main__":
    main()
