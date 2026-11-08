//! Reading things that are not ours, and writing things that are.
//!
//! Two directions, deliberately separate:
//!
//! - [`freeshow`] turns a FreeShow `.show` file into the domain model. Read-only.
//! - [`cjcp`] is the native project format: versioned envelope, unknown fields
//!   preserved. See `docs/file-format.md`.

#![forbid(unsafe_code)]

pub mod cjcp;
pub mod freeshow;

pub use cjcp::{Document, FormatError, SUPPORTED_VERSION};
pub use freeshow::{import_show, ImportError};
