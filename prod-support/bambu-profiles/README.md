# P1S slicing profiles

This directory must contain three **full, flattened** Bambu Studio JSON configs:

- `machine.json`: Bambu Lab P1S, stock 0.4 mm nozzle
- `process.json`: the approved print preset, initially 0.20 mm Standard
- `filament.json`: Bambu PLA Basic

Profile fragments from `resources/profiles` may contain inheritance and include
templates, so copying the three leaf JSON files directly is not sufficient. Use
the helper in this directory against the resources from the exact AppImage used
by the Linux worker:

```bash
cd /mnt/d/mks-reservation-system/prod-support
python3 bambu-profiles/generate_profiles.py \
  bambu-studio/squashfs-root/resources/profiles/BBL
```

The helper selects `Bambu Lab P1S 0.4 nozzle`, then follows that machine
preset's declared default process and filament. With Bambu Studio 02.08.02.61,
those are `0.20mm Standard @BBL X1C` and
`Bambu PLA Basic @BBL P1S 0.4 nozzle`. It recursively resolves `inherits` and
`include`, validates required settings, and writes the three files here.

Use the official **Ubuntu 22.04** AppImage with the current Debian Bookworm
container. The Ubuntu 24.04 build requires glibc 2.38 and cannot run in that
container. After generating the files, run a known STL through the same CLI and
container before production.

Changing one of these files changes future estimates. Update
`BAMBU_PROFILE_VERSION` whenever profiles or Bambu Studio versions change so each
job records which profile set produced its estimate.
