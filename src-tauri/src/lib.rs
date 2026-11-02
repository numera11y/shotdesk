use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use exif::{In as ExifIn, Reader as ExifReader, Tag as ExifTag, Value as ExifValue};
use image::{imageops::FilterType, ImageFormat, ImageReader, RgbImage};
use rapidocr_core::{
    config::{InferenceOptions, PipelineConfig},
    model::{model_set_by_name, ModelCache, ModelDownloadMode},
    RapidOcr,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    io::{BufReader, Cursor},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, State};
use walkdir::WalkDir;

struct AppState {
    db_path: PathBuf,
    model_dir: PathBuf,
    progress: Mutex<IndexProgress>,
    ocr_engine: Mutex<Option<RapidOcr>>,
    ocr_models_ready: AtomicBool,
    cancelled_folders: Mutex<HashSet<String>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexProgress {
    running: bool,
    current_folder: Option<String>,
    stage: String,
    discovered: u64,
    indexed: u64,
    skipped: u64,
    failed: u64,
    metadata_done: u64,
    metadata_total: u64,
    message: Option<String>,
}

impl Default for IndexProgress {
    fn default() -> Self {
        Self {
            running: false,
            current_folder: None,
            stage: "idle".into(),
            discovered: 0,
            indexed: 0,
            skipped: 0,
            failed: 0,
            metadata_done: 0,
            metadata_total: 0,
            message: None,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchedFolder {
    path: String,
    added: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Collection {
    id: i64,
    name: String,
    description: String,
    created: i64,
    capture_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Capture {
    id: i64,
    path: String,
    name: String,
    extension: String,
    size: i64,
    modified: i64,
    ocr_status: String,
    metadata_status: String,
    width: u32,
    height: u32,
    dominant_colors: Vec<DominantColor>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrStatus {
    models_ready: bool,
    pending: u64,
    failed: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureDetails {
    status: String,
    text: String,
    error: Option<String>,
    metadata_status: String,
    metadata_error: Option<String>,
    width: u32,
    height: u32,
    captured_at: Option<String>,
    camera_make: Option<String>,
    camera_model: Option<String>,
    lens_model: Option<String>,
    iso: Option<String>,
    exposure_time: Option<String>,
    focal_length: Option<String>,
    dominant_colors: Vec<DominantColor>,
    dpi_x: Option<u32>,
    dpi_y: Option<u32>,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DominantColor {
    name: String,
    hex: String,
    share: u8,
}

struct ImageMetadata {
    width: u32,
    height: u32,
    captured_at: Option<String>,
    camera_make: Option<String>,
    camera_model: Option<String>,
    lens_model: Option<String>,
    iso: Option<String>,
    exposure_time: Option<String>,
    focal_length: Option<String>,
    dominant_colors: Vec<DominantColor>,
    color_terms: String,
    dpi_x: Option<u32>,
    dpi_y: Option<u32>,
}

fn connect(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys=ON")
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn initialize_database(path: &Path) -> Result<(), String> {
    let connection = connect(path)?;
    connection
        .execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS watched_folders (
               path TEXT PRIMARY KEY NOT NULL,
               added INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS captures (
               id INTEGER PRIMARY KEY,
               path TEXT NOT NULL UNIQUE,
               name TEXT NOT NULL,
               extension TEXT NOT NULL,
               size INTEGER NOT NULL,
               modified INTEGER NOT NULL,
               fingerprint TEXT,
                ocr_text TEXT NOT NULL DEFAULT '',
                ocr_status TEXT NOT NULL DEFAULT 'pending',
                ocr_error TEXT,
                image_width INTEGER NOT NULL DEFAULT 0,
                image_height INTEGER NOT NULL DEFAULT 0,
                captured_at TEXT,
                camera_make TEXT,
                camera_model TEXT,
                lens_model TEXT,
                iso TEXT,
                exposure_time TEXT,
                focal_length TEXT,
                dominant_colors TEXT NOT NULL DEFAULT '[]',
                color_terms TEXT NOT NULL DEFAULT '',
                dpi_x INTEGER,
                dpi_y INTEGER,
                metadata_status TEXT NOT NULL DEFAULT 'pending',
                metadata_error TEXT,
                indexed_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS collections (
               id INTEGER PRIMARY KEY,
               name TEXT NOT NULL COLLATE NOCASE UNIQUE,
               description TEXT NOT NULL DEFAULT '',
               created INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS collection_captures (
               collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
               capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
               added INTEGER NOT NULL,
               PRIMARY KEY(collection_id, capture_id)
             );
             CREATE INDEX IF NOT EXISTS collection_captures_capture_idx ON collection_captures(capture_id);
             CREATE INDEX IF NOT EXISTS captures_modified_idx ON captures(modified DESC);
             CREATE INDEX IF NOT EXISTS captures_name_idx ON captures(name COLLATE NOCASE);",
        )
        .map_err(|error| error.to_string())?;

    let mut columns = connection
        .prepare("PRAGMA table_info(captures)")
        .map_err(|error| error.to_string())?;
    let names = columns
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let dpi_columns_need_backfill =
        !names.iter().any(|name| name == "dpi_x") || !names.iter().any(|name| name == "dpi_y");
    if !names.iter().any(|name| name == "ocr_status") {
        connection
            .execute(
                "ALTER TABLE captures ADD COLUMN ocr_status TEXT NOT NULL DEFAULT 'pending'",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    if !names.iter().any(|name| name == "ocr_error") {
        connection
            .execute("ALTER TABLE captures ADD COLUMN ocr_error TEXT", [])
            .map_err(|error| error.to_string())?;
    }
    for (name, sql) in [
        (
            "image_width",
            "ALTER TABLE captures ADD COLUMN image_width INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "image_height",
            "ALTER TABLE captures ADD COLUMN image_height INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "captured_at",
            "ALTER TABLE captures ADD COLUMN captured_at TEXT",
        ),
        (
            "camera_make",
            "ALTER TABLE captures ADD COLUMN camera_make TEXT",
        ),
        (
            "camera_model",
            "ALTER TABLE captures ADD COLUMN camera_model TEXT",
        ),
        (
            "lens_model",
            "ALTER TABLE captures ADD COLUMN lens_model TEXT",
        ),
        ("iso", "ALTER TABLE captures ADD COLUMN iso TEXT"),
        (
            "exposure_time",
            "ALTER TABLE captures ADD COLUMN exposure_time TEXT",
        ),
        (
            "focal_length",
            "ALTER TABLE captures ADD COLUMN focal_length TEXT",
        ),
        (
            "dominant_colors",
            "ALTER TABLE captures ADD COLUMN dominant_colors TEXT NOT NULL DEFAULT '[]'",
        ),
        ("dpi_x", "ALTER TABLE captures ADD COLUMN dpi_x INTEGER"),
        ("dpi_y", "ALTER TABLE captures ADD COLUMN dpi_y INTEGER"),
        (
            "color_terms",
            "ALTER TABLE captures ADD COLUMN color_terms TEXT NOT NULL DEFAULT ''",
        ),
        (
            "metadata_status",
            "ALTER TABLE captures ADD COLUMN metadata_status TEXT NOT NULL DEFAULT 'pending'",
        ),
        (
            "metadata_error",
            "ALTER TABLE captures ADD COLUMN metadata_error TEXT",
        ),
    ] {
        if !names.iter().any(|existing| existing == name) {
            connection
                .execute(sql, [])
                .map_err(|error| error.to_string())?;
        }
    }
    if dpi_columns_need_backfill {
        connection
            .execute(
                "UPDATE captures SET metadata_status='pending', metadata_error=NULL WHERE metadata_status='ready'",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    let mut fts_columns = connection
        .prepare("PRAGMA table_info(captures_fts)")
        .map_err(|error| error.to_string())?;
    let fts_names = fts_columns
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if !fts_names.is_empty() && !fts_names.iter().any(|name| name == "color_terms") {
        connection
            .execute_batch("DROP TABLE captures_fts")
            .map_err(|error| error.to_string())?;
    }
    connection
        .execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS captures_fts USING fts5(name, path, ocr_text, color_terms, tokenize='unicode61 remove_diacritics 2');",
        )
        .map_err(|error| error.to_string())?;
    let indexed_fts: u64 = connection
        .query_row("SELECT COUNT(*) FROM captures_fts", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if indexed_fts == 0 {
        connection
            .execute(
                "INSERT INTO captures_fts(rowid, name, path, ocr_text, color_terms) SELECT id, name, path, ocr_text, color_terms FROM captures",
                [],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

const COLOR_NAMES: [&str; 12] = [
    "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "brown", "black", "gray",
    "white",
];

fn color_search_terms(name: &str) -> &'static str {
    match name {
        "red" => "red rouge",
        "orange" => "orange",
        "yellow" => "yellow jaune",
        "green" => "green vert verte",
        "cyan" => "cyan turquoise",
        "blue" => "blue bleu",
        "purple" => "purple violet",
        "pink" => "pink rose",
        "brown" => "brown brun marron",
        "black" => "black noir",
        "gray" => "gray grey gris",
        "white" => "white blanc blanche",
        _ => "",
    }
}

fn color_bucket(r: u8, g: u8, b: u8) -> usize {
    let (r, g, b) = (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0);
    let maximum = r.max(g).max(b);
    let minimum = r.min(g).min(b);
    let delta = maximum - minimum;
    let lightness = (maximum + minimum) / 2.0;
    let saturation = if delta == 0.0 {
        0.0
    } else {
        delta / (1.0 - (2.0 * lightness - 1.0).abs())
    };
    if maximum < 0.12 {
        return 9;
    }
    if minimum > 0.88 && saturation < 0.2 {
        return 11;
    }
    if saturation < 0.18 {
        return 10;
    }
    let hue = if delta == 0.0 {
        0.0
    } else if maximum == r {
        60.0 * (((g - b) / delta).rem_euclid(6.0))
    } else if maximum == g {
        60.0 * ((b - r) / delta + 2.0)
    } else {
        60.0 * ((r - g) / delta + 4.0)
    };
    if !(15.0..345.0).contains(&hue) {
        0
    } else if hue < 42.0 {
        if lightness < 0.38 {
            8
        } else {
            1
        }
    } else if hue < 68.0 {
        2
    } else if hue < 165.0 {
        3
    } else if hue < 195.0 {
        4
    } else if hue < 255.0 {
        5
    } else if hue < 290.0 {
        6
    } else if hue < 345.0 {
        7
    } else {
        0
    }
}

fn dominant_colors(sample: &RgbImage) -> (Vec<DominantColor>, String) {
    let mut counts = [0_u64; COLOR_NAMES.len()];
    let mut channel_sums = [[0_u64; 3]; COLOR_NAMES.len()];
    let mut total = 0_u64;
    for pixel in sample.pixels() {
        let [r, g, b] = pixel.0;
        let index = color_bucket(r, g, b);
        counts[index] += 1;
        channel_sums[index][0] += u64::from(r);
        channel_sums[index][1] += u64::from(g);
        channel_sums[index][2] += u64::from(b);
        total += 1;
    }
    if total == 0 {
        return (Vec::new(), String::new());
    }
    let mut indices = (0..COLOR_NAMES.len()).collect::<Vec<_>>();
    indices.sort_by_key(|index| std::cmp::Reverse(counts[*index]));
    let colors = indices
        .into_iter()
        .filter(|index| counts[*index] > 0)
        .take(3)
        .map(|index| {
            let count = counts[index];
            let r = (channel_sums[index][0] / count) as u8;
            let g = (channel_sums[index][1] / count) as u8;
            let b = (channel_sums[index][2] / count) as u8;
            DominantColor {
                name: COLOR_NAMES[index].into(),
                hex: format!("#{r:02x}{g:02x}{b:02x}"),
                share: ((count * 100) / total) as u8,
            }
        })
        .collect::<Vec<_>>();
    let color_terms = colors
        .iter()
        .map(|color| color_search_terms(&color.name))
        .collect::<Vec<_>>()
        .join(" ");
    (colors, color_terms)
}

fn exif_text(exif: &exif::Exif, tag: ExifTag) -> Option<String> {
    let field = exif.fields().find(|field| field.tag == tag)?;
    let text = field.display_value().to_string();
    let text = text.trim().trim_matches('\0').trim().to_string();
    (!text.is_empty()).then_some(text)
}

fn exif_orientation(exif: &exif::Exif) -> Option<image::metadata::Orientation> {
    let field = exif.get_field(ExifTag::Orientation, ExifIn::PRIMARY)?;
    let value = match &field.value {
        ExifValue::Short(values) => values.first().copied().map(u32::from),
        ExifValue::Long(values) => values.first().copied(),
        _ => None,
    }?;
    u8::try_from(value)
        .ok()
        .and_then(image::metadata::Orientation::from_exif)
}

fn exif_number(exif: &exif::Exif, tag: ExifTag) -> Option<f64> {
    let field = exif.get_field(tag, ExifIn::PRIMARY)?;
    let value = match &field.value {
        ExifValue::Byte(values) => values.first().map(|value| f64::from(*value)),
        ExifValue::Short(values) => values.first().map(|value| f64::from(*value)),
        ExifValue::Long(values) => values.first().map(|value| f64::from(*value)),
        ExifValue::Rational(values) => values.first().map(|value| value.to_f64()),
        ExifValue::SRational(values) => values.first().map(|value| value.to_f64()),
        _ => None,
    }?;
    value.is_finite().then_some(value)
}

fn exif_dpi(exif: &exif::Exif) -> (Option<u32>, Option<u32>) {
    let unit = exif_number(exif, ExifTag::ResolutionUnit).unwrap_or(2.0);
    let to_dpi = |tag| resolution_to_dpi(exif_number(exif, tag)?, unit);
    (to_dpi(ExifTag::XResolution), to_dpi(ExifTag::YResolution))
}

fn resolution_to_dpi(resolution: f64, unit: f64) -> Option<u32> {
    let conversion = match unit.round() as u32 {
        2 => 1.0,
        3 => 2.54,
        _ => return None,
    };
    let dpi = (resolution * conversion).round();
    (dpi >= 1.0 && dpi <= 1_000_000.0).then_some(dpi as u32)
}

fn analyze_image(path: &Path) -> Result<ImageMetadata, String> {
    let exif = fs::File::open(path).ok().and_then(|file| {
        ExifReader::new()
            .read_from_container(&mut BufReader::new(file))
            .ok()
    });
    let orientation = exif.as_ref().and_then(exif_orientation);
    let mut image = ImageReader::open(path)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .decode()
        .map_err(|error| error.to_string())?;
    if let Some(orientation) = orientation {
        image.apply_orientation(orientation);
    }
    let (width, height) = (image.width(), image.height());
    let sample = image.thumbnail(64, 64).to_rgb8();
    let (dominant_colors, color_terms) = dominant_colors(&sample);
    let field = |tag| exif.as_ref().and_then(|exif| exif_text(exif, tag));
    let (dpi_x, dpi_y) = exif.as_ref().map(exif_dpi).unwrap_or((None, None));
    Ok(ImageMetadata {
        width,
        height,
        captured_at: field(ExifTag::DateTimeOriginal).or_else(|| field(ExifTag::DateTime)),
        camera_make: field(ExifTag::Make),
        camera_model: field(ExifTag::Model),
        lens_model: field(ExifTag::LensModel),
        iso: field(ExifTag::PhotographicSensitivity),
        exposure_time: field(ExifTag::ExposureTime),
        focal_length: field(ExifTag::FocalLength),
        dominant_colors,
        color_terms,
        dpi_x,
        dpi_y,
    })
}

fn normalized_path_key(path: &str) -> String {
    if cfg!(windows) {
        let path = path.replace('/', "\\");
        let path = path
            .strip_prefix("\\\\?\\UNC\\")
            .map(|rest| format!("\\\\{rest}"))
            .or_else(|| path.strip_prefix("\\\\?\\").map(str::to_string))
            .unwrap_or(path);
        path.to_lowercase()
    } else {
        path.to_string()
    }
}

fn path_is_within(path: &str, folder: &str) -> bool {
    let path = normalized_path_key(path);
    let folder = normalized_path_key(folder);
    if path == folder {
        return true;
    }
    let separator = if cfg!(windows) { "\\" } else { "/" };
    let prefix = if folder.ends_with(separator) {
        folder
    } else {
        format!("{folder}{separator}")
    };
    path.starts_with(&prefix)
}

fn path_is_cancelled(cancelled: &HashSet<String>, path: &str) -> bool {
    cancelled.iter().any(|folder| path_is_within(path, folder))
}

fn refresh_progress_counts(
    progress: &mut IndexProgress,
    connection: &Connection,
) -> Result<(), String> {
    let (discovered, indexed, failed): (u64, u64, u64) = connection
        .query_row(
            "SELECT COUNT(*),
                    SUM(CASE WHEN ocr_status IN ('ready','empty') THEN 1 ELSE 0 END),
                    SUM(CASE WHEN ocr_status='error' OR metadata_status='error' THEN 1 ELSE 0 END)
             FROM captures",
            [],
            |row| {
                Ok((
                    row.get::<_, u64>(0)?,
                    row.get::<_, Option<u64>>(1)?.unwrap_or(0),
                    row.get::<_, Option<u64>>(2)?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| error.to_string())?;
    progress.discovered = discovered;
    progress.indexed = indexed;
    progress.failed = failed;
    Ok(())
}

#[tauri::command]
fn list_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<WatchedFolder>, String> {
    let connection = connect(&state.db_path)?;
    let mut statement = connection
        .prepare("SELECT path, added FROM watched_folders ORDER BY added ASC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(WatchedFolder {
                path: row.get(0)?,
                added: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_collections(state: State<'_, Arc<AppState>>) -> Result<Vec<Collection>, String> {
    let connection = connect(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT collections.id, collections.name, collections.description, collections.created,
                    COUNT(collection_captures.capture_id)
             FROM collections LEFT JOIN collection_captures ON collection_captures.collection_id=collections.id
             GROUP BY collections.id ORDER BY collections.name COLLATE NOCASE",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created: row.get(3)?,
                capture_count: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_collection(
    name: String,
    description: String,
    state: State<'_, Arc<AppState>>,
) -> Result<i64, String> {
    let name = name.trim().to_string();
    let description = description.trim().to_string();
    if name.is_empty() {
        return Err("Enter a name for the collection".into());
    }
    if name.chars().count() > 80 || description.chars().count() > 500 {
        return Err("Collection names are limited to 80 characters and descriptions to 500".into());
    }
    let connection = connect(&state.db_path)?;
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM collections WHERE name=?1 COLLATE NOCASE)",
            params![name],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if exists {
        return Err("A collection with that name already exists".into());
    }
    connection
        .execute(
            "INSERT INTO collections(name, description, created) VALUES(?1, ?2, ?3)",
            params![name, description, now_seconds()],
        )
        .map_err(|error| error.to_string())?;
    Ok(connection.last_insert_rowid())
}

#[tauri::command]
fn update_collection(
    id: i64,
    name: String,
    description: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let name = name.trim().to_string();
    let description = description.trim().to_string();
    if name.is_empty() {
        return Err("Enter a name for the collection".into());
    }
    if name.chars().count() > 80 || description.chars().count() > 500 {
        return Err("Collection names are limited to 80 characters and descriptions to 500".into());
    }
    let connection = connect(&state.db_path)?;
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM collections WHERE name=?1 COLLATE NOCASE AND id<>?2)",
            params![name, id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if exists {
        return Err("A collection with that name already exists".into());
    }
    let changed = connection
        .execute(
            "UPDATE collections SET name=?1, description=?2 WHERE id=?3",
            params![name, description, id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("This collection no longer exists".into());
    }
    Ok(())
}

#[tauri::command]
fn delete_collection(id: i64, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let connection = connect(&state.db_path)?;
    connection
        .execute("DELETE FROM collections WHERE id=?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_collection_captures(
    collection_id: i64,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Capture>, String> {
    let connection = connect(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT captures.id, captures.path, captures.name, captures.extension, captures.size,
                    captures.modified, captures.ocr_status, captures.metadata_status,
                    captures.image_width, captures.image_height, captures.dominant_colors
             FROM collection_captures JOIN captures ON captures.id=collection_captures.capture_id
             WHERE collection_captures.collection_id=?1 ORDER BY captures.modified DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![collection_id], |row| {
            Ok(Capture {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                size: row.get(4)?,
                modified: row.get(5)?,
                ocr_status: row.get(6)?,
                metadata_status: row.get(7)?,
                width: row.get(8)?,
                height: row.get(9)?,
                dominant_colors: serde_json::from_str(&row.get::<_, String>(10)?)
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn capture_collection_ids(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<i64>, String> {
    let connection = connect(&state.db_path)?;
    let mut statement = connection
        .prepare(
            "SELECT collection_captures.collection_id FROM collection_captures
             JOIN captures ON captures.id=collection_captures.capture_id WHERE captures.path=?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![path], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn add_capture_to_collection(
    collection_id: i64,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let connection = connect(&state.db_path)?;
    add_capture_to_collection_record(&connection, collection_id, &path)
}

fn add_capture_to_collection_record(
    connection: &Connection,
    collection_id: i64,
    path: &str,
) -> Result<(), String> {
    let changed = connection
        .execute(
            "INSERT OR IGNORE INTO collection_captures(collection_id, capture_id, added)
             SELECT ?1, id, ?3 FROM captures WHERE path=?2",
            params![collection_id, path, now_seconds()],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        let collection_exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM collections WHERE id=?1)",
                params![collection_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !collection_exists {
            return Err("This collection no longer exists".into());
        }
        let capture_exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM captures WHERE path=?1)",
                params![path],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !capture_exists {
            return Err("This capture is no longer indexed".into());
        }
    }
    Ok(())
}

#[tauri::command]
fn remove_capture_from_collection(
    collection_id: i64,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let connection = connect(&state.db_path)?;
    connection
        .execute(
            "DELETE FROM collection_captures WHERE collection_id=?1
             AND capture_id=(SELECT id FROM captures WHERE path=?2)",
            params![collection_id, path],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn sync_capture_fts(connection: &Connection, id: i64) -> Result<(), String> {
    connection
        .execute("DELETE FROM captures_fts WHERE rowid=?1", params![id])
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO captures_fts(rowid, name, path, ocr_text, color_terms)
             SELECT id, name, path, ocr_text, color_terms FROM captures WHERE id=?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn make_fts_query(query: &str) -> String {
    query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|term| {
            !term.is_empty()
                && !matches!(
                    term.to_lowercase().as_str(),
                    "and"
                        | "or"
                        | "the"
                        | "a"
                        | "an"
                        | "of"
                        | "in"
                        | "on"
                        | "with"
                        | "et"
                        | "ou"
                        | "le"
                        | "la"
                        | "les"
                        | "de"
                        | "des"
                        | "du"
                        | "un"
                        | "une"
                )
        })
        .map(|term| format!("\"{term}\"*"))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[tauri::command]
fn list_captures(query: String, state: State<'_, Arc<AppState>>) -> Result<Vec<Capture>, String> {
    let connection = connect(&state.db_path)?;
    let pattern = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
    let fts_query = make_fts_query(&query);
    let sql = if fts_query.is_empty() {
        "SELECT id, path, name, extension, size, modified, ocr_status, metadata_status,
                image_width, image_height, dominant_colors
         FROM captures
         WHERE (?1 = '' OR name LIKE ?2 ESCAPE '\\' COLLATE NOCASE OR path LIKE ?2 ESCAPE '\\' COLLATE NOCASE OR (?3 = '' AND 0))
         ORDER BY modified DESC"
    } else {
        "SELECT id, path, name, extension, size, modified, ocr_status, metadata_status,
                image_width, image_height, dominant_colors
         FROM captures
         WHERE (?1 = '' OR name LIKE ?2 ESCAPE '\\' COLLATE NOCASE OR path LIKE ?2 ESCAPE '\\' COLLATE NOCASE
                OR id IN (SELECT rowid FROM captures_fts WHERE captures_fts MATCH ?3))
         ORDER BY modified DESC"
    };
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![query, pattern, fts_query], |row| {
            Ok(Capture {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                size: row.get(4)?,
                modified: row.get(5)?,
                ocr_status: row.get(6)?,
                metadata_status: row.get(7)?,
                width: row.get(8)?,
                height: row.get(9)?,
                dominant_colors: serde_json::from_str(&row.get::<_, String>(10)?)
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn capture_details(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<CaptureDetails, String> {
    let connection = connect(&state.db_path)?;
    connection
        .query_row(
            "SELECT ocr_status, ocr_text, ocr_error, metadata_status, metadata_error,
                    image_width, image_height, captured_at, camera_make, camera_model,
                    lens_model, iso, exposure_time, focal_length, dominant_colors, dpi_x, dpi_y
             FROM captures WHERE path=?1",
            params![path],
            |row| {
                Ok(CaptureDetails {
                    status: row.get(0)?,
                    text: row.get(1)?,
                    error: row.get(2)?,
                    metadata_status: row.get(3)?,
                    metadata_error: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    captured_at: row.get(7)?,
                    camera_make: row.get(8)?,
                    camera_model: row.get(9)?,
                    lens_model: row.get(10)?,
                    iso: row.get(11)?,
                    exposure_time: row.get(12)?,
                    focal_length: row.get(13)?,
                    dominant_colors: serde_json::from_str(&row.get::<_, String>(14)?)
                        .unwrap_or_default(),
                    dpi_x: row.get(15)?,
                    dpi_y: row.get(16)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn ocr_status(state: State<'_, Arc<AppState>>) -> Result<OcrStatus, String> {
    let connection = connect(&state.db_path)?;
    let (pending, failed): (u64, u64) = connection
        .query_row(
            "SELECT
               SUM(CASE WHEN ocr_status='pending' THEN 1 ELSE 0 END),
               SUM(CASE WHEN ocr_status='error' OR metadata_status='error' THEN 1 ELSE 0 END)
             FROM captures",
            [],
            |row| {
                Ok((
                    row.get::<_, Option<u64>>(0)?.unwrap_or(0),
                    row.get::<_, Option<u64>>(1)?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| error.to_string())?;
    Ok(OcrStatus {
        models_ready: state.ocr_models_ready.load(Ordering::Relaxed),
        pending,
        failed,
    })
}

#[tauri::command]
fn index_progress(state: State<'_, Arc<AppState>>) -> Result<IndexProgress, String> {
    state
        .progress
        .lock()
        .map(|progress| progress.clone())
        .map_err(|_| "Could not read indexing progress".to_string())
}

#[tauri::command]
fn suggest_folders() -> Vec<String> {
    let mut candidates = Vec::<PathBuf>::new();
    let home =
        std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    if let Some(home) = home {
        let pictures = if cfg!(windows) {
            home.join("Pictures")
        } else {
            let home_string = home.to_string_lossy().into_owned();
            let configured_value = std::env::var("XDG_PICTURES_DIR").ok().or_else(|| {
                fs::read_to_string(home.join(".config/user-dirs.dirs"))
                    .ok()?
                    .lines()
                    .find(|line| line.trim_start().starts_with("XDG_PICTURES_DIR="))
                    .and_then(|line| {
                        line.split_once('=')
                            .map(|(_, value)| value.trim().to_string())
                    })
            });
            let configured = configured_value
                .map(|value| value.trim_matches('"').replace("$HOME", &home_string));
            configured
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join("Pictures"))
        };
        candidates.extend([
            pictures.join("Screenshots"),
            pictures.join("Captures"),
            pictures.clone(),
            home.join("Screenshots"),
            home.join("Images").join("Captures"),
            home.join("Images"),
        ]);
        if cfg!(windows) {
            candidates.push(home.join("OneDrive").join("Pictures").join("Screenshots"));
        }
    }
    let mut seen = std::collections::HashSet::new();
    candidates
        .into_iter()
        .filter(|path| path.is_dir())
        .filter_map(|path| fs::canonicalize(path).ok())
        .filter(|path| seen.insert(path.clone()))
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn add_folder(path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let selected = PathBuf::from(&path);
    if !selected.is_dir() {
        return Err("Selected location is not a readable directory".into());
    }
    let canonical = fs::canonicalize(&selected).map_err(|error| error.to_string())?;
    let canonical = canonical.to_string_lossy().to_string();
    let app_state = state.inner().clone();
    if app_state
        .progress
        .lock()
        .map_err(|_| "Could not read indexing state".to_string())?
        .running
    {
        return Err("An indexing task is already running".into());
    }
    let connection = connect(&app_state.db_path)?;
    connection
        .execute(
            "INSERT OR IGNORE INTO watched_folders(path, added) VALUES(?1, ?2)",
            params![canonical, now_seconds()],
        )
        .map_err(|error| error.to_string())?;
    app_state
        .cancelled_folders
        .lock()
        .map_err(|_| "Could not update folder scan state".to_string())?
        .retain(|cancelled| {
            !path_is_within(&canonical, cancelled) && !path_is_within(cancelled, &canonical)
        });
    let enable_ocr = app_state.ocr_models_ready.load(Ordering::Relaxed);
    start_scan(app_state, vec![canonical], enable_ocr)
}

#[tauri::command]
fn reanalyze_folder(path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let canonical = fs::canonicalize(&path).map_err(|error| error.to_string())?;
    if !canonical.is_dir() {
        return Err("The selected folder is not accessible".into());
    }
    let canonical = canonical.to_string_lossy().to_string();
    let app_state = state.inner().clone();
    if app_state
        .progress
        .lock()
        .map_err(|_| "Could not read indexing state".to_string())?
        .running
    {
        return Err("An indexing task is already running".into());
    }
    let connection = connect(&app_state.db_path)?;
    let mut statement = connection
        .prepare("SELECT path FROM watched_folders")
        .map_err(|error| error.to_string())?;
    let watched = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if !watched
        .iter()
        .any(|folder| normalized_path_key(folder) == normalized_path_key(&canonical))
    {
        return Err("This folder is not in the indexed folders list".into());
    }
    drop(statement);
    let enable_ocr = app_state.ocr_models_ready.load(Ordering::Relaxed);
    let mut statement = connection
        .prepare("SELECT id, path FROM captures")
        .map_err(|error| error.to_string())?;
    let paths = statement
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(statement);
    for (id, capture_path) in paths {
        if path_is_within(&capture_path, &canonical) {
            connection
                .execute(
                    "UPDATE captures SET metadata_status='pending', metadata_error=NULL, color_terms='',
                     ocr_text=CASE WHEN ?2 THEN '' ELSE ocr_text END,
                     ocr_status=CASE WHEN ?2 THEN 'pending' ELSE ocr_status END,
                     ocr_error=CASE WHEN ?2 THEN NULL ELSE ocr_error END WHERE path=?1",
                    params![capture_path, enable_ocr],
                )
                .map_err(|error| error.to_string())?;
            sync_capture_fts(&connection, id)?;
        }
    }
    app_state
        .cancelled_folders
        .lock()
        .map_err(|_| "Could not update folder scan state".to_string())?
        .retain(|cancelled| {
            !path_is_within(&canonical, cancelled) && !path_is_within(cancelled, &canonical)
        });
    start_scan(app_state, vec![canonical], enable_ocr)
}

#[tauri::command]
fn enable_ocr_search(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let connection = connect(&state.db_path)?;
    let mut statement = connection
        .prepare("SELECT path FROM watched_folders ORDER BY added ASC")
        .map_err(|error| error.to_string())?;
    let folders = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if folders.is_empty() {
        return Err("Add a screenshot folder before enabling OCR search".into());
    }
    start_scan(state.inner().clone(), folders, true)
}

fn start_scan(state: Arc<AppState>, folders: Vec<String>, enable_ocr: bool) -> Result<(), String> {
    let current_folder = folders.first().cloned();
    let mut progress = state
        .progress
        .lock()
        .map_err(|_| "Could not update indexing state".to_string())?;
    if progress.running {
        return Err("An indexing task is already running".into());
    }
    *progress = IndexProgress {
        running: true,
        current_folder,
        stage: "files".into(),
        ..IndexProgress::default()
    };
    drop(progress);
    std::thread::spawn(move || scan_folders(state, folders, enable_ocr));
    Ok(())
}

fn prepare_ocr_engine(state: &AppState) -> Result<(), String> {
    let mut slot = state
        .ocr_engine
        .lock()
        .map_err(|_| "Could not initialize the local OCR engine".to_string())?;
    if slot.is_some() {
        state.ocr_models_ready.store(true, Ordering::Relaxed);
        return Ok(());
    }
    let model_set = model_set_by_name("ppocrv6-small")
        .ok_or_else(|| "The PP-OCRv6 multilingual model set is not registered".to_string())?;
    let cache = ModelCache::new(&state.model_dir);
    cache
        .ensure_model_set_for_pipeline(
            model_set,
            PipelineConfig::without_cls(),
            ModelDownloadMode::Missing,
        )
        .map_err(|error| format!("Could not prepare local OCR models: {error:#}"))?;
    let config = cache
        .config_for(model_set)
        .with_pipeline(PipelineConfig::without_cls())
        .with_inference_options(InferenceOptions {
            intra_threads: std::thread::available_parallelism()
                .map(|count| count.get().min(8))
                .unwrap_or(2),
            inter_threads: 1,
            parallel_execution: false,
            ..InferenceOptions::default()
        });
    let engine = RapidOcr::new(config)
        .map_err(|error| format!("Could not start the local OCR engine: {error:#}"))?;
    *slot = Some(engine);
    state.ocr_models_ready.store(true, Ordering::Relaxed);
    Ok(())
}

fn save_image_metadata(
    connection: &Connection,
    path: &str,
    metadata: &ImageMetadata,
) -> Result<i64, String> {
    let colors =
        serde_json::to_string(&metadata.dominant_colors).map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE captures SET image_width=?1, image_height=?2, captured_at=?3, camera_make=?4,
             camera_model=?5, lens_model=?6, iso=?7, exposure_time=?8, focal_length=?9,
             dominant_colors=?10, color_terms=?11, dpi_x=?12, dpi_y=?13,
             metadata_status='ready', metadata_error=NULL WHERE path=?14",
            params![
                metadata.width,
                metadata.height,
                metadata.captured_at,
                metadata.camera_make,
                metadata.camera_model,
                metadata.lens_model,
                metadata.iso,
                metadata.exposure_time,
                metadata.focal_length,
                colors,
                metadata.color_terms,
                metadata.dpi_x,
                metadata.dpi_y,
                path,
            ],
        )
        .map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT id FROM captures WHERE path=?1",
            params![path],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn scan_folders(state: Arc<AppState>, folders: Vec<String>, enable_ocr: bool) {
    let connection = match connect(&state.db_path) {
        Ok(connection) => connection,
        Err(error) => {
            if let Ok(mut progress) = state.progress.lock() {
                progress.running = false;
                progress.message = Some(error);
            }
            return;
        }
    };
    let mut ocr_queue = Vec::<(i64, String)>::new();
    let mut metadata_queue = Vec::<(i64, String)>::new();
    let mut metadata_failures = HashSet::new();
    let mut seen_paths = HashSet::new();
    for folder in &folders {
        if let Ok(cancelled) = state.cancelled_folders.lock() {
            if path_is_cancelled(&cancelled, folder) {
                continue;
            }
        }
        if let Ok(mut progress) = state.progress.lock() {
            progress.stage = "files".into();
            progress.current_folder = Some(folder.clone());
        }
        let mut statement = match connection.prepare(
        "INSERT INTO captures(path, name, extension, size, modified, fingerprint, ocr_text, ocr_status, ocr_error,
                              metadata_status, metadata_error, dominant_colors, color_terms, indexed_at)
         VALUES(?1, ?2, ?3, ?4, ?5, NULL, '', 'pending', NULL, 'pending', NULL, '[]', '', ?6)
         ON CONFLICT(path) DO UPDATE SET name=excluded.name, extension=excluded.extension,
         ocr_text=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN '' ELSE captures.ocr_text END,
          ocr_status=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN 'pending' ELSE captures.ocr_status END,
          ocr_error=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.ocr_error END,
          image_width=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN 0 ELSE captures.image_width END,
          image_height=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN 0 ELSE captures.image_height END,
          captured_at=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.captured_at END,
          camera_make=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.camera_make END,
          camera_model=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.camera_model END,
          lens_model=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.lens_model END,
          iso=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.iso END,
          exposure_time=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.exposure_time END,
          focal_length=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.focal_length END,
          dpi_x=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.dpi_x END,
          dpi_y=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.dpi_y END,
          metadata_status=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN 'pending' ELSE captures.metadata_status END,
         metadata_error=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN NULL ELSE captures.metadata_error END,
         dominant_colors=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN '[]' ELSE captures.dominant_colors END,
         color_terms=CASE WHEN captures.size<>excluded.size OR captures.modified<>excluded.modified THEN '' ELSE captures.color_terms END,
         size=excluded.size, modified=excluded.modified, indexed_at=excluded.indexed_at",
        ) {
            Ok(statement) => statement,
            Err(error) => {
                if let Ok(mut progress) = state.progress.lock() {
                    progress.running = false;
                    progress.stage = "error".into();
                    progress.message = Some(error.to_string());
                }
                return;
            }
        };
        for entry in WalkDir::new(folder).follow_links(false).into_iter() {
            let entry = match entry {
                Ok(entry) if entry.file_type().is_file() => entry,
                Ok(_) => continue,
                Err(_) => {
                    if let Ok(mut progress) = state.progress.lock() {
                        progress.failed += 1;
                    }
                    continue;
                }
            };
            let path = entry.path();
            let canonical_path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
            let full_path = canonical_path.to_string_lossy().to_string();
            let dedupe_key = normalized_path_key(&full_path);
            if !seen_paths.insert(dedupe_key) {
                continue;
            }
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if !matches!(
                extension.as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp"
            ) {
                if matches!(
                    extension.as_str(),
                    "tif" | "tiff" | "heic" | "heif" | "avif" | "svg"
                ) {
                    if let Ok(mut progress) = state.progress.lock() {
                        progress.skipped += 1;
                    }
                }
                continue;
            }
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => {
                    if let Ok(mut progress) = state.progress.lock() {
                        progress.failed += 1;
                    }
                    continue;
                }
            };
            let modified = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs() as i64)
                .unwrap_or_default();
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("image");
            let cancelled = match state.cancelled_folders.lock() {
                Ok(cancelled) => cancelled,
                Err(_) => continue,
            };
            if path_is_cancelled(&cancelled, &full_path) {
                continue;
            }
            if let Ok(mut progress) = state.progress.lock() {
                progress.discovered += 1;
            }
            if statement
                .execute(params![
                    full_path,
                    name,
                    extension,
                    metadata.len() as i64,
                    modified,
                    now_seconds()
                ])
                .is_err()
            {
                if let Ok(mut progress) = state.progress.lock() {
                    progress.failed += 1;
                }
                continue;
            }
            let (id, status, metadata_status): (i64, String, String) = match connection.query_row(
                "SELECT id, ocr_status, metadata_status FROM captures WHERE path=?1",
                params![full_path],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            ) {
                Ok(result) => result,
                Err(_) => {
                    if let Ok(mut progress) = state.progress.lock() {
                        progress.failed += 1;
                    }
                    continue;
                }
            };
            if sync_capture_fts(&connection, id).is_err() {
                if let Ok(mut progress) = state.progress.lock() {
                    progress.failed += 1;
                }
                continue;
            }
            drop(cancelled);
            if matches!(status.as_str(), "ready" | "empty") {
                if let Ok(mut progress) = state.progress.lock() {
                    progress.indexed += 1;
                }
            } else if enable_ocr {
                ocr_queue.push((modified, full_path.clone()));
            }
            if metadata_status != "ready" {
                metadata_queue.push((modified, full_path));
            }
        }
        drop(statement);
    }

    if !metadata_queue.is_empty() {
        metadata_queue.sort_by(|left, right| right.0.cmp(&left.0));
        if let Ok(mut progress) = state.progress.lock() {
            progress.stage = "metadata".into();
            progress.current_folder = None;
            progress.metadata_done = 0;
            progress.metadata_total = metadata_queue.len() as u64;
        }
        for (_, path) in metadata_queue {
            let analysis = analyze_image(Path::new(&path));
            let cancelled = match state.cancelled_folders.lock() {
                Ok(cancelled) => cancelled,
                Err(_) => continue,
            };
            if path_is_cancelled(&cancelled, &path) {
                if let Ok(mut progress) = state.progress.lock() {
                    progress.metadata_done += 1;
                }
                continue;
            }
            match analysis {
                Ok(metadata) => {
                    let stored = save_image_metadata(&connection, &path, &metadata)
                        .and_then(|id| sync_capture_fts(&connection, id));
                    if let Err(error) = stored {
                        let _ = connection.execute(
                            "UPDATE captures SET metadata_status='error', metadata_error=?1,
                             ocr_status=CASE WHEN ocr_status IN ('pending','error') THEN 'error' ELSE ocr_status END,
                             ocr_error=CASE WHEN ocr_status IN ('pending','error') THEN ?1 ELSE ocr_error END
                             WHERE path=?2",
                            params![error, path],
                        );
                        metadata_failures.insert(path.clone());
                        if let Ok(mut progress) = state.progress.lock() {
                            progress.failed += 1;
                        }
                    }
                }
                Err(error) => {
                    let _ = connection.execute(
                        "UPDATE captures SET metadata_status='error', metadata_error=?1,
                         ocr_status=CASE WHEN ocr_status IN ('pending','error') THEN 'error' ELSE ocr_status END,
                         ocr_error=CASE WHEN ocr_status IN ('pending','error') THEN ?1 ELSE ocr_error END
                         WHERE path=?2",
                        params![error, path],
                    );
                    if let Ok(id) = connection.query_row(
                        "SELECT id FROM captures WHERE path=?1",
                        params![path],
                        |row| row.get::<_, i64>(0),
                    ) {
                        let _ = sync_capture_fts(&connection, id);
                    }
                    metadata_failures.insert(path.clone());
                    if let Ok(mut progress) = state.progress.lock() {
                        progress.failed += 1;
                    }
                }
            }
            drop(cancelled);
            if let Ok(mut progress) = state.progress.lock() {
                progress.metadata_done += 1;
            }
        }
    }
    ocr_queue.retain(|(_, path)| !metadata_failures.contains(path));

    if !enable_ocr {
        if let Ok(mut progress) = state.progress.lock() {
            let _ = refresh_progress_counts(&mut progress, &connection);
            progress.running = false;
            progress.current_folder = None;
            progress.stage = if state.ocr_models_ready.load(Ordering::Relaxed) {
                "idle"
            } else {
                "awaiting-models"
            }
            .into();
        }
        return;
    }
    if enable_ocr && (!ocr_queue.is_empty() || !state.ocr_models_ready.load(Ordering::Relaxed)) {
        ocr_queue.sort_by(|left, right| right.0.cmp(&left.0));
        if let Ok(mut progress) = state.progress.lock() {
            progress.stage = "models".into();
            progress.current_folder = None;
        }
        if let Err(error) = prepare_ocr_engine(&state) {
            if let Ok(mut progress) = state.progress.lock() {
                let _ = refresh_progress_counts(&mut progress, &connection);
                progress.running = false;
                progress.stage = "awaiting-models".into();
                progress.message = Some(error);
            }
            return;
        }
        if let Ok(mut progress) = state.progress.lock() {
            progress.stage = "ocr".into();
        }
        for (_, path) in ocr_queue {
            let is_cancelled = state
                .cancelled_folders
                .lock()
                .map(|cancelled| path_is_cancelled(&cancelled, &path))
                .unwrap_or(true);
            if is_cancelled {
                continue;
            }
            let result = {
                let mut engine = match state.ocr_engine.lock() {
                    Ok(engine) => engine,
                    Err(_) => {
                        if let Ok(mut progress) = state.progress.lock() {
                            progress.failed += 1;
                        }
                        continue;
                    }
                };
                match engine.as_mut() {
                    Some(engine) => engine
                        .run_path(&path)
                        .map(|output| {
                            output
                                .lines
                                .into_iter()
                                .map(|line| line.text)
                                .collect::<Vec<_>>()
                                .join("\n")
                        })
                        .map_err(|error| format!("{error:#}")),
                    None => Err("OCR engine is not initialized".into()),
                }
            };
            let (text, status, error) = match result {
                Ok(text) if text.trim().is_empty() => (String::new(), "empty", None),
                Ok(text) => (text, "ready", None),
                Err(error) => (String::new(), "error", Some(error)),
            };
            let cancelled = match state.cancelled_folders.lock() {
                Ok(cancelled) => cancelled,
                Err(_) => continue,
            };
            if path_is_cancelled(&cancelled, &path) {
                continue;
            }
            let write_result = connection.execute(
                "UPDATE captures SET ocr_text=?1, ocr_status=?2, ocr_error=?3 WHERE path=?4",
                params![text, status, error, path],
            );
            let fts_result = if write_result.is_ok() {
                connection
                    .query_row(
                        "SELECT id FROM captures WHERE path=?1",
                        params![path],
                        |row| row.get::<_, i64>(0),
                    )
                    .map_err(|error| error.to_string())
                    .and_then(|id| sync_capture_fts(&connection, id))
            } else {
                Err(write_result.as_ref().unwrap_err().to_string())
            };
            let indexing_failed = status == "error" || write_result.is_err() || fts_result.is_err();
            if fts_result.is_err() && write_result.is_ok() {
                let message = fts_result.as_ref().unwrap_err();
                let _ = connection.execute(
                    "UPDATE captures SET ocr_status='error', ocr_error=?1 WHERE path=?2",
                    params![message, path],
                );
            }
            drop(cancelled);
            if let Ok(mut progress) = state.progress.lock() {
                if indexing_failed {
                    progress.failed += 1;
                } else {
                    progress.indexed += 1;
                }
            }
        }
    }
    if let Ok(mut progress) = state.progress.lock() {
        let _ = refresh_progress_counts(&mut progress, &connection);
        progress.running = false;
        progress.current_folder = None;
        progress.stage = "idle".into();
    }
}

#[tauri::command]
fn remove_folder(path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut connection = connect(&state.db_path)?;
    let mut cancelled = state
        .cancelled_folders
        .lock()
        .map_err(|_| "Could not update folder scan state".to_string())?;
    cancelled.insert(normalized_path_key(&path));
    remove_folder_records(&mut connection, &path)?;
    drop(cancelled);
    let mut progress = state
        .progress
        .lock()
        .map_err(|_| "Could not refresh indexing progress".to_string())?;
    if !progress.running {
        refresh_progress_counts(&mut progress, &connection)?;
        progress.current_folder = None;
        progress.stage = "idle".into();
        progress.message = None;
    }
    Ok(())
}

fn remove_folder_records(connection: &mut Connection, path: &str) -> Result<(), String> {
    let separator = if cfg!(windows) { "\\" } else { "/" };
    let prefix = format!("{}{}", path.trim_end_matches(['/', '\\']), separator);
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM watched_folders WHERE path=?1", params![path])
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM captures_fts WHERE rowid IN (
               SELECT id FROM captures WHERE path=?1 OR substr(path, 1, length(?2))=?2
             )",
            params![path, prefix],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM captures WHERE path=?1 OR substr(path, 1, length(?2))=?2",
            params![path, prefix],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn capture_thumbnail(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let db_path = state.db_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connect(&db_path)?;
        let known_path: Option<String> = connection
            .query_row(
                "SELECT path FROM captures WHERE path=?1",
                params![path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        if known_path.is_none() {
            return Err("Image is not in the local index".into());
        }
        let image = ImageReader::open(&path)
            .map_err(|error| error.to_string())?
            .with_guessed_format()
            .map_err(|error| error.to_string())?
            .decode()
            .map_err(|error| error.to_string())?;
        let thumbnail = image.resize(720, 480, FilterType::Lanczos3);
        let mut bytes = Cursor::new(Vec::new());
        thumbnail
            .write_to(&mut bytes, ImageFormat::Jpeg)
            .map_err(|error| error.to_string())?;
        Ok(format!(
            "data:image/jpeg;base64,{}",
            BASE64.encode(bytes.into_inner())
        ))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn capture_image(
    path: String,
    max_width: u32,
    max_height: u32,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let db_path = state.db_path.clone();
    let max_width = max_width.clamp(320, 4096);
    let max_height = max_height.clamp(320, 4096);
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connect(&db_path)?;
        let known_path: Option<String> = connection
            .query_row(
                "SELECT path FROM captures WHERE path=?1",
                params![path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        if known_path.is_none() {
            return Err("Image is not in the local index".into());
        }
        let orientation = fs::File::open(&path).ok().and_then(|file| {
            ExifReader::new()
                .read_from_container(&mut BufReader::new(file))
                .ok()
                .as_ref()
                .and_then(exif_orientation)
        });
        let mut image = ImageReader::open(&path)
            .map_err(|error| error.to_string())?
            .with_guessed_format()
            .map_err(|error| error.to_string())?
            .decode()
            .map_err(|error| error.to_string())?;
        if let Some(orientation) = orientation {
            image.apply_orientation(orientation);
        }
        let preview = image.thumbnail(max_width, max_height);
        let mut bytes = Cursor::new(Vec::new());
        preview
            .write_to(&mut bytes, ImageFormat::Png)
            .map_err(|error| error.to_string())?;
        Ok(format!(
            "data:image/png;base64,{}",
            BASE64.encode(bytes.into_inner())
        ))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn model_assets_ready(model_dir: &Path) -> bool {
    let Some(model_set) = model_set_by_name("ppocrv6-small") else {
        return false;
    };
    ModelCache::new(model_dir)
        .missing_assets_for_pipeline(model_set, PipelineConfig::without_cls())
        .is_empty()
}

fn saved_folder_paths(db_path: &Path) -> Result<Vec<String>, String> {
    let connection = connect(db_path)?;
    let mut statement = connection
        .prepare("SELECT path FROM watched_folders ORDER BY added ASC")
        .map_err(|error| error.to_string())?;
    let folders = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(folders)
}

fn initial_progress(db_path: &Path, models_ready: bool) -> Result<IndexProgress, String> {
    let connection = connect(db_path)?;
    let (discovered, indexed, failed): (u64, u64, u64) = connection
        .query_row(
            "SELECT COUNT(*),
                    SUM(CASE WHEN ocr_status IN ('ready','empty') THEN 1 ELSE 0 END),
                    SUM(CASE WHEN ocr_status='error' OR metadata_status='error' THEN 1 ELSE 0 END)
             FROM captures",
            [],
            |row| {
                Ok((
                    row.get::<_, u64>(0)?,
                    row.get::<_, Option<u64>>(1)?.unwrap_or(0),
                    row.get::<_, Option<u64>>(2)?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| error.to_string())?;
    Ok(IndexProgress {
        discovered,
        indexed,
        failed,
        stage: if !models_ready && discovered > indexed + failed {
            "awaiting-models".into()
        } else {
            "idle".into()
        },
        ..IndexProgress::default()
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("shotdesk.sqlite3");
            initialize_database(&db_path).map_err(std::io::Error::other)?;
            let model_dir = data_dir.join("models").join("rapidocr");
            fs::create_dir_all(&model_dir)?;
            let models_ready = model_assets_ready(&model_dir);
            let folders = saved_folder_paths(&db_path).map_err(std::io::Error::other)?;
            let initial =
                initial_progress(&db_path, models_ready).map_err(std::io::Error::other)?;
            let progress = if models_ready && !folders.is_empty() {
                IndexProgress {
                    running: true,
                    current_folder: folders.first().cloned(),
                    stage: "files".into(),
                    ..IndexProgress::default()
                }
            } else {
                initial
            };
            let state = Arc::new(AppState {
                db_path,
                model_dir,
                progress: Mutex::new(progress),
                ocr_engine: Mutex::new(None),
                ocr_models_ready: AtomicBool::new(models_ready),
                cancelled_folders: Mutex::new(HashSet::new()),
            });
            app.manage(state.clone());
            if models_ready && !folders.is_empty() {
                std::thread::spawn(move || scan_folders(state, folders, true));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_folders,
            list_collections,
            create_collection,
            update_collection,
            delete_collection,
            list_collection_captures,
            capture_collection_ids,
            add_capture_to_collection,
            remove_capture_from_collection,
            list_captures,
            capture_details,
            index_progress,
            ocr_status,
            suggest_folders,
            add_folder,
            reanalyze_folder,
            enable_ocr_search,
            remove_folder,
            capture_thumbnail,
            capture_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running ShotDesk");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collection_membership_is_local_and_cascades_when_a_capture_is_removed() {
        let path = std::env::temp_dir().join(format!(
            "shotdesk-collections-{}-{}.sqlite3",
            std::process::id(),
            now_seconds()
        ));
        let _ = fs::remove_file(&path);
        initialize_database(&path).unwrap();
        let connection = connect(&path).unwrap();
        connection
            .execute(
                "INSERT INTO captures(path,name,extension,size,modified,indexed_at)
                 VALUES('C:/shots/one.png','one.png','png',10,1,1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO collections(name,description,created) VALUES('Launch','Release notes',1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO collection_captures(collection_id,capture_id,added)
                 SELECT collections.id,captures.id,1 FROM collections,captures",
                [],
            )
            .unwrap();
        connection
            .execute("DELETE FROM captures WHERE path='C:/shots/one.png'", [])
            .unwrap();
        let memberships: u64 = connection
            .query_row("SELECT COUNT(*) FROM collection_captures", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(memberships, 0);
        drop(connection);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(PathBuf::from(format!("{}-wal", path.display())));
        let _ = fs::remove_file(PathBuf::from(format!("{}-shm", path.display())));
    }

    #[test]
    fn adding_a_capture_to_a_collection_is_idempotent() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON;
                 CREATE TABLE captures(id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL);
                 CREATE TABLE collections(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
                 CREATE TABLE collection_captures(
                   collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                   capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
                   added INTEGER NOT NULL,
                   PRIMARY KEY(collection_id,capture_id)
                 );
                 INSERT INTO captures(id,path) VALUES(1,'/shots/one.png');
                 INSERT INTO collections(id,name) VALUES(2,'Project');",
            )
            .unwrap();

        add_capture_to_collection_record(&connection, 2, "/shots/one.png").unwrap();
        add_capture_to_collection_record(&connection, 2, "/shots/one.png").unwrap();

        let memberships: u64 = connection
            .query_row("SELECT COUNT(*) FROM collection_captures", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(memberships, 1);
    }

    #[test]
    fn exif_resolution_units_convert_to_dpi() {
        assert_eq!(resolution_to_dpi(300.0, 2.0), Some(300));
        assert_eq!(resolution_to_dpi(100.0, 3.0), Some(254));
        assert_eq!(resolution_to_dpi(100.0, 1.0), None);
        assert_eq!(resolution_to_dpi(0.0, 2.0), None);
    }

    #[test]
    fn dominant_colors_extracts_searchable_color_names() {
        let mut sample = RgbImage::new(10, 10);
        for (x, _, pixel) in sample.enumerate_pixels_mut() {
            *pixel = if x < 5 {
                image::Rgb([15, 70, 220])
            } else {
                image::Rgb([30, 190, 65])
            };
        }
        let (colors, terms) = dominant_colors(&sample);
        let names = colors
            .iter()
            .map(|color| color.name.as_str())
            .collect::<Vec<_>>();

        assert!(names.contains(&"blue"));
        assert!(names.contains(&"green"));
        assert!(terms.contains("bleu"));
        assert!(terms.contains("vert"));
        assert!(colors.iter().all(|color| color.share > 0));
    }

    #[test]
    fn fts_query_builds_prefix_terms_and_matches_ocr_content() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE VIRTUAL TABLE captures_fts USING fts5(name, path, ocr_text, color_terms);",
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO captures_fts(rowid, name, path, ocr_text, color_terms) VALUES(7, 'capture.png', '/screens', 'Q4 studio invoice approval', 'blue bleu green vert')",
                [],
            )
            .unwrap();

        let query = make_fts_query("studio invo");
        let found: i64 = connection
            .query_row(
                "SELECT rowid FROM captures_fts WHERE captures_fts MATCH ?1",
                params![query],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(found, 7);
        let color_query = make_fts_query("blue and green");
        let color_match: i64 = connection
            .query_row(
                "SELECT rowid FROM captures_fts WHERE captures_fts MATCH ?1",
                params![color_query],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(color_match, 7);
        let french_color_query = make_fts_query("bleu vert");
        let french_match: i64 = connection
            .query_row(
                "SELECT rowid FROM captures_fts WHERE captures_fts MATCH ?1",
                params![french_color_query],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(french_match, 7);
        assert_eq!(make_fts_query("Ctrl+K"), "\"Ctrl\"* AND \"K\"*");
        assert!(make_fts_query("... ").is_empty());
    }

    #[test]
    fn capture_fts_sync_indexes_stored_ocr_text() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE captures(id INTEGER PRIMARY KEY, name TEXT, path TEXT, ocr_text TEXT, color_terms TEXT DEFAULT '');
                 CREATE VIRTUAL TABLE captures_fts USING fts5(name, path, ocr_text, color_terms);",
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO captures(id, name, path, ocr_text) VALUES(17, 'screen.png', '/shots', 'Quarterly studio overview')",
                [],
            )
            .unwrap();
        sync_capture_fts(&connection, 17).unwrap();

        let query = make_fts_query("studio overview");
        let id: i64 = connection
            .query_row(
                "SELECT rowid FROM captures_fts WHERE captures_fts MATCH ?1",
                params![query],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(id, 17);
    }

    #[test]
    fn deleting_a_folder_removes_its_captures_and_fts_rows_only() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE watched_folders(path TEXT PRIMARY KEY, added INTEGER);
                 CREATE TABLE captures(id INTEGER PRIMARY KEY, path TEXT);
                  CREATE VIRTUAL TABLE captures_fts USING fts5(name, path, ocr_text, color_terms);",
            )
            .unwrap();
        let separator = if cfg!(windows) { "\\" } else { "/" };
        let folder = if cfg!(windows) {
            r"C:\Images\Shots"
        } else {
            "/Images/Shots"
        };
        let nested_image = format!("{folder}{separator}nested{separator}capture.png");
        let direct_image = format!("{folder}{separator}capture.png");
        let sibling_image = format!("{folder}-archive{separator}keep.png");
        for (id, path) in [(1, &nested_image), (2, &direct_image), (3, &sibling_image)] {
            connection
                .execute(
                    "INSERT INTO captures(id,path) VALUES(?1,?2)",
                    params![id, path],
                )
                .unwrap();
            connection
                .execute(
                    "INSERT INTO captures_fts(rowid,name,path,ocr_text,color_terms) VALUES(?1,'image',?2,'searchable words','')",
                    params![id, path],
                )
                .unwrap();
        }
        connection
            .execute(
                "INSERT INTO watched_folders(path,added) VALUES(?1,0)",
                params![folder],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO watched_folders(path,added) VALUES(?1,1)",
                params![format!("{folder}-archive")],
            )
            .unwrap();

        remove_folder_records(&mut connection, folder).unwrap();

        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM captures", [], |row| row
                    .get::<_, u64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM captures_fts", [], |row| row
                    .get::<_, u64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM watched_folders", [], |row| row
                    .get::<_, u64>(0))
                .unwrap(),
            1
        );
    }

    #[test]
    fn removing_a_nested_folder_cancels_its_files_but_not_siblings() {
        let separator = if cfg!(windows) { "\\" } else { "/" };
        let root = if cfg!(windows) {
            r"C:\Images"
        } else {
            "/Images"
        };
        let removed = format!("{root}{separator}Shots");
        let nested = format!("{removed}{separator}capture.png");
        let sibling = format!("{root}{separator}Wallpapers{separator}image.png");
        let cancelled = HashSet::from([normalized_path_key(&removed)]);

        assert!(path_is_cancelled(&cancelled, &nested));
        assert!(!path_is_cancelled(&cancelled, &sibling));
    }
}
