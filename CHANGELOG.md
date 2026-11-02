# Changelog

All notable user-facing changes to ShotDesk will be documented in this file.

No application releases have been published yet.

## [Unreleased]

### Added

- On-demand local PP-OCRv6 text recognition with checksum-verified model files.
- SQLite FTS5 search across filenames, folder paths, recognized screenshot text, and dominant color names.
- Background OCR progress, retryable model setup, and recognized-text details for selected captures.
- Background extraction and display of image dimensions, available camera EXIF fields, and searchable dominant colors; GPS metadata is not stored.
- Aspect ratio with landscape/portrait/square icon and DPI when the image embeds a supported EXIF resolution value.
- Full-image viewer with previous/next keyboard navigation and Escape to close; combinable date, folder, and color filters; per-folder reanalysis with inline metadata/OCR error details.
- Manual collections with descriptions, capture membership, rename, and delete actions, all stored in the local database.
- A bilingual product website in a separate repository, deployed to GitHub Pages.
- Windows x64 NSIS/MSI release pipeline and a Linux package pipeline awaiting validation on a Linux host.
