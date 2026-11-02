import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoManifest = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");
const cargoVersion = cargoManifest.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1];
const lockVersion = cargoLock.match(/^\[\[package\]\]\r?\nname = "shotdesk"\r?\nversion = "([^"]+)"/m)?.[1];
const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.packages?.[""]?.version,
  "src-tauri/Cargo.toml": cargoVersion,
  "src-tauri/Cargo.lock": lockVersion,
  "src-tauri/tauri.conf.json": tauriConfig.version,
};

const distinct = new Set(Object.values(versions));
if ([...distinct].length !== 1 || Object.values(versions).some((version) => !version)) {
  console.error("ShotDesk version mismatch:");
  for (const [file, version] of Object.entries(versions)) console.error(`  ${file}: ${version ?? "not found"}`);
  process.exit(1);
}

const expectedTag = `v${packageJson.version}`;
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag && tag !== expectedTag) {
  console.error(`Tag ${tag} does not match the app version (${expectedTag}).`);
  process.exit(1);
}

console.log(`ShotDesk version is synchronized: ${packageJson.version}${tag ? ` (${tag})` : ""}`);
