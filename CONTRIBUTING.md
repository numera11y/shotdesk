# Contributing to ShotDesk

Thanks for your interest in ShotDesk. Bug reports, accessibility feedback, and focused pull requests are welcome.

## Before opening an issue

- Search existing issues for the same problem.
- Include your operating system, ShotDesk version, and the steps needed to reproduce the issue.
- Never attach private screenshots or database files. If an image is essential, use a synthetic example with no personal information.

## Development setup

1. Install Node.js 22 or newer, Rust stable, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).
2. Run `npm ci`.
3. Run the desktop app with `npm run desktop:dev`.

## Checks before a pull request

```sh
npm run check:version
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

Keep changes focused, preserve local-only processing, and update `CHANGELOG.md` for user-visible changes. Do not commit build output, model files, screenshots containing personal data, or local databases.

## Pull requests

Describe the user-facing change, list the checks you ran, and include screenshots only when they contain synthetic or public data. Pull requests should not change the app version; version bumps are made as part of release preparation.
