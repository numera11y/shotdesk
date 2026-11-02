# ShotDesk release process

ShotDesk uses Semantic Versioning. The first public versions remain in the `0.x` series while the desktop workflows and supported platforms are being validated. The repository starts at `0.1.0`; no release is published until its release checklist is complete.

## Version synchronization

Keep these values identical for every release:

- `package.json` and the root entry in `package-lock.json`
- `[package].version` in `src-tauri/Cargo.toml` and the `shotdesk` package in `src-tauri/Cargo.lock`
- `version` in `src-tauri/tauri.conf.json`

Check them with `npm run check:version`. Do not update `Cargo.lock` by hand; run Cargo after changing the manifest.

## Prepare a release

1. Move the shipped changes from `CHANGELOG.md`'s `Unreleased` section into a dated version heading. Document known issues and supported targets.
2. Update all version fields above to the same version, then run the version check, frontend build, Rust formatting check, and Rust tests.
3. Build and install the Windows `.exe`/`.msi` artifacts on Windows. Build `.deb`/`.rpm` packages on Ubuntu 24.04, then test installation on the distributions named in the release notes.
4. Verify SQLite migration from the previous release and confirm that user images, metadata, OCR, and collection membership remain local.
5. Commit the release preparation, create an annotated `v<version>` tag, and push the commit and tag.

The tag workflow builds Windows NSIS/MSI and Linux Debian/RPM artifacts and opens a **draft pre-release** on GitHub. Review the generated notes and artifacts before publishing. The `Build installable test packages` workflow can also be run manually; it uploads temporary package artifacts for testers without creating a release.

## Rollback and hotfixes

Do not reuse a published tag. Ship a fix as a new patch version (for example, `0.1.1`) and document it in the changelog. Database changes must remain backward-compatible or include an explicit migration.
