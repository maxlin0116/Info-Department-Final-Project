# Bambu Studio Linux executable

The tracked `bambu-studio` launcher in this directory invokes
`squashfs-root/AppRun`. The Compose service mounts this directory read-only at
`/opt/bambu-studio`.

Download the official Ubuntu 22.04 AppImage and extract it here on Linux so the
result is `squashfs-root/AppRun`. Do not add the vendor binary or extracted tree
to this repository unless the project's distribution and AGPL-3.0 obligations
have been reviewed.

The deployment image currently uses Debian Bookworm/glibc 2.36. Do not use the
Ubuntu 24.04 AppImage, which requires glibc 2.38. Keep the extracted
`squashfs-root` directory because `AppRun` needs its bundled resources and
libraries.

Before starting the service, verify on the target x86_64 Linux host:

```bash
chmod +x ./bambu-studio
chmod +x ./squashfs-root/AppRun
./bambu-studio --help
```

The worker starts it through `xvfb-run` by default. Set
`BAMBU_STUDIO_USE_XVFB=false` only after validating truly headless CLI operation.
