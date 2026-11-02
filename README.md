# ShotDesk

ShotDesk is a local-first screenshot library for Windows and Linux.

Website: [shotdesk-site](https://numera11y.github.io/shotdesk-site/) · Releases: [GitHub Releases](https://github.com/numera11y/shotdesk/releases)

## Run the browser preview

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use **Add folder** to choose a folder of image files. The browser preview reads files for that session only; it does not create the persistent SQLite index.

## Run the desktop preview

Install the platform prerequisites for [Tauri 2](https://v2.tauri.app/start/prerequisites/), then run:

```sh
npm install
npm run desktop:dev
```

The desktop preview lets the user select folders, indexes image paths and metadata into a SQLite database in ShotDesk's application-data directory, and displays locally generated thumbnails. It extracts image dimensions, shows a rounded aspect ratio with an orientation icon, reads embedded EXIF DPI when available, and displays a compact palette of dominant colors; color names can be searched in English or French. The library also supports date, folder, and dominant-color filters, a keyboard-accessible full-image viewer, per-folder reanalysis, and manual collections for grouping captures by topic or project. Collection membership and descriptions stay in the local database; original image files are never moved. GPS metadata is not stored. Metadata extraction and OCR run in the background. Saved folders are checked at startup for new or changed images; a path is unique in the index and processing reruns only when file size or modification time changes. Overlapping folder selections are de-duplicated during a scan. Removing a folder cancels any in-flight work for that path and transactionally removes its SQLite and FTS rows; original files remain untouched.

## Downloads and testing

Published preview packages are listed on [GitHub Releases](https://github.com/numera11y/shotdesk/releases). Windows builds include an installable NSIS `.exe` and an `.msi`; Linux builds include `.deb` and `.rpm` packages. Before installing a preview, read its release notes and follow [TESTING.md](TESTING.md) to report results.

OCR processes one image at a time through a single ONNX session. Thumbnail decoding is limited to two concurrent jobs and an LRU cache of 72 resized previews, so browsing does not retain a copy of every original image in memory.

The first time a user enables text search, ShotDesk downloads and checksum-validates the local PP-OCRv6 small ONNX model set. The model files stay in application data; screenshots are never uploaded. After setup, OCR and SQLite FTS5 search work offline. This Rust integration does not require a Python runtime. Tesseract fallback, PaddleOCR-VL document mode, and operating-system startup integration remain future options.

## OCR smoke test

Developers can check the selected RapidOCR model against one local image without launching the UI:

```sh
cargo run --release --manifest-path src-tauri/Cargo.toml --example ocr-smoke -- path/to/screenshot.png path/to/model-cache [intra-op-threads]
```

The first run downloads the model set into the supplied cache and prints recognized lines plus per-stage timings.

Build distributable Windows/Linux artifacts with `npm run desktop:build` on an appropriately configured build host. Tauri is configured for NSIS/MSI, Debian (`.deb`), RPM (`.rpm`), and AppImage bundles. See [RELEASING.md](RELEASING.md) for version and release preparation; public releases are created as GitHub draft pre-releases from version tags.

The initial test release will include an installable Windows NSIS `.exe` and `.msi`, plus Linux `.deb` and `.rpm` packages. See [TESTING.md](TESTING.md) for a safe testing checklist and how to report results.

The current native build and OCR smoke test have been verified on Windows x64. Linux package builds are configured for Ubuntu 24.04; installation and compatibility have not yet been validated across Linux distributions.
