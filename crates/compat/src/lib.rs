//! Reading things that are not ours, and writing things that are.
//!
//! Two directions, deliberately separate:
//!
//! - [`freeshow`] turns a FreeShow `.show` file into the domain model. Read-only.
//! - [`project`] joins `projects.json` with the shows folder to import a whole
//!   FreeShow project.
//! - [`documents`] rasterises PDFs and office documents into image slides,
//!   using the external tools the machine already has.
//! - [`cjcp`] is the native project format: versioned envelope, unknown fields
//!   preserved. See `docs/file-format.md`.

#![forbid(unsafe_code)]

pub mod cjcp;
pub mod documents;
pub mod freeshow;
pub mod project;
pub mod store;

pub use cjcp::{Document, FormatError, SUPPORTED_VERSION};
pub use documents::{import_deck, import_pdf, ImportOptions};
pub use freeshow::{import_show, ImportError};
pub use project::{import_project, project_list, ProjectImportError, ProjectSummary};
pub use store::{import_store, StoreError, StoreReport};
