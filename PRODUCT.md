# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Tauri 2 + React + TypeScript, with Rust for desktop capabilities and local processing. Build targets for the first release: Windows and Linux. macOS remains a future target. The shared product identity should stay consistent across operating systems while using native window behavior, menus, and shortcuts where appropriate.

## Users

Developers, designers, support teams, students, and other people who accumulate screenshots and need to find them again.

## Product Purpose

ShotDesk is a desktop application for locally indexing, organizing, and searching screenshots. Success means a user can find a screenshot in seconds by remembering what it showed rather than its filename or location.

## Positioning

Search screenshots by their visible content while keeping images and index on the user's device and available offline.

## Operating Context

Users work with screenshots stored in folders on Windows or Linux. They should be able to select folders to index, search recognized text, and organize useful results with notes, labels, and collections. Selected folders may be empty or already contain many images. Indexing and OCR run in the background with visible progress and collection counts; the user can continue using the application while work proceeds. The initial target market is the United States; American English is the default product language and primary OCR validation language.

## Capabilities and Constraints

- Initial scope: selected-folder indexing, OCR text extraction, image dimensions and selected EXIF details, dominant color search, full-text search, notes and labels, and duplicate detection.
- Users can manually group captures into named collections by project or topic; collection membership is local and never moves original files.
- Each indexed folder is a direct entry point to a library view scoped to that folder, including its nested folders.
- Index entries are unique by canonical file path. Re-scans update metadata and retry OCR only for new or changed files; removing a folder cancels its in-flight indexing and removes its local search-index records without touching originals.
- Local-first and offline-capable; screenshots and index are not sent to a cloud service.
- Image metadata and color analysis are processed locally; do not store or expose GPS coordinates.
- First distribution targets are Windows and Linux; macOS is not part of the initial release.
- The interface will support translation from the first public preview. American English is the default; the initial set of additional interface languages is still to be defined.
- Background indexing must not block the interface. Show progress and useful counts while indexing is active, including when the library is empty or a large initial scan is underway.
- Development will use progressive preview releases rather than treating the product as a throwaway MVP. Versioning, changelogs, release artifacts, and distribution across the chosen Windows/Linux environments are part of the product's delivery plan.
- Product aesthetic and interface should be modern, simple, and distinctive without sacrificing scanability or desktop conventions.
- SQLite is the chosen embedded database for the local index and application metadata.
- RapidOCR with PP-OCRv6 small ONNX models is the primary local OCR engine; validate American English quality, CPU performance, packaging, and licensing on Windows and Linux before release. It runs from Rust with no Python runtime requirement.
- The first missing model set is obtained on the user's explicit request, validated with SHA-256, and cached locally; after setup, OCR works offline.
- Tesseract is a possible optional fallback after the first OCR benchmark, not a required MVP dependency.
- Packaging formats and monetization remain undecided.

## Brand Commitments

The product name is ShotDesk. The interface should retain one coherent identity across Windows and Linux, with selected operating-system-native details.

## Product Principles

- Make screenshot retrieval faster than manual folder browsing.
- Keep the user's image library private and useful offline.
- Make the core search experience direct and low-friction.
- Prefer a focused, dependable first release over an overly broad feature set.
- Ship usable preview builds with documented changes and a clear upgrade path.
