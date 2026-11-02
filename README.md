# ShotDesk

**Find the screenshot by what it shows.**

ShotDesk turns folders of screenshots into a searchable library on your computer. Find an image by its filename, the words inside it, or its dominant colors—without moving your originals to another service.

[Download the v0.1.0 preview](https://github.com/numera11y/shotdesk/releases/tag/v0.1.0) · [Product overview](https://numera11y.github.io/shotdesk-site/) · [Report a problem](https://github.com/numera11y/shotdesk/issues)

[![CI](https://github.com/numera11y/shotdesk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/numera11y/shotdesk/actions/workflows/ci.yml)

> **Early preview:** ShotDesk 0.1.0 is available for testing. Read the [release notes](https://github.com/numera11y/shotdesk/releases/tag/v0.1.0) and [testing checklist](TESTING.md) before installing.

## What you can do

- **Find screenshots by their contents:** search filenames, recognized text, and named dominant colors.
- **Keep a useful local index:** browse thumbnails and image details, filter by date, folder, and color, and group images into collections.
- **Work with your existing folders:** ShotDesk indexes selected folders; it does not move or modify your original image files.
- **Review images quickly:** open a full-size viewer and navigate with the keyboard; reanalyze a folder when needed.

## Privacy by design

Your library, thumbnails, collections, and OCR results are stored locally in ShotDesk’s application data. ShotDesk does not upload your screenshots. Text recognition uses PP-OCRv6 models, downloaded and checksum-verified on the first use of text search; after setup, OCR and search can run offline. GPS metadata is not stored.

## Get the preview

Download the package for your platform from the [ShotDesk v0.1.0 release](https://github.com/numera11y/shotdesk/releases/tag/v0.1.0).

| Platform | Package | Preview status |
| --- | --- | --- |
| Windows x64 | NSIS installer (`.exe`) or MSI (`.msi`) | Installable preview packages available |
| Debian/Ubuntu x86_64 | `.deb` | Built on Ubuntu 24.04; please test on your distribution |
| RPM-based Linux x86_64 | `.rpm` | Built on Ubuntu 24.04; please test on your distribution |

Follow [TESTING.md](TESTING.md) to try the core workflow safely and report results. Use a disposable folder or copies of sample images; do not attach private screenshots, image libraries, databases, or OCR model files to issue reports.

## Automated checks

The CI workflow runs on Windows and Ubuntu. It checks version consistency, builds the application, verifies Rust formatting, and runs the Rust test suite. Open the badge above to see the latest run and its logs.

## Project

- [Product website](https://numera11y.github.io/shotdesk-site/)
- [Release history](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [License](LICENSE) — MIT

ShotDesk is an early-stage product. Linux packages are built on Ubuntu 24.04 and have not yet been validated across Linux distributions. See the release notes for current preview information.
