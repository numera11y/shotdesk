# Preview testing checklist

Thanks for testing ShotDesk. Use copies of sample images or a disposable folder and leave your original image library untouched. Report findings in the [GitHub issue tracker](https://github.com/numera11y/shotdesk/issues).

## Installable packages

- **Windows:** download the installable NSIS `.exe` (or `.msi`) from the preview release. Install, launch, then uninstall from Windows Settings after testing.
- **Debian/Ubuntu:** install the `.deb` package with your distribution's package installer.
- **RPM-based Linux:** install the `.rpm` package with your distribution's package installer.

Linux packages are built on Ubuntu 24.04. Please test installation and runtime behavior on your own distribution before relying on a preview.

## First-run and core workflow

- Launch with no network access; the library should open and existing local search should remain available.
- Add a disposable folder of screenshots and confirm that the files remain in their original location.
- Watch file discovery, image analysis, and OCR as separate background stages; keep browsing during processing.
- Search a filename, visible text (after enabling OCR), and dominant colors.
- Open a capture full-screen; use left/right arrows and Escape.
- Try date, folder, and color filters, then remove an individual filter and clear all filters.
- Create a collection, add/remove captures, rename it, restart ShotDesk, and confirm the collection persists.
- Reanalyze a disposable folder and confirm that errors are explained without blocking browsing.
- Remove the disposable folder from ShotDesk and confirm that its original files remain intact.

## Report a problem

Include the ShotDesk version, package type, operating system/distribution, and reproduction steps. Never attach private screenshots, personal image libraries, SQLite databases, or OCR model files. Use synthetic or publicly shareable samples instead.
