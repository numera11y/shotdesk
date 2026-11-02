# Third-party notices

## EXIF metadata parser

ShotDesk uses [`kamadak-exif`](https://crates.io/crates/kamadak-exif) 0.6.1 to read image EXIF metadata. The crate is licensed under BSD-2-Clause. ShotDesk stores selected camera and exposure fields locally and does not store GPS coordinates.

## RapidOCR Rust core

ShotDesk integrates [`rapidocr-core`](https://crates.io/crates/rapidocr-core), a Rust implementation of the RapidOCR-style PP-OCR pipeline, licensed under Apache-2.0. Its [`ort`](https://crates.io/crates/ort) Rust wrapper is MIT OR Apache-2.0; the ONNX Runtime native library is MIT-licensed by Microsoft.

## PP-OCRv6 small model assets

ShotDesk offers the PP-OCRv6 small detector, recognizer, and dictionary from the RapidOCR model registry. Assets are downloaded only after the user enables OCR, verified against the registry's SHA-256 values, and stored in the app's local data directory. The OCR models derive from PaddleOCR and are distributed under Apache-2.0; copyright and model-weight ownership remain with PaddleOCR/Baidu and the relevant rights holders. RapidOCR does not claim ownership of those weights.

Upstream references:

- [RapidOCR source and model registry](https://github.com/RapidAI/RapidOCR)
- [RapidOCR model licenses and redistribution notes](https://rapidai.github.io/RapidOCRDocs/main/model_licenses/)
- [PaddleOCR source and license](https://github.com/PaddlePaddle/PaddleOCR)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
