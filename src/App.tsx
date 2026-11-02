import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  ArrowRight,
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Filter,
  FileImage,
  Folder,
  FolderPlus,
  HardDrive,
  ImagePlus,
  Info,
  Languages,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  Maximize2,
  PanelRightClose,
  RectangleHorizontal,
  RectangleVertical,
  Search,
  ScanSearch,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { emptyProgress, type Capture, type CaptureDetails, type Collection, type IndexProgress, type OcrStatus, type WatchedFolder } from "./types";

type Page = "library" | "collections" | "folders" | "preferences" | "about";
type Locale = "en-US" | "fr-FR";

const copy = {
  "en-US": {
    library: "Library", collections: "Collections", folders: "Folders", preferences: "Preferences", about: "About", workspace: "WORKSPACE",
    viewer: "Image viewer", openImage: "View full image", closeViewer: "Close image viewer", previousCapture: "Previous image", nextCapture: "Next image", viewerLoading: "Loading image…", viewerError: "This image could not be opened at full size.", filters: "Filters", clearFilters: "Clear filters", activeFilters: "Active filters", dateFrom: "Modified from", dateTo: "Modified to", folderFilter: "Folder", allFolders: "All folders", colorsFilter: "Dominant colors", colorsPending: "Color filters appear after image analysis.", removeFilter: "Remove filter", reanalyze: "Reanalyze folder", reanalyzeHelp: "Recheck image details and rerun local text recognition when available.", reanalyzing: "Reanalyzing…", reanalyzeError: "Could not reanalyze this folder.", metadataErrorHelp: "Check that the image is available and uses a supported format.", ocrErrorHelp: "Text recognition failed for this image.",
    yourLibrary: "Your library", captures: "captures", addFolder: "Add folder", search: "Search names, folders and colors…", searchText: "Search names, text and colors…",
    allCaptures: "All captures", recent: "Recently added", name: "Name", dateAdded: "Date added", emptyTitle: "Start with a folder of screenshots",
    emptyBody: "ShotDesk will scan it in the background. You can keep browsing while your library is built.", chooseFolder: "Choose a folder", noResults: "No captures match this search", noResultsBody: "Try another filename or folder name.",
    scanning: "Discovering images", preparingMetadata: "Analyzing image details and colors", preparingModels: "Preparing OCR models", readingText: "Recognizing text in images", awaitingModels: "Image scan complete · OCR needs setup", ready: "Library up to date", discovered: "Images", imagesFound: "Images found", metadataProgress: "Image details analyzed", indexed: "Text recognized", pending: "OCR pending", ocrNotEnabled: "OCR not enabled", failed: "Issues", skipped: "Other images", browseWhileWorking: "You can keep browsing while this runs.", ocrProgress: "Indexing progress",
    localNotice: "Your files stay on this device", localBody: "ShotDesk reads image files in folders you select. It never moves or deletes your originals.", metadata: "Image details", dimensions: "Dimensions", aspectRatio: "Aspect ratio", dpi: "DPI", dpiUnavailable: "Not embedded in image metadata", landscape: "Landscape", portrait: "Portrait", square: "Square", captured: "Taken", camera: "Camera", lens: "Lens", exposure: "Exposure", dominantColors: "Dominant colors", metadataPending: "Analyzing image details…", metadataError: "Image details could not be read.", metadataUnavailable: "Image details are available in the desktop app.", noExif: "No camera EXIF data; screenshots often omit it.",
    foldersTitle: "Folders to index", foldersBody: "Choose the screenshot folders ShotDesk can index. Select a folder to see only its captures.", noFolders: "No folders added yet", remove: "Remove", viewFolder: "View captures", clearFolder: "Clear folder filter", folderScope: "Showing captures from this folder", folderNoImages: "No indexed images in this folder", folderNoImagesBody: "Choose another folder or add images to this one.", details: "Capture details", location: "Location", fileSize: "File size", modified: "Modified", recognizedText: "Recognized text", ocrNeedsSetup: "Enable text search to install the OCR models once. The models stay on this device; your images are never uploaded.", ocrPending: "This capture is waiting for local text recognition.", ocrEmpty: "No readable text was found in this capture.", ocrError: "ShotDesk couldn’t read text in this image. You can retry OCR from the library.", loadingText: "Loading recognized text…", ocrSetupFailed: "OCR models could not be prepared. Check your connection and retry.", enableOcr: "Enable OCR text search", retryOcr: "Retry OCR indexing", ocrSearchInfo: "Search filenames and colors now; enable local OCR to search text inside captures.", suggested: "Common screenshot locations", useLocation: "Index this folder",
    collectionsTitle: "Collections", collectionsBody: "Group captures by project or topic. Collections stay on this device; your image files are never moved.", newCollection: "New collection", createCollection: "Create collection", editCollection: "Edit collection", deleteCollection: "Delete collection", collectionName: "Collection name", collectionDescription: "Description (optional)", collectionNameRequired: "Enter a name for this collection.", collectionNameExists: "A collection with that name already exists.", noCollections: "No collections yet", noCollectionsBody: "Create a collection for a project, topic, or anything you want to keep together.", noCollectionCaptures: "This collection is empty", noCollectionCapturesBody: "Add captures from the library using the detail panel.", captureCount: "captures", backToCollections: "All collections", addCaptures: "Add captures", addToCollection: "Add to collection", alreadyInCollection: "In this collection", notInCollection: "Not in a collection yet", selectCollection: "Choose a collection", removeFromCollection: "Remove from collection", cancel: "Cancel", save: "Save", confirmDeleteCollection: "Delete this collection?", deleteCollectionBody: "The collection will be removed. Your original images and library captures stay untouched.",
    preferencesTitle: "Preferences", preferencesIntro: "Make ShotDesk feel at home on your desktop.", language: "Interface language", languageHelp: "Choose the language used in ShotDesk.", defaultLanguage: "Default language", privacy: "Privacy", privacyLine: "All indexing stays on this device", startup: "Start ShotDesk when I sign in", startupHelp: "Background launch will be available in a later preview.", appearance: "Appearance", dark: "Dark", system: "Follow system", version: "Preview 0.1.0", aboutTitle: "A searchable home for your screenshots", aboutBody: "ShotDesk is a local-first screenshot library in active development. This preview indexes file details and names on your computer.",
    indexedOnDevice: "Indexed on this device", closeDetails: "Close details", clearSearch: "Clear search", sort: "Sort captures", grid: "Grid view", list: "List view", loading: "Working in background", currentFolder: "Current folder", noFolder: "No active folder", scanError: "Could not read this folder", browserTip: "Browser preview: choose a folder to browse local images. Run the desktop build for a persistent local index.", browserOcrUnavailable: "OCR is only available in the desktop build.", ocrSearchReady: "Search includes recognized text and colors from your captures.", tagline: "Your visual memory, in one place.", upToDate: "Everything is up to date", localOnly: "LOCAL ONLY", privateByDesign: "Private by design", laterPreview: "LATER PREVIEW", soon: "SOON", captureLabel: "CAPTURE",
  },
  "fr-FR": {
    library: "Bibliothèque", collections: "Collections", folders: "Dossiers", preferences: "Préférences", about: "À propos", workspace: "ESPACE DE TRAVAIL",
    viewer: "Visionneuse d’image", openImage: "Afficher l’image en grand", closeViewer: "Fermer la visionneuse", previousCapture: "Image précédente", nextCapture: "Image suivante", viewerLoading: "Chargement de l’image…", viewerError: "Impossible d’ouvrir cette image en grand.", filters: "Filtres", clearFilters: "Effacer les filtres", activeFilters: "Filtres actifs", dateFrom: "Modifiée à partir du", dateTo: "Modifiée jusqu’au", folderFilter: "Dossier", allFolders: "Tous les dossiers", colorsFilter: "Couleurs dominantes", colorsPending: "Les couleurs seront filtrables après l’analyse des images.", removeFilter: "Retirer le filtre", reanalyze: "Réanalyser le dossier", reanalyzeHelp: "Réanalyse les détails et relance l’OCR local si les modèles sont disponibles.", reanalyzing: "Nouvelle analyse…", reanalyzeError: "Impossible de réanalyser ce dossier.", metadataErrorHelp: "Vérifiez que l’image est accessible et dans un format pris en charge.", ocrErrorHelp: "La reconnaissance de texte a échoué pour cette image.",
    yourLibrary: "Votre bibliothèque", captures: "captures", addFolder: "Ajouter un dossier", search: "Rechercher dans les noms, dossiers et couleurs…", searchText: "Rechercher dans les noms, textes et couleurs…",
    allCaptures: "Toutes les captures", recent: "Ajoutées récemment", name: "Nom", dateAdded: "Date d’ajout", emptyTitle: "Commencez par un dossier de captures",
    emptyBody: "ShotDesk l’analysera en arrière-plan. Vous pourrez continuer à naviguer pendant la création de votre bibliothèque.", chooseFolder: "Choisir un dossier", noResults: "Aucune capture ne correspond", noResultsBody: "Essayez un autre nom de fichier ou de dossier.",
    scanning: "Découverte des images", preparingMetadata: "Analyse des images et de leurs couleurs", preparingModels: "Préparation des modèles OCR", readingText: "Reconnaissance du texte des images", awaitingModels: "Analyse des images terminée · OCR à configurer", ready: "Bibliothèque à jour", discovered: "Images", imagesFound: "Images trouvées", metadataProgress: "Détails d’image analysés", indexed: "Textes reconnus", pending: "OCR en attente", ocrNotEnabled: "OCR non activé", failed: "Problèmes", skipped: "Autres images", browseWhileWorking: "Vous pouvez continuer à parcourir la bibliothèque.", ocrProgress: "Progression de l’indexation",
    localNotice: "Vos fichiers restent sur cet appareil", localBody: "ShotDesk lit les images des dossiers que vous choisissez. Il ne déplace ni ne supprime vos originaux.", metadata: "Détails de l’image", dimensions: "Dimensions", aspectRatio: "Ratio", dpi: "DPI", dpiUnavailable: "Non intégré aux métadonnées", landscape: "Paysage", portrait: "Portrait", square: "Carré", captured: "Prise le", camera: "Appareil photo", lens: "Objectif", exposure: "Exposition", dominantColors: "Couleurs dominantes", metadataPending: "Analyse des détails de l’image…", metadataError: "Impossible de lire les détails de l’image.", metadataUnavailable: "Les détails des images sont disponibles dans l’application bureau.", noExif: "Aucune donnée EXIF d’appareil photo (souvent absente des captures d’écran).",
    foldersTitle: "Dossiers à indexer", foldersBody: "Choisissez les dossiers que ShotDesk peut indexer. Sélectionnez un dossier pour n’afficher que ses captures.", noFolders: "Aucun dossier ajouté", remove: "Supprimer", viewFolder: "Voir les captures", clearFolder: "Effacer le filtre du dossier", folderScope: "Captures de ce dossier", folderNoImages: "Aucune image indexée dans ce dossier", folderNoImagesBody: "Choisissez un autre dossier ou ajoutez des images dans celui-ci.", details: "Détails de la capture", location: "Emplacement", fileSize: "Taille", modified: "Modifiée", recognizedText: "Texte reconnu", ocrNeedsSetup: "Activez la recherche par texte pour installer les modèles OCR une fois. Ils restent sur cet appareil ; vos images ne sont jamais envoyées.", ocrPending: "Cette capture attend son analyse de texte locale.", ocrEmpty: "Aucun texte lisible n’a été détecté dans cette capture.", ocrError: "ShotDesk n’a pas pu lire le texte de cette image. Vous pouvez relancer l’OCR depuis la bibliothèque.", loadingText: "Chargement du texte reconnu…", ocrSetupFailed: "Impossible de préparer les modèles OCR. Vérifiez la connexion puis réessayez.", enableOcr: "Activer la recherche OCR", retryOcr: "Relancer l’indexation OCR", ocrSearchInfo: "Recherchez déjà par nom et couleur ; activez l’OCR local pour rechercher dans le texte des captures.", suggested: "Emplacements courants des captures", useLocation: "Indexer ce dossier",
    collectionsTitle: "Collections", collectionsBody: "Regroupez vos captures par projet ou par sujet. Les collections restent sur cet appareil et les fichiers originaux ne sont jamais déplacés.", newCollection: "Nouvelle collection", createCollection: "Créer la collection", editCollection: "Modifier la collection", deleteCollection: "Supprimer la collection", collectionName: "Nom de la collection", collectionDescription: "Description (facultative)", collectionNameRequired: "Saisissez un nom pour cette collection.", collectionNameExists: "Une collection porte déjà ce nom.", noCollections: "Aucune collection pour le moment", noCollectionsBody: "Créez une collection pour réunir des captures autour d’un projet ou d’un sujet.", noCollectionCaptures: "Cette collection est vide", noCollectionCapturesBody: "Ajoutez des captures depuis la bibliothèque, dans le panneau de détails.", captureCount: "captures", backToCollections: "Toutes les collections", addCaptures: "Ajouter des captures", addToCollection: "Ajouter à une collection", alreadyInCollection: "Dans cette collection", notInCollection: "Aucune collection associée", selectCollection: "Choisir une collection", removeFromCollection: "Retirer de la collection", cancel: "Annuler", save: "Enregistrer", confirmDeleteCollection: "Supprimer cette collection ?", deleteCollectionBody: "La collection sera supprimée. Les fichiers originaux et les captures de la bibliothèque ne seront pas touchés.",
    preferencesTitle: "Préférences", preferencesIntro: "Adaptez ShotDesk à votre environnement de travail.", language: "Langue de l’interface", languageHelp: "Choisissez la langue utilisée dans ShotDesk.", defaultLanguage: "Langue par défaut", privacy: "Confidentialité", privacyLine: "Toute l’indexation reste sur cet appareil", startup: "Lancer ShotDesk à ma connexion", startupHelp: "Le lancement en arrière-plan sera disponible dans une prochaine preview.", appearance: "Apparence", dark: "Sombre", system: "Suivre le système", version: "Preview 0.1.0", aboutTitle: "Retrouvez vos captures d’écran", aboutBody: "ShotDesk est une bibliothèque de captures locale en cours de développement. Cette preview indexe les noms et les informations des fichiers sur votre ordinateur.",
    indexedOnDevice: "Indexées sur cet appareil", closeDetails: "Fermer les détails", clearSearch: "Effacer la recherche", sort: "Trier les captures", grid: "Vue en grille", list: "Vue en liste", loading: "Traitement en arrière-plan", currentFolder: "Dossier actuel", noFolder: "Aucun dossier actif", scanError: "Impossible de lire ce dossier", browserTip: "Aperçu navigateur : choisissez un dossier pour parcourir les images locales. La version bureau conserve un index local.", browserOcrUnavailable: "L’OCR est disponible uniquement dans la version bureau.", ocrSearchReady: "La recherche inclut le texte reconnu et les couleurs de vos captures.", tagline: "Vos captures réunies en un seul endroit.", upToDate: "Tout est à jour", localOnly: "LOCAL UNIQUEMENT", privateByDesign: "Confidentiel par conception", laterPreview: "PROCHAINE PREVIEW", soon: "BIENTÔT", captureLabel: "CAPTURE",
  },
} satisfies Record<Locale, Record<string, string>>;

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
const isDesktop = isTauri();

function formatSize(bytes: number, locale: Locale) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024)) + " MB";
}

function readableDate(timestamp: number, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp * 1000));
}

function colorLabel(name: string, locale: Locale) {
  if (locale !== "fr-FR") return name;
  const labels: Record<string, string> = { red: "Rouge", orange: "Orange", yellow: "Jaune", green: "Vert", cyan: "Cyan", blue: "Bleu", purple: "Violet", pink: "Rose", brown: "Marron", black: "Noir", gray: "Gris", white: "Blanc" };
  return labels[name] || name;
}

function formatExifDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function aspectRatio(width: number, height: number, locale: Locale) {
  if (width <= 0 || height <= 0) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= 0.01) return { value: "1:1", orientation: "square" as const };
  return {
    value: `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ratio)}:1`,
    orientation: ratio > 1 ? "landscape" as const : "portrait" as const,
  };
}

function formatDpi(dpiX: number | null, dpiY: number | null) {
  if (dpiX && dpiY && dpiX !== dpiY) return `${dpiX} × ${dpiY} DPI`;
  const dpi = dpiX || dpiY;
  return dpi ? `${dpi} DPI` : null;
}

function displayPath(path: string) {
  return path.startsWith("\\\\?\\") ? path.slice(4) : path;
}

function folderName(path: string) {
  return displayPath(path).split(/[\\/]/).filter(Boolean).pop() || displayPath(path);
}

function isInsideFolder(filePath: string, folderPath: string) {
  if (filePath === folderPath) return true;
  const separator = folderPath.includes("\\") ? "\\" : "/";
  const prefix = folderPath.endsWith(separator) ? folderPath : `${folderPath}${separator}`;
  return filePath.startsWith(prefix);
}

function sameCaptureList(left: Capture[], right: Capture[]) {
  return left.length === right.length && left.every((capture, index) => {
    const other = right[index];
    return capture.id === other.id && capture.path === other.path && capture.name === other.name &&
      capture.size === other.size && capture.modified === other.modified && capture.ocrStatus === other.ocrStatus &&
      capture.metadataStatus === other.metadataStatus && capture.width === other.width && capture.height === other.height &&
      JSON.stringify(capture.dominantColors) === JSON.stringify(other.dominantColors);
  });
}

function sameFolderList(left: WatchedFolder[], right: WatchedFolder[]) {
  return left.length === right.length && left.every((folder, index) =>
    folder.path === right[index].path && folder.added === right[index].added,
  );
}

function sameCaptureDetails(left: CaptureDetails | null, right: CaptureDetails) {
  return left !== null && left.status === right.status && left.text === right.text && left.error === right.error &&
    left.metadataStatus === right.metadataStatus && left.metadataError === right.metadataError &&
    left.width === right.width && left.height === right.height && left.capturedAt === right.capturedAt &&
    left.cameraMake === right.cameraMake && left.cameraModel === right.cameraModel && left.lensModel === right.lensModel &&
    left.iso === right.iso && left.exposureTime === right.exposureTime && left.focalLength === right.focalLength &&
    left.dpiX === right.dpiX && left.dpiY === right.dpiY &&
    JSON.stringify(left.dominantColors) === JSON.stringify(right.dominantColors);
}

const CaptureThumbnail = memo(function CaptureThumbnail({
  capture,
  url,
  isDesktop,
  onRequest,
}: {
  capture: Capture;
  url: string;
  isDesktop: boolean;
  onRequest: (path: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isDesktop) return;
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      if (!url) onRequest(capture.path);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !url) onRequest(capture.path);
    }, { rootMargin: "280px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [capture.path, isDesktop, onRequest, url]);

  return (
    <div ref={container} className="capture-thumb">
      {url ? <img src={url} alt="" loading="lazy" /> : <FileImage size={28} />}
      <span className="image-tag">{capture.extension.toUpperCase()}</span>
    </div>
  );
});

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("shotdesk-locale") as Locale) || "en-US");
  const t = copy[locale];
  const [page, setPage] = useState<Page>("library");
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [collectionCaptures, setCollectionCaptures] = useState<Capture[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionFormOpen, setCollectionFormOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [collectionNameInput, setCollectionNameInput] = useState("");
  const [collectionDescriptionInput, setCollectionDescriptionInput] = useState("");
  const [collectionFormError, setCollectionFormError] = useState("");
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [confirmDeleteCollectionId, setConfirmDeleteCollectionId] = useState<number | null>(null);
  const [captureCollectionIds, setCaptureCollectionIds] = useState<number[]>([]);
  const [collectionToAdd, setCollectionToAdd] = useState("");
  const [progress, setProgress] = useState<IndexProgress>(emptyProgress);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>({ modelsReady: false, pending: 0, failed: 0 });
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [colorFilters, setColorFilters] = useState<string[]>([]);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState(false);
  const [reanalyzingFolder, setReanalyzingFolder] = useState<string | null>(null);
  const selectedPathRef = useRef<string | null>(null);
  selectedPathRef.current = selected?.path || null;
  const [selectedText, setSelectedText] = useState<CaptureDetails | null>(null);
  const viewerCloseRef = useRef<HTMLButtonElement>(null);
  const viewerOpenerRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortRecent, setSortRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserUrls, setBrowserUrls] = useState<Record<string, string>>({});
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const thumbnailCache = useRef(new Map<string, string>());
  const thumbnailJobs = useRef(new Set<string>());
  const thumbnailFailures = useRef(new Set<string>());
  const thumbnailQueue = useRef<string[]>([]);
  const thumbnailBusy = useRef(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const desktopUrls = useMemo(() => Object.fromEntries(thumbnailCache.current), [thumbnailVersion]);

  const loadLibrary = useCallback(async () => {
    if (!isDesktop) return;
    try {
      const [nextFolders, nextCaptures] = await Promise.all([
        invoke<WatchedFolder[]>("list_folders"),
        invoke<Capture[]>("list_captures", { query }),
      ]);
      setFolders((previous) => sameFolderList(previous, nextFolders) ? previous : nextFolders);
      setCaptures((previous) => sameCaptureList(previous, nextCaptures) ? previous : nextCaptures);
    } catch (reason) {
      setError(String(reason));
    }
  }, [query]);

  const loadCollections = useCallback(async () => {
    if (!isDesktop) return;
    try {
      const nextCollections = await invoke<Collection[]>("list_collections");
      setCollections(nextCollections);
    } catch (reason) {
      setCollectionFormError(String(reason));
    }
  }, []);

  const loadCollectionCaptures = useCallback(async (collectionId: number) => {
    if (!isDesktop) return;
    setCollectionLoading(true);
    try {
      const nextCaptures = await invoke<Capture[]>("list_collection_captures", { collectionId });
      setCollectionCaptures(nextCaptures);
    } catch (reason) {
      setCollectionFormError(String(reason));
      setCollectionCaptures([]);
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  useEffect(() => { void loadCollections(); }, [loadCollections]);

  useEffect(() => {
    if (page !== "collections" || activeCollectionId === null) {
      setCollectionCaptures([]);
      return;
    }
    void loadCollectionCaptures(activeCollectionId);
  }, [page, activeCollectionId, loadCollectionCaptures]);

  useEffect(() => {
    setCollectionToAdd("");
    if (!isDesktop || !selected?.path) {
      setCaptureCollectionIds([]);
      return;
    }
    let current = true;
    void invoke<number[]>("capture_collection_ids", { path: selected.path })
      .then((ids) => { if (current) setCaptureCollectionIds(ids); })
      .catch(() => { if (current) setCaptureCollectionIds([]); });
    return () => { current = false; };
  }, [isDesktop, selected?.path]);

  useEffect(() => {
    if (!isDesktop) return;
    void loadLibrary();
    const refreshAsFilesArrive = progress.running && progress.stage === "files";
    const refreshSearchAsOcrCompletes = progress.running && (Boolean(query.trim()) || colorFilters.length > 0);
    if (!refreshAsFilesArrive && !refreshSearchAsOcrCompletes) return;
    const timer = window.setInterval(() => void loadLibrary(), 1400);
    return () => window.clearInterval(timer);
  }, [isDesktop, loadLibrary, progress.running, progress.stage, query, colorFilters.length]);

  const loadProgress = useCallback(async () => {
    if (!isDesktop) return;
    try {
      const [nextProgress, nextOcrStatus] = await Promise.all([
        invoke<IndexProgress>("index_progress"),
        invoke<OcrStatus>("ocr_status"),
      ]);
      setProgress((previous) => previous.running === nextProgress.running &&
        previous.currentFolder === nextProgress.currentFolder && previous.stage === nextProgress.stage &&
        previous.discovered === nextProgress.discovered && previous.indexed === nextProgress.indexed &&
        previous.skipped === nextProgress.skipped && previous.failed === nextProgress.failed &&
        previous.metadataDone === nextProgress.metadataDone && previous.metadataTotal === nextProgress.metadataTotal &&
        previous.message === nextProgress.message ? previous : nextProgress);
      setOcrStatus((previous) => previous.modelsReady === nextOcrStatus.modelsReady &&
        previous.pending === nextOcrStatus.pending && previous.failed === nextOcrStatus.failed ? previous : nextOcrStatus);
    } catch (reason) {
      setError(String(reason));
    }
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    void loadProgress();
    const timer = window.setInterval(() => void loadProgress(), 900);
    return () => window.clearInterval(timer);
  }, [isDesktop, loadProgress]);

  useEffect(() => {
    if (!isDesktop || progress.running || progress.stage !== "idle") return;
    void loadLibrary();
  }, [isDesktop, loadLibrary, progress.running, progress.stage]);

  useEffect(() => {
    if (!isDesktop || !selected?.path) {
      setSelectedText(null);
      return;
    }
    let current = true;
    setSelectedText(null);
    void invoke<CaptureDetails>("capture_details", { path: selected.path })
      .then((text) => { if (current) setSelectedText((previous) => sameCaptureDetails(previous, text) ? previous : text); })
      .catch((reason) => {
        if (current) setSelectedText({ status: "error", text: "", error: String(reason), metadataStatus: "error", metadataError: String(reason), width: 0, height: 0, capturedAt: null, cameraMake: null, cameraModel: null, lensModel: null, iso: null, exposureTime: null, focalLength: null, dominantColors: [], dpiX: null, dpiY: null });
      });
    return () => { current = false; };
  }, [isDesktop, selected?.path]);

  useEffect(() => {
    if (!isDesktop || !selected?.path || !progress.running) return;
    const shouldPollDetails = progress.running && progress.stage === "metadata" && selectedText?.metadataStatus === "pending";
    if (!shouldPollDetails) return;
    let current = true;
    const timer = window.setInterval(() => {
      void invoke<CaptureDetails>("capture_details", { path: selected.path })
        .then((details) => { if (current) setSelectedText((previous) => sameCaptureDetails(previous, details) ? previous : details); })
        .catch(() => undefined);
    }, 1200);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [isDesktop, selected?.path, progress.running, progress.stage, selectedText?.metadataStatus]);

  useEffect(() => {
    if (!isDesktop || folders.length > 0) return;
    void invoke<string[]>("suggest_folders").then(setSuggestions).catch(() => setSuggestions([]));
  }, [folders.length]);

  useEffect(() => {
    localStorage.setItem("shotdesk-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => Object.values(browserUrls).forEach(URL.revokeObjectURL), [browserUrls]);

  const shownCaptures = useMemo(() => {
    let results = captures;
    if (activeFolder) results = results.filter((capture) => isInsideFolder(capture.path, activeFolder));
    if (folderFilter) results = results.filter((capture) => isInsideFolder(capture.path, folderFilter));
    if (dateFrom) {
      const lowerBound = new Date(`${dateFrom}T00:00:00`).getTime() / 1000;
      results = results.filter((capture) => capture.modified >= lowerBound);
    }
    if (dateTo) {
      const upperBound = new Date(`${dateTo}T23:59:59.999`).getTime() / 1000;
      results = results.filter((capture) => capture.modified <= upperBound);
    }
    if (colorFilters.length) {
      results = results.filter((capture) => colorFilters.every((color) => capture.dominantColors.some((dominant) => dominant.name === color)));
    }
    const needle = query.trim().toLocaleLowerCase(locale);
    const filtered = needle && !isDesktop ? results.filter((capture) => `${capture.name} ${capture.path}`.toLocaleLowerCase(locale).includes(needle)) : [...results];
    filtered.sort((a, b) => sortRecent ? b.modified - a.modified : a.name.localeCompare(b.name));
    return filtered;
  }, [captures, sortRecent, query, locale, activeFolder, folderFilter, dateFrom, dateTo, colorFilters]);

  const availableColors = useMemo(() => [...new Set(captures.flatMap((capture) => capture.dominantColors.map((color) => color.name)))].sort(), [captures]);
  const hasActiveFilters = Boolean(activeFolder || folderFilter || dateFrom || dateTo || colorFilters.length);
  const activeFilterCount = Number(Boolean(activeFolder)) + Number(Boolean(folderFilter)) + Number(Boolean(dateFrom || dateTo)) + colorFilters.length;
  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) || null;
  const viewerCaptures = page === "collections" && activeCollectionId !== null ? collectionCaptures : shownCaptures;
  const viewerIndex = selected ? viewerCaptures.findIndex((capture) => capture.path === selected.path) : -1;

  useEffect(() => {
    if (!viewerOpen || !selected) {
      setViewerImage("");
      setViewerLoading(false);
      return;
    }
    if (!isDesktop) {
      setViewerImage(imageUrl(selected));
      setViewerLoading(false);
      setViewerError(false);
      return;
    }
    let current = true;
    setViewerImage("");
    setViewerError(false);
    setViewerLoading(true);
    void invoke<string>("capture_image", {
      path: selected.path,
      maxWidth: Math.round(window.innerWidth * window.devicePixelRatio),
      maxHeight: Math.round(window.innerHeight * window.devicePixelRatio),
    })
      .then((image) => { if (current) setViewerImage(image); })
      .catch(() => { if (current) setViewerError(true); })
      .finally(() => { if (current) setViewerLoading(false); });
    return () => { current = false; };
  }, [viewerOpen, selected?.path]);

  useEffect(() => {
    if (!viewerOpen) {
      if (selected) viewerOpenerRef.current?.focus();
      return;
    }
    viewerCloseRef.current?.focus();
    const onViewerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setViewerOpen(false);
        return;
      }
      if (event.key === "ArrowLeft" && viewerIndex > 0) {
        event.preventDefault();
        setSelected(viewerCaptures[viewerIndex - 1]);
      } else if (event.key === "ArrowRight" && viewerIndex >= 0 && viewerIndex < viewerCaptures.length - 1) {
        event.preventDefault();
        setSelected(viewerCaptures[viewerIndex + 1]);
      }
    };
    window.addEventListener("keydown", onViewerKeyDown);
    return () => window.removeEventListener("keydown", onViewerKeyDown);
  }, [viewerOpen, viewerIndex, viewerCaptures, selected?.path]);

  const runThumbnailQueue = useCallback(() => {
    while (isDesktop && thumbnailBusy.current < 2 && thumbnailQueue.current.length > 0) {
      const path = thumbnailQueue.current.shift()!;
      thumbnailBusy.current += 1;
      void invoke<string>("capture_thumbnail", { path })
        .then((image) => {
          thumbnailCache.current.set(path, image);
          while (thumbnailCache.current.size > 72) {
            const oldest = [...thumbnailCache.current.keys()].find((candidate) => candidate !== selectedPathRef.current);
            if (!oldest) break;
            thumbnailCache.current.delete(oldest);
          }
          setThumbnailVersion((version) => version + 1);
        })
        .catch(() => {
          // Unsupported or unreadable images keep their file-type placeholder.
          thumbnailFailures.current.add(path);
          if (thumbnailFailures.current.size > 72) {
            const oldestFailure = thumbnailFailures.current.values().next().value;
            if (oldestFailure) thumbnailFailures.current.delete(oldestFailure);
          }
        })
        .finally(() => {
          thumbnailBusy.current -= 1;
          thumbnailJobs.current.delete(path);
          runThumbnailQueue();
        });
    }
  }, [isDesktop]);

  const requestThumbnail = useCallback((path: string) => {
    if (!isDesktop || thumbnailCache.current.has(path) || thumbnailJobs.current.has(path) || thumbnailFailures.current.has(path)) return;
    thumbnailJobs.current.add(path);
    thumbnailQueue.current.push(path);
    runThumbnailQueue();
  }, [isDesktop, runThumbnailQueue]);

  useEffect(() => {
    if (selected?.path) void requestThumbnail(selected.path);
  }, [selected?.path]);

  async function chooseFolder() {
    setError(null);
    if (isDesktop) {
      try {
        const selectedPath = await open({ directory: true, multiple: false, title: t.chooseFolder });
        if (typeof selectedPath !== "string") return;
        await invoke("add_folder", { path: selectedPath });
        setPage("library");
        await Promise.all([loadLibrary(), loadProgress()]);
      } catch (reason) {
        setError(String(reason));
      }
    } else {
      inputRef.current?.click();
    }
  }

  async function addSuggestedFolder(path: string) {
    try {
      setError(null);
      await invoke("add_folder", { path });
      setSuggestions([]);
      await Promise.all([loadLibrary(), loadProgress()]);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function enableOcrSearch() {
    try {
      setError(null);
      await invoke("enable_ocr_search");
      setPage("library");
      await Promise.all([loadLibrary(), loadProgress()]);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function loadBrowserFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextUrls: Record<string, string> = {};
    const nextCaptures: Capture[] = [];
    let index = 0;
    for (const file of Array.from(files)) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!imageExtensions.has(extension)) continue;
      const path = file.webkitRelativePath || file.name;
      nextUrls[path] = URL.createObjectURL(file);
      nextCaptures.push({ id: index++, path, name: file.name, extension, size: file.size, modified: Math.floor(file.lastModified / 1000), ocrStatus: "unavailable", metadataStatus: "unavailable", width: 0, height: 0, dominantColors: [] });
    }
    setBrowserUrls((previous) => {
      Object.values(previous).forEach(URL.revokeObjectURL);
      return nextUrls;
    });
    setCaptures(nextCaptures);
    setFolders([{ path: files[0].webkitRelativePath.split("/")[0] || "Selected folder", added: Date.now() / 1000 }]);
    setProgress({ ...emptyProgress, discovered: nextCaptures.length, indexed: nextCaptures.length });
    setQuery("");
    setPage("library");
  }

  async function removeFolder(path: string) {
    if (isDesktop) {
      await invoke("remove_folder", { path });
      await Promise.all([loadLibrary(), loadProgress(), loadCollections()]);
      setSelected(null);
      if (activeFolder && isInsideFolder(activeFolder, path)) setActiveFolder(null);
      return;
    }
    setFolders([]);
    setCaptures([]);
    setSelected(null);
    setActiveFolder(null);
    setProgress(emptyProgress);
    setBrowserUrls((previous) => {
      Object.values(previous).forEach(URL.revokeObjectURL);
      return {};
    });
  }

  async function reanalyzeFolder(path: string) {
    setError(null);
    setReanalyzingFolder(path);
    try {
      await invoke("reanalyze_folder", { path });
      setSelected(null);
      setViewerOpen(false);
      setActiveFolder(path);
      setPage("library");
      await Promise.all([loadLibrary(), loadProgress()]);
    } catch (reason) {
      setError(`${t.reanalyzeError} ${String(reason)}`);
    } finally {
      setReanalyzingFolder(null);
    }
  }

  function clearFilters() {
    setActiveFolder(null);
    setFolderFilter("");
    setDateFrom("");
    setDateTo("");
    setColorFilters([]);
  }

  function toggleColorFilter(color: string) {
    setColorFilters((previous) => previous.includes(color)
      ? previous.filter((value) => value !== color)
      : [...previous, color]);
  }

  function startNewCollection() {
    setEditingCollectionId(null);
    setCollectionNameInput("");
    setCollectionDescriptionInput("");
    setCollectionFormError("");
    setCollectionFormOpen(true);
  }

  function startEditingCollection(collection: Collection) {
    setEditingCollectionId(collection.id);
    setCollectionNameInput(collection.name);
    setCollectionDescriptionInput(collection.description);
    setCollectionFormError("");
    setCollectionFormOpen(true);
  }

  async function saveCollection(event: { preventDefault: () => void }) {
    event.preventDefault();
    const name = collectionNameInput.trim();
    if (!name) {
      setCollectionFormError(t.collectionNameRequired);
      return;
    }
    setCollectionSaving(true);
    setCollectionFormError("");
    try {
      if (editingCollectionId === null) {
        const id = await invoke<number>("create_collection", { name, description: collectionDescriptionInput });
        await loadCollections();
        setActiveCollectionId(id);
      } else {
        await invoke("update_collection", { id: editingCollectionId, name, description: collectionDescriptionInput });
        await loadCollections();
      }
      setCollectionFormOpen(false);
      setEditingCollectionId(null);
    } catch (reason) {
      const message = String(reason);
      setCollectionFormError(message.includes("already exists") ? t.collectionNameExists : message.includes("Enter a name") ? t.collectionNameRequired : message);
    } finally {
      setCollectionSaving(false);
    }
  }

  async function confirmDeleteCollection(id: number) {
    try {
      await invoke("delete_collection", { id });
      setCollections((previous) => previous.filter((collection) => collection.id !== id));
      setCaptureCollectionIds((previous) => previous.filter((collectionId) => collectionId !== id));
      setConfirmDeleteCollectionId(null);
      if (activeCollectionId === id) {
        setActiveCollectionId(null);
        setSelected(null);
      }
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function addSelectedToCollection() {
    const id = Number(collectionToAdd);
    if (!selected || !id) return;
    try {
      await invoke("add_capture_to_collection", { collectionId: id, path: selected.path });
      setCaptureCollectionIds((previous) => previous.includes(id) ? previous : [...previous, id]);
      setCollectionToAdd("");
      await loadCollections();
      if (activeCollectionId === id) await loadCollectionCaptures(id);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function removeSelectedFromCollection(id: number) {
    if (!selected) return;
    try {
      await invoke("remove_capture_from_collection", { collectionId: id, path: selected.path });
      setCaptureCollectionIds((previous) => previous.filter((collectionId) => collectionId !== id));
      await loadCollections();
      if (activeCollectionId === id) {
        await loadCollectionCaptures(id);
        setSelected(null);
      }
    } catch (reason) {
      setError(String(reason));
    }
  }

  function openLibraryForCollection() {
    setPage("library");
    setSelected(null);
    setActiveFolder(null);
    setQuery("");
    clearFilters();
  }

  function imageUrl(capture: Capture) {
    return isDesktop ? desktopUrls[capture.path] || "" : browserUrls[capture.path] || "";
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setViewerOpen(false);
    setSelected(null);
    if (nextPage === "collections") setActiveCollectionId(null);
    else if (nextPage !== "library") setActiveCollectionId(null);
    if (nextPage !== "collections") setCollectionFormOpen(false);
    if (nextPage === "library") setActiveFolder(null);
  }

  function openFolderInLibrary(path: string) {
    setActiveFolder(path);
    setActiveCollectionId(null);
    setPage("library");
    setViewerOpen(false);
    setSelected(null);
    setQuery("");
  }

  function progressLabel() {
    if (progress.stage === "files") return t.scanning;
    if (progress.stage === "metadata") return t.preparingMetadata;
    if (progress.stage === "models") return t.preparingModels;
    if (progress.stage === "ocr") return t.readingText;
    if (progress.stage === "awaiting-models") return t.awaitingModels;
    return progress.running ? t.scanning : t.ready;
  }

  function progressMetrics() {
    const ocrPending = Math.max(0, progress.discovered - progress.indexed - progress.failed);
    if (progress.stage === "files") return [
      { value: progress.discovered, label: t.imagesFound },
      { value: progress.skipped, label: t.skipped },
      { value: progress.failed, label: t.failed },
    ];
    if (progress.stage === "metadata") return [
      { value: `${progress.metadataDone} / ${progress.metadataTotal}`, label: t.metadataProgress },
      { value: progress.discovered, label: t.imagesFound },
      { value: progress.failed, label: t.failed },
    ];
    if (progress.stage === "models") return [
      { value: progress.discovered, label: t.imagesFound },
      { value: ocrPending, label: t.pending },
    ];
    if (progress.stage === "ocr") return [
      { value: progress.indexed, label: t.indexed },
      { value: ocrPending, label: t.pending },
      { value: progress.failed, label: t.failed },
    ];
    if (progress.stage === "awaiting-models") return [
      { value: progress.discovered, label: t.imagesFound },
      { value: ocrPending, label: t.ocrNotEnabled },
    ];
    return [
      { value: progress.discovered, label: t.discovered },
      { value: progress.indexed, label: t.indexed },
      { value: ocrPending, label: t.pending },
      { value: progress.skipped, label: t.skipped },
      { value: progress.failed, label: t.failed },
    ];
  }

  function progressPercent() {
    if (progress.stage === "metadata") {
      return progress.metadataTotal ? (progress.metadataDone / progress.metadataTotal) * 100 : 8;
    }
    if (progress.stage === "ocr") {
      return progress.discovered ? (progress.indexed / progress.discovered) * 100 : 8;
    }
    return progress.running ? 24 : progress.discovered ? 100 : 0;
  }

  const isEmpty = captures.length === 0 && !activeFolder;

  return (
    <div className="app-shell">
      <input ref={inputRef} className="visually-hidden" type="file" multiple {...({ webkitdirectory: "" } as Record<string, string>)} onChange={(event) => void loadBrowserFiles(event.currentTarget.files)} />
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div className="brand-name">shot<span>desk</span></div>
        </div>
        <button className={`library-switch ${page === "library" ? "active" : ""}`} onClick={() => navigate("library")}>
          <span className="switch-icon"><LayoutGrid size={16} /></span><span>{t.yourLibrary}</span><span className="switch-count">{captures.length}</span>
        </button>
        <div className="side-label">{t.workspace}</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={page === "collections" ? "selected" : ""} onClick={() => navigate("collections")}><Archive size={16} /><span>{t.collections}</span><span className="nav-count">{collections.length}</span></button>
          <button className={page === "folders" ? "selected" : ""} onClick={() => navigate("folders")}><Folder size={16} /><span>{t.folders}</span><span className="nav-count">{folders.length}</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-chip"><span className="privacy-icon"><LockKeyhole size={13} /></span><span>{t.indexedOnDevice}</span><ShieldCheck size={14} className="privacy-check" /></div>
        <div className="sidebar-footer">
          <button className={page === "preferences" ? "selected" : ""} onClick={() => navigate("preferences")}><Settings2 size={16} /><span>{t.preferences}</span></button>
          <button className={page === "about" ? "selected" : ""} onClick={() => navigate("about")}><CircleHelp size={16} /><span>{t.about}</span></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>ShotDesk</span><span className="crumb-slash">/</span><strong>{page === "library" ? t.library : page === "collections" ? t.collections : page === "folders" ? t.folders : page === "preferences" ? t.preferences : t.about}</strong></div>
          <div className="topbar-actions">
            <button className="language-quick" onClick={() => setLocale(locale === "en-US" ? "fr-FR" : "en-US")} aria-label="Change language"><Languages size={15} /><span>{locale === "en-US" ? "EN" : "FR"}</span><ChevronDown size={12} /></button>
          </div>
        </header>

        <div className="page-body">
          {page === "library" && <>
            <div className="library-heading">
              <div><div className="heading-line"><h1>{activeFolder ? folderName(activeFolder) : t.allCaptures}</h1><span className="result-count">{shownCaptures.length} {t.captures}</span></div><p className="subheading">{activeCollection ? `${t.addCaptures}: ${activeCollection.name}` : activeFolder ? t.folderScope : t.tagline}</p></div>
              <div className="heading-actions">{activeCollectionId !== null && <button className="toolbar-button" onClick={() => setPage("collections")}><ChevronLeft size={14} />{t.backToCollections}</button>}{activeFolder && <button className="toolbar-button clear-folder" onClick={() => { setActiveFolder(null); setSelected(null); }}><X size={14} />{t.clearFolder}</button>}<button className="primary-button" onClick={() => void chooseFolder()}><FolderPlus size={16} />{t.addFolder}</button></div>
            </div>
            <div className="search-row">
              <div className="search-box" role="search"><Search size={17} aria-hidden="true" /><input ref={searchRef} aria-label={t.search} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && query) setQuery(""); }} placeholder={ocrStatus.modelsReady ? t.searchText : t.search} />{query && <button className="clear-search" type="button" aria-label={t.clearSearch} title={t.clearSearch} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={14} /></button>}<kbd>Ctrl K</kbd></div>
              <button className="toolbar-button" title={t.sort} onClick={() => setSortRecent((value) => !value)}><ArrowDownWideNarrow size={16} /><span>{sortRecent ? t.recent : t.name}</span><ChevronDown size={13} /></button>
              <div className="view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} title={t.grid}><LayoutGrid size={16} /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title={t.list}><ListFilter size={16} /></button></div>
              <button className={`toolbar-button filter-toggle ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} aria-controls="capture-filters" onClick={() => setFiltersOpen((open) => !open)}><Filter size={15} /><span>{t.filters}</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
            </div>
            {filtersOpen && <section className="filter-panel" id="capture-filters" aria-label={t.filters}>
              <label><span>{t.dateFrom}</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label><span>{t.dateTo}</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
              <label><span>{t.folderFilter}</span><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="">{t.allFolders}</option>{folders.map((folder) => <option value={folder.path} key={folder.path}>{folderName(folder.path)}</option>)}</select></label>
              <div className="filter-colors"><span>{t.colorsFilter}</span><div className="color-filter-options">{availableColors.length ? availableColors.map((color) => {
                const hex = captures.flatMap((capture) => capture.dominantColors).find((item) => item.name === color)?.hex || "#78838f";
                const active = colorFilters.includes(color);
                return <button type="button" className={`color-filter-option ${active ? "selected" : ""}`} key={color} aria-pressed={active} onClick={() => toggleColorFilter(color)}><i style={{ backgroundColor: hex }} />{colorLabel(color, locale)}</button>;
              }) : <small>{t.colorsPending}</small>}</div></div>
              {hasActiveFilters && <button className="clear-filter-button" type="button" onClick={clearFilters}><X size={13} />{t.clearFilters}</button>}
            </section>}
            {hasActiveFilters && <div className="active-filters" role="group" aria-label={t.activeFilters}>
              {activeFolder && <button type="button" className="active-filter-chip" onClick={() => setActiveFolder(null)}><span>{folderName(activeFolder)}</span><X size={12} aria-label={t.removeFilter} /></button>}
              {folderFilter && <button type="button" className="active-filter-chip" onClick={() => setFolderFilter("")}><span>{folderName(folderFilter)}</span><X size={12} aria-label={t.removeFilter} /></button>}
              {(dateFrom || dateTo) && <button type="button" className="active-filter-chip" onClick={() => { setDateFrom(""); setDateTo(""); }}><span>{dateFrom || "…"} – {dateTo || "…"}</span><X size={12} aria-label={t.removeFilter} /></button>}
              {colorFilters.map((color) => <button type="button" className="active-filter-chip" key={color} onClick={() => toggleColorFilter(color)}><span>{colorLabel(color, locale)}</span><X size={12} aria-label={t.removeFilter} /></button>)}
              <button type="button" className="clear-all-filters" onClick={clearFilters}>{t.clearFilters}</button>
            </div>}
            {(progress.running || progress.discovered > 0 || folders.length > 0 || progress.message || error) && <section className={`index-progress ${progress.running ? "is-running" : ""}`} aria-live="polite">
              <div className="progress-main"><span className={`progress-indicator ${progress.running ? "is-scanning" : ""}`}>{progress.running ? <ScanSearch size={15} /> : error || progress.message ? <Info size={15} /> : <Check size={15} />}</span><div className="progress-text"><strong>{error || progress.message ? t.scanError : progressLabel()}</strong><span>{displayPath(progress.currentFolder || folders[0]?.path || t.noFolder)}</span>{progress.running && <span className="browse-note">{t.browseWhileWorking}</span>}</div>{progress.running && <span className="live-badge">LIVE</span>}</div>
              <div className="progress-counts">{progressMetrics().map((metric) => <span key={metric.label}><b>{metric.value}</b>{metric.label}</span>)}</div>
              <div className={`progress-track ${progress.running && progress.stage !== "metadata" && progress.stage !== "ocr" ? "is-indeterminate" : ""}`} role="progressbar" aria-label={`${progressLabel()} · ${t.ocrProgress}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.running && progress.stage !== "metadata" && progress.stage !== "ocr" ? undefined : Math.round(progressPercent())}><span style={{ width: `${progressPercent()}%` }} /></div>
              {!progress.running && isDesktop && folders.length > 0 && (!ocrStatus.modelsReady || ocrStatus.pending > 0 || ocrStatus.failed > 0) && <div className="ocr-enable-row"><span>{progress.message ? t.ocrSetupFailed : !ocrStatus.modelsReady ? t.ocrNeedsSetup : t.ocrSearchInfo}</span><button className="toolbar-button" onClick={() => void enableOcrSearch()}><ScanSearch size={14} />{ocrStatus.modelsReady ? t.retryOcr : t.enableOcr}</button></div>}
            </section>}
            {isEmpty ? <section className="empty-state"><div className="empty-art"><div className="empty-frame frame-back"><FileImage size={22} /></div><div className="empty-frame frame-front"><ImagePlus size={25} /></div><span className="empty-plus">+</span></div><h2>{query ? t.noResults : t.emptyTitle}</h2><p>{query ? t.noResultsBody : t.emptyBody}</p>{!query && <button className="primary-button" onClick={() => void chooseFolder()}><FolderPlus size={16} />{t.chooseFolder}</button>}{!query && suggestions.length > 0 && <div className="suggested-folders"><span>{t.suggested}</span>{suggestions.slice(0, 3).map((path) => <button key={path} onClick={() => void addSuggestedFolder(path)}><Folder size={13} /><span title={path}>{path.split(/[\\/]/).filter(Boolean).slice(-2).join("/")}</span><small>{t.useLocation}</small></button>)}</div>}<div className="empty-footnote"><LockKeyhole size={13} />{t.localNotice}</div></section>
              : shownCaptures.length === 0 ? <div className="no-results"><Search size={20} /><strong>{activeFolder && !query ? t.folderNoImages : t.noResults}</strong><span>{query ? t.noResultsBody : activeFolder ? t.folderNoImagesBody : t.noResultsBody}</span></div>
              : <div className={`capture-grid ${view === "list" ? "list-view" : ""}`}>
                {shownCaptures.map((capture) => <button key={capture.id} className={`capture-item ${selected?.id === capture.id ? "is-selected" : ""}`} onClick={() => setSelected(capture)}>
                   <CaptureThumbnail capture={capture} url={imageUrl(capture)} isDesktop={isDesktop} onRequest={requestThumbnail} />
                  <div className="capture-meta"><span className="capture-name" title={capture.name}>{capture.name}</span><span className="capture-submeta">{readableDate(capture.modified, locale)} <i /> {formatSize(capture.size, locale)}</span></div>
                </button>)}
              </div>}
            <div className="local-footnote"><LockKeyhole size={13} /><span>{t.localBody}</span><span className="footnote-divider" /><span>{ocrStatus.modelsReady ? t.ocrSearchReady : t.ocrSearchInfo}</span></div>
          </>}

          {page === "folders" && <section className="settings-page"><div className="settings-heading"><div><h1>{t.foldersTitle}</h1><p>{t.foldersBody}</p></div><button className="primary-button" onClick={() => void chooseFolder()}><FolderPlus size={16} />{t.addFolder}</button></div>
             <div className="folder-list">{folders.length === 0 ? <div className="folder-empty"><Folder size={20} /><span>{t.noFolders}</span></div> : folders.map((folder) => <div className="folder-row" key={folder.path}><button className="folder-open-button" onClick={() => openFolderInLibrary(folder.path)} title={t.viewFolder}><span className="folder-icon"><Folder size={17} /></span><span className="folder-row-copy"><strong>{folderName(folder.path)}</strong><span title={displayPath(folder.path)}>{displayPath(folder.path)}</span></span><span className="folder-count">{captures.filter((capture) => isInsideFolder(capture.path, folder.path)).length} {t.captures}</span><span className="folder-view">{t.viewFolder}<ArrowRight size={14} /></span></button><button className="subtle-button reanalyze-button" onClick={() => void reanalyzeFolder(folder.path)} disabled={progress.running || reanalyzingFolder !== null} title={t.reanalyzeHelp} aria-label={`${t.reanalyze}: ${folderName(folder.path)}`}><RefreshCw size={13} className={reanalyzingFolder === folder.path ? "is-spinning" : ""} /><span>{reanalyzingFolder === folder.path ? t.reanalyzing : t.reanalyze}</span></button><button className="subtle-button danger" onClick={() => void removeFolder(folder.path)}>{t.remove}</button></div>)}</div>
            {!isDesktop && <p className="browser-note"><Info size={14} />{t.browserTip}</p>}
          </section>}

          {page === "collections" && <section className="settings-page collections-page">
            {activeCollection ? <>
              <div className="collection-detail-heading"><button className="toolbar-button" onClick={() => { setActiveCollectionId(null); setSelected(null); }}><ChevronLeft size={15} />{t.backToCollections}</button><div className="collection-detail-title"><h1>{activeCollection.name}</h1><p>{activeCollection.description || t.collectionsBody}</p></div><div className="collection-detail-actions"><button className="toolbar-button" onClick={() => startEditingCollection(activeCollection)}>{t.editCollection}</button><button className="toolbar-button" onClick={openLibraryForCollection}><FolderPlus size={14} />{t.addCaptures}</button><button className="subtle-button danger" onClick={() => setConfirmDeleteCollectionId(activeCollection.id)}>{t.deleteCollection}</button></div></div>
              {confirmDeleteCollectionId === activeCollection.id && <div className="collection-confirm-delete" role="group"><div><strong>{t.confirmDeleteCollection}</strong><span>{t.deleteCollectionBody}</span></div><button className="subtle-button" onClick={() => setConfirmDeleteCollectionId(null)}>{t.cancel}</button><button className="subtle-button danger" onClick={() => void confirmDeleteCollection(activeCollection.id)}>{t.deleteCollection}</button></div>}
              {collectionFormOpen && <form className="collection-form" onSubmit={(event) => void saveCollection(event)}><label><span>{t.collectionName}</span><input autoFocus maxLength={80} value={collectionNameInput} onChange={(event) => setCollectionNameInput(event.target.value)} /></label><label><span>{t.collectionDescription}</span><textarea maxLength={500} rows={3} value={collectionDescriptionInput} onChange={(event) => setCollectionDescriptionInput(event.target.value)} /></label>{collectionFormError && <p className="collection-form-error" role="alert">{collectionFormError}</p>}<div className="collection-form-actions"><button type="button" className="subtle-button" onClick={() => { setCollectionFormOpen(false); setCollectionFormError(""); }}>{t.cancel}</button><button type="submit" className="primary-button" disabled={collectionSaving}>{collectionSaving ? t.loading : t.save}</button></div></form>}
              {collectionLoading ? <div className="collection-empty"><ScanSearch size={18} />{t.loading}</div> : collectionCaptures.length === 0 ? <div className="collection-empty"><Archive size={20} /><strong>{t.noCollectionCaptures}</strong><span>{t.noCollectionCapturesBody}</span><button className="primary-button" onClick={openLibraryForCollection}><FolderPlus size={15} />{t.addCaptures}</button></div> : <div className={`capture-grid ${view === "list" ? "list-view" : ""}`}>{collectionCaptures.map((capture) => <button key={capture.id} className={`capture-item ${selected?.id === capture.id ? "is-selected" : ""}`} onClick={() => setSelected(capture)}><CaptureThumbnail capture={capture} url={imageUrl(capture)} isDesktop={isDesktop} onRequest={requestThumbnail} /><div className="capture-meta"><span className="capture-name" title={capture.name}>{capture.name}</span><span className="capture-submeta">{readableDate(capture.modified, locale)} <i /> {formatSize(capture.size, locale)}</span></div></button>)}</div>}
            </> : <>
              <div className="settings-heading"><div><h1>{t.collectionsTitle}</h1><p>{t.collectionsBody}</p></div><button className="primary-button" onClick={startNewCollection} disabled={!isDesktop}><Archive size={15} />{t.newCollection}</button></div>
              {collectionFormOpen && <form className="collection-form" onSubmit={(event) => void saveCollection(event)}><label><span>{t.collectionName}</span><input autoFocus maxLength={80} value={collectionNameInput} onChange={(event) => setCollectionNameInput(event.target.value)} /></label><label><span>{t.collectionDescription}</span><textarea maxLength={500} rows={3} value={collectionDescriptionInput} onChange={(event) => setCollectionDescriptionInput(event.target.value)} /></label>{collectionFormError && <p className="collection-form-error" role="alert">{collectionFormError}</p>}<div className="collection-form-actions"><button type="button" className="subtle-button" onClick={() => { setCollectionFormOpen(false); setCollectionFormError(""); }}>{t.cancel}</button><button type="submit" className="primary-button" disabled={collectionSaving}>{collectionSaving ? t.loading : t.createCollection}</button></div></form>}
              {collectionFormError && !collectionFormOpen && <p className="collection-form-error" role="alert">{collectionFormError}</p>}
              {!isDesktop && <p className="browser-note"><Info size={14} />{t.browserTip}</p>}
              {collections.length === 0 ? <div className="collection-empty collection-list-empty"><Archive size={22} /><strong>{t.noCollections}</strong><span>{t.noCollectionsBody}</span><button className="primary-button" onClick={startNewCollection} disabled={!isDesktop}><Archive size={15} />{t.newCollection}</button></div> : <div className="collection-list">{collections.map((collection) => <button className="collection-row" key={collection.id} onClick={() => { setActiveCollectionId(collection.id); setCollectionFormOpen(false); setCollectionFormError(""); }}><span className="collection-row-icon"><Archive size={17} /></span><span className="collection-row-copy"><strong>{collection.name}</strong><span>{collection.description || t.collectionsBody}</span></span><span className="collection-count">{collection.captureCount} {t.captureCount}</span><ArrowRight size={15} className="collection-row-arrow" /></button>)}</div>}
            </>}
          </section>}

          {page === "preferences" && <section className="settings-page"><div className="settings-heading"><div><h1>{t.preferencesTitle}</h1><p>{t.preferencesIntro}</p></div></div>
            <div className="settings-section"><div className="settings-section-title"><Languages size={16} /><div><strong>{t.language}</strong><span>{t.languageHelp}</span></div></div><label className="select-wrap"><span>{t.defaultLanguage}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en-US">English (United States)</option><option value="fr-FR">Français (France)</option></select><ChevronDown size={14} /></label></div>
            <div className="settings-section"><div className="settings-section-title"><HardDrive size={16} /><div><strong>{t.privacy}</strong><span>{t.privacyLine}</span></div></div><div className="privacy-setting"><span className="privacy-setting-icon"><ShieldCheck size={17} /></span><span>{t.localNotice}</span><span className="enabled-pill"><Check size={12} />ON</span></div></div>
            <div className="settings-section"><div className="settings-section-title"><Clock3 size={16} /><div><strong>{t.startup}</strong><span>{t.startupHelp}</span></div></div><button className="toggle-switch" aria-checked="false" role="switch" disabled><span /></button></div>
          </section>}

          {page === "about" && <section className="about-page"><div className="about-mark"><div className="brand-mark large"><span /><span /><span /><span /></div><strong>shot<span>desk</span></strong><small>{t.version}</small></div><h1>{t.aboutTitle}</h1><p>{t.aboutBody}</p><div className="about-facts"><span><LockKeyhole size={15} />{t.privateByDesign}</span><span><Sparkles size={15} />Local-first</span><span><Info size={15} />Windows · Linux</span></div><div className="about-disclaimer">{t.ocrPending}</div></section>}
        </div>
        <footer className="statusbar"><div><LockKeyhole size={12} /> {t.localOnly} <span className="status-separator">·</span> v0.1.0</div></footer>
      </main>

      {selected && page === "library" && <aside className="detail-panel"><header className="detail-header"><h2>{t.details}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label={t.closeDetails}><PanelRightClose size={17} /></button></header><div className="detail-preview">{imageUrl(selected) && <img src={imageUrl(selected)} alt={selected.name} />}<button ref={viewerOpenerRef} type="button" className="viewer-open-button" onClick={() => setViewerOpen(true)} aria-label={t.openImage} title={t.openImage}><Maximize2 size={15} /></button></div><div className="detail-content"><h3 title={selected.name}>{selected.name}</h3><span className="detail-date">{readableDate(selected.modified, locale)}</span><div className="detail-separator" /><div className="detail-field"><span>{t.location}</span><code title={displayPath(selected.path)}>{displayPath(selected.path)}</code></div><div className="detail-field"><span>{t.fileSize}</span><strong>{formatSize(selected.size, locale)}</strong></div><div className="detail-field"><span>{t.modified}</span><strong>{readableDate(selected.modified, locale)}</strong></div>
        <section className="metadata-section"><div className="metadata-heading"><FileImage size={14} /><strong>{t.metadata}</strong></div>{selectedText?.metadataStatus === "ready" ? <><div className="detail-field"><span>{t.dimensions}</span><strong>{selectedText.width} × {selectedText.height}</strong></div>{(() => { const ratio = aspectRatio(selectedText.width, selectedText.height, locale); if (!ratio) return null; const OrientationIcon = ratio.orientation === "landscape" ? RectangleHorizontal : ratio.orientation === "portrait" ? RectangleVertical : Square; return <div className="detail-field"><span>{t.aspectRatio}</span><strong className="aspect-value" aria-label={`${t[ratio.orientation]} · ${ratio.value}`}><OrientationIcon size={13} aria-hidden="true" />{ratio.value}</strong></div>; })()}<div className="detail-field"><span>{t.dpi}</span><strong>{formatDpi(selectedText.dpiX, selectedText.dpiY) || t.dpiUnavailable}</strong></div>{selectedText.capturedAt && <div className="detail-field"><span>{t.captured}</span><strong>{formatExifDate(selectedText.capturedAt, locale)}</strong></div>}{(selectedText.cameraMake || selectedText.cameraModel) && <div className="detail-field"><span>{t.camera}</span><strong>{[selectedText.cameraMake, selectedText.cameraModel].filter(Boolean).join(" ")}</strong></div>}{selectedText.lensModel && <div className="detail-field"><span>{t.lens}</span><strong>{selectedText.lensModel}</strong></div>}{(selectedText.iso || selectedText.exposureTime || selectedText.focalLength) && <div className="detail-field"><span>{t.exposure}</span><strong>{[selectedText.iso && `ISO ${selectedText.iso}`, selectedText.exposureTime, selectedText.focalLength].filter(Boolean).join(" · ")}</strong></div>}<div className="color-heading">{t.dominantColors}</div><div className="color-chips">{selectedText.dominantColors.map((color) => <button type="button" className="color-chip" key={color.name} onClick={() => setQuery(color.name)} title={`${t.search}: ${colorLabel(color.name, locale)}`}><span style={{ backgroundColor: color.hex }} /><span>{colorLabel(color.name, locale)}</span><small>{color.share}%</small></button>)}</div>{!selectedText.cameraMake && !selectedText.cameraModel && !selectedText.capturedAt && <p className="metadata-note">{t.noExif}</p>}</> : <p>{!isDesktop ? t.metadataUnavailable : selectedText?.metadataStatus === "error" ? t.metadataError : t.metadataPending}</p>}</section>
        {selectedText?.metadataStatus === "error" && <div className="metadata-inline-error" role="note"><span>{t.metadataErrorHelp}</span>{selectedText.metadataError && <small>{selectedText.metadataError}</small>}</div>}
        <section className="collection-membership"><div className="collection-membership-title"><Archive size={14} /><strong>{t.collections}</strong></div>{captureCollectionIds.length ? <div className="collection-membership-list">{captureCollectionIds.map((id) => collections.find((collection) => collection.id === id)).filter((collection): collection is Collection => Boolean(collection)).map((collection) => <button type="button" className="collection-member-chip" key={collection.id} onClick={() => void removeSelectedFromCollection(collection.id)} title={`${t.removeFromCollection}: ${collection.name}`}><span>{collection.name}</span><X size={12} /></button>)}</div> : <p className="collection-membership-note">{t.notInCollection}</p>}{collections.some((collection) => !captureCollectionIds.includes(collection.id)) ? <div className="collection-add-row"><select value={collectionToAdd} onChange={(event) => setCollectionToAdd(event.target.value)} aria-label={t.selectCollection}><option value="">{t.selectCollection}</option>{collections.filter((collection) => !captureCollectionIds.includes(collection.id)).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><button type="button" className="subtle-button" onClick={() => void addSelectedToCollection()} disabled={!collectionToAdd}>{t.addToCollection}</button></div> : collections.length === 0 && <button type="button" className="collection-create-link" onClick={() => { navigate("collections"); startNewCollection(); }} disabled={!isDesktop}><Archive size={13} />{t.newCollection}</button>}</section></div></aside>}
      {selected && page === "collections" && activeCollection && <aside className="detail-panel"><header className="detail-header"><h2>{activeCollection.name}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label={t.closeDetails}><PanelRightClose size={17} /></button></header><div className="detail-preview">{imageUrl(selected) && <img src={imageUrl(selected)} alt={selected.name} />}<button ref={viewerOpenerRef} type="button" className="viewer-open-button" onClick={() => setViewerOpen(true)} aria-label={t.openImage} title={t.openImage}><Maximize2 size={15} /></button></div><div className="detail-content"><h3 title={selected.name}>{selected.name}</h3><span className="detail-date">{readableDate(selected.modified, locale)}</span><div className="detail-separator" /><div className="detail-field"><span>{t.location}</span><code title={displayPath(selected.path)}>{displayPath(selected.path)}</code></div>{selectedText?.metadataStatus === "ready" && <div className="detail-field"><span>{t.dimensions}</span><strong>{selectedText.width} × {selectedText.height}</strong></div>}{captureCollectionIds.includes(activeCollection.id) && <button type="button" className="subtle-button danger collection-remove-member" onClick={() => void removeSelectedFromCollection(activeCollection.id)}>{t.removeFromCollection}</button>}</div></aside>}
      {viewerOpen && selected && <div className="viewer-overlay" role="dialog" aria-modal="true" aria-label={`${t.viewer}: ${selected.name}`} onClick={(event) => { if (event.target === event.currentTarget) setViewerOpen(false); }}>
        <div className="viewer-window"><header className="viewer-toolbar"><span title={selected.name}>{selected.name}</span><button ref={viewerCloseRef} type="button" className="viewer-icon-button" onClick={() => setViewerOpen(false)} aria-label={t.closeViewer} title={t.closeViewer}><X size={18} /></button></header>
          <div className="viewer-stage"><button type="button" className="viewer-nav-button" onClick={() => viewerIndex > 0 && setSelected(viewerCaptures[viewerIndex - 1])} disabled={viewerIndex <= 0} aria-label={t.previousCapture} title={t.previousCapture}><ChevronLeft size={23} /></button>
            <div className="viewer-image-area">{viewerLoading ? <div className="viewer-message" role="status"><ScanSearch size={18} />{t.viewerLoading}</div> : viewerError ? <div className="viewer-message viewer-message-error" role="alert"><Info size={18} />{t.viewerError}</div> : viewerImage && <img src={viewerImage} alt={selected.name} draggable={false} />}</div>
            <button type="button" className="viewer-nav-button" onClick={() => viewerIndex >= 0 && viewerIndex < viewerCaptures.length - 1 && setSelected(viewerCaptures[viewerIndex + 1])} disabled={viewerIndex < 0 || viewerIndex >= viewerCaptures.length - 1} aria-label={t.nextCapture} title={t.nextCapture}><ChevronRight size={23} /></button>
          </div><footer className="viewer-footer"><span>{selected.name}</span><span>{viewerIndex >= 0 ? `${viewerIndex + 1} / ${viewerCaptures.length}` : ""}</span></footer>
        </div>
      </div>}
      {error && <div className="toast-error" role="status"><Info size={15} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss"><X size={14} /></button></div>}
    </div>
  );
}
