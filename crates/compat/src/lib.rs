//! Reading things that are not ours, and writing things that are.
//!
//! Two directions, deliberately separate:
//!
//! - [`freeshow`] turns a FreeShow `.show` file into the domain model. Read-only.
//! - [`project`] joins `projects.json` with the shows folder to import a whole
//!   FreeShow project.
//! - [`cjcp`] is the native project format: versioned envelope, unknown fields
//!   preserved. See `docs/file-format.md`.

#![forbid(unsafe_code)]

pub mod cjcp;
pub mod freeshow;
pub mod project;

pub use cjcp::{Document, FormatError, SUPPORTED_VERSION};
pub use freeshow::{import_show, ImportError};
pub use project::{import_project, ProjectImportError};
