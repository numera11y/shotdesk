export type Capture = {
  id: number;
  path: string;
  name: string;
  extension: string;
  size: number;
  modified: number;
  ocrStatus: "pending" | "ready" | "empty" | "error" | "unavailable";
  metadataStatus: "pending" | "ready" | "error" | "unavailable";
  width: number;
  height: number;
  dominantColors: DominantColor[];
};

export type DominantColor = {
  name: string;
  hex: string;
  share: number;
};

export type CaptureDetails = {
  status: "pending" | "ready" | "empty" | "error";
  text: string;
  error: string | null;
  metadataStatus: "pending" | "ready" | "error";
  metadataError: string | null;
  width: number;
  height: number;
  capturedAt: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  iso: string | null;
  exposureTime: string | null;
  focalLength: string | null;
  dominantColors: DominantColor[];
  dpiX: number | null;
  dpiY: number | null;
};

export type OcrStatus = {
  modelsReady: boolean;
  pending: number;
  failed: number;
};

export type WatchedFolder = {
  path: string;
  added: number;
};

export type Collection = {
  id: number;
  name: string;
  description: string;
  created: number;
  captureCount: number;
};

export type IndexProgress = {
  running: boolean;
  currentFolder: string | null;
  stage: "idle" | "files" | "metadata" | "models" | "ocr" | "awaiting-models" | "error";
  discovered: number;
  indexed: number;
  skipped: number;
  failed: number;
  metadataDone: number;
  metadataTotal: number;
  message: string | null;
};

export const emptyProgress: IndexProgress = {
  running: false,
  currentFolder: null,
  stage: "idle",
  discovered: 0,
  indexed: 0,
  skipped: 0,
  failed: 0,
  metadataDone: 0,
  metadataTotal: 0,
  message: null,
};
