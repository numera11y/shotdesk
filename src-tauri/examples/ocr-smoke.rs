use rapidocr_core::{
    config::{InferenceOptions, PipelineConfig},
    model::{model_set_by_name, ModelCache, ModelDownloadMode},
    RapidOcr,
};
use std::{env, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = env::args_os().skip(1);
    let image = args
        .next()
        .map(PathBuf::from)
        .ok_or("Pass a local image path")?;
    let model_dir = args
        .next()
        .map(PathBuf::from)
        .ok_or("Pass a writable local model-cache path")?;
    let intra_threads = args
        .next()
        .and_then(|value| value.to_string_lossy().parse().ok())
        .unwrap_or(2);
    let model_set = model_set_by_name("ppocrv6-small").ok_or("PP-OCRv6 small model set missing")?;
    let cache = ModelCache::new(model_dir);
    let pipeline = PipelineConfig::without_cls();
    cache.ensure_model_set_for_pipeline(model_set, pipeline, ModelDownloadMode::Missing)?;
    let config = cache
        .config_for(model_set)
        .with_pipeline(pipeline)
        .with_inference_options(InferenceOptions {
            intra_threads,
            inter_threads: 1,
            parallel_execution: false,
            ..InferenceOptions::default()
        });
    let mut engine = RapidOcr::new(config)?;
    let output = engine.run_path_timed(image)?;
    eprintln!("OCR timings: {:?}", output.timings);
    for line in output.output.lines {
        println!("{:.3}\t{}", line.score, line.text);
    }
    Ok(())
}
