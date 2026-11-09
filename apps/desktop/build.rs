//! Embed the Windows application manifest.
//!
//! DPI awareness is decided at process start, before any Rust code runs, so it
//! cannot be a runtime setting: it has to be in the executable's manifest. Only
//! compiled when the *target* is Windows, so Linux builds and tests are
//! unaffected.

fn main() {
    println!("cargo:rerun-if-changed=../../installer/app.manifest");
    println!("cargo:rerun-if-changed=../../installer/app.rc");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let _ = embed_resource::compile("../../installer/app.rc", embed_resource::NONE);
    }
}
