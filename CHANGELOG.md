# Changelog

All notable user-facing changes to ShotDesk will be documented in this file.

## [Unreleased]

## [0.1.0] - 2026-11-02

### Added

- On-demand local PP-OCRv6 text recognition with checksum-verified model files.
- SQLite FTS5 search across filenames, folder paths, recognized screenshot text, and dominant color names.
- Background OCR progress, retryable model setup, and recognized-text details for selected captures.
- Background extraction and display of image dimensions, available camera EXIF fields, and searchable dominant colors; GPS metadata is not stored.
- Aspect ratio with landscape/portrait/square icon and DPI when the image embeds a supported EXIF resolution value.
- Full-image viewer with previous/next keyboard navigation and Escape to close; combinable date, folder, and color filters; per-folder reanalysis with inline metadata/OCR error details.
- Manual collections with descriptions, capture membership, rename, and delete actions, all stored in the local database.
- A bilingual product website in a separate repository, deployed to GitHub Pages.
- Windows NSIS `.exe`/MSI installable packages and Linux Debian `.deb`/RPM `.rpm` packages for preview testing.
- A manual package-check workflow that uploads temporary Windows/Linux test artifacts without creating a release.
