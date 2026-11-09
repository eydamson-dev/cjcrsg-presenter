//! Headless subcommands. Anything that is not a subcommand launches the GUI.

use std::path::{Path, PathBuf};

use presenter_compat::{cjcp, freeshow};

pub enum Action {
    /// Launched, nothing else to do.
    Handled,
    /// Start the GUI, optionally with a project already loaded.
    Gui(Option<PathBuf>),
    /// Run only the remote control server, with no window.
    Serve(u16),
    /// Render slides to HTML and exit. Used by the visual harness.
    Render {
        project: PathBuf,
        out: PathBuf,
        layout: crate::render::Layout,
        slide: Option<usize>,
        /// `None` means "use the transition the engine published".
        transition: Option<presenter_core::Transition>,
        pause: Option<u32>,
    },
}

/// Print a line, ignoring a closed pipe: `inspect x | head` is normal, and
/// Rust's default is to panic on EPIPE.
fn out(line: impl AsRef<str>) {
    use std::io::Write;
    let _ = writeln!(std::io::stdout(), "{}", line.as_ref());
}

pub fn run(args: &[String]) -> Result<Action, String> {
    match args {
        [] => Ok(Action::Gui(None)),

        [command, rest @ ..] if command == "import" => {
            let [source, destination] = rest else {
                return Err("usage: cjcrsg-presenter import <in.show> <out.cjcp>".into());
            };
            let source = Path::new(source);
            let destination = Path::new(destination);

            let json = std::fs::read_to_string(source)
                .map_err(|error| format!("cannot read {}: {error}", source.display()))?;
            let show = freeshow::import_show(&json)
                .map_err(|error| format!("cannot import {}: {error}", source.display()))?;

            let mut project = presenter_core::Project {
                id: "imported".to_string(),
                name: show.name.clone(),
                shows: vec![show],
                ..Default::default()
            };
            project.collect_media();
            let document = cjcp::Document::new(project);
            cjcp::write(destination, &document)
                .map_err(|error| format!("cannot write {}: {error}", destination.display()))?;

            out(format!(
                "imported {} -> {} ({} shows, {} slides)",
                source.display(),
                destination.display(),
                document.project.shows.len(),
                document.project.slide_count()
            ));
            Ok(Action::Handled)
        }

        [command, rest @ ..] if command == "import-project" => {
            if rest.len() < 3 {
                return Err("usage: cjcrsg-presenter import-project \
                     <projects.json> <shows-dir> <out.cjcp> [--id PROJECT_ID]"
                    .into());
            }
            let projects = Path::new(&rest[0]);
            let shows_dir = Path::new(&rest[1]);
            let destination = Path::new(&rest[2]);

            let mut id: Option<&str> = None;
            let mut args = rest[3..].iter();
            while let Some(arg) = args.next() {
                match arg.as_str() {
                    "--id" => id = Some(args.next().ok_or("--id needs a value")?),
                    other => return Err(format!("unknown option {other:?}")),
                }
            }

            let json = std::fs::read_to_string(projects)
                .map_err(|error| format!("cannot read {}: {error}", projects.display()))?;
            let project = presenter_compat::import_project(&json, shows_dir, id)
                .map_err(|error| format!("cannot import project: {error}"))?;

            let document = presenter_compat::cjcp::Document::new(project);
            presenter_compat::cjcp::write(destination, &document)
                .map_err(|error| format!("cannot write {}: {error}", destination.display()))?;

            out(format!(
                "imported project {:?} -> {} ({} shows, {} slides)",
                document.project.name,
                destination.display(),
                document.project.shows.len(),
                document.project.slide_count()
            ));
            Ok(Action::Handled)
        }

        [command, rest @ ..] if command == "bundle" => {
            if rest.is_empty() {
                return Err("usage: cjcrsg-presenter bundle <file.cjcp>".into());
            }
            let path = Path::new(&rest[0]);
            let mut document = cjcp::read(path)
                .map_err(|error| format!("cannot read {}: {error}", path.display()))?;

            // Media travels beside the project file, so that is the root.
            let root = path
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
                .unwrap_or_else(|| Path::new("."));

            let report = presenter_core::bundle_media(&mut document.project, root);
            cjcp::write(path, &document).map_err(|error| {
                format!("cannot write {}: {error}", path.display())
            })?;

            out(format!("copied    {}", report.copied()));
            out(format!("missing   {}", report.missing.len()));
            out(format!("failed    {}", report.failed.len()));
            out(format!("unchanged {}", report.unchanged));
            for id in &report.missing {
                out(format!("  missing {id}"));
            }
            for (id, reason) in &report.failed {
                out(format!("  failed  {id}: {reason}"));
            }
            Ok(Action::Handled)
        }

        [command, rest @ ..] if command == "inspect" => {
            let [path] = rest else {
                return Err("usage: cjcrsg-presenter inspect <file.cjcp>".into());
            };
            let document = cjcp::read(Path::new(path))
                .map_err(|error| format!("cannot read {}: {error}", path))?;

            out(format!("project   {}", document.project.name));
            out(format!("format    cjcp v{}", document.format_version));
            out(format!("app       {}", document.app_version));
            out(format!("shows     {}", document.project.shows.len()));
            out(format!("slides    {}", document.project.slide_count()));
            out(format!("media     {}", document.project.media.len()));
            // Report rather than refuse: a project with a missing clip must
            // still open, and the operator needs to know which one is gone.
            let root = std::path::Path::new(path)
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
                .unwrap_or_else(|| std::path::Path::new("."));
            for asset in &document.project.media {
                out(format!(
                    "  media {} [{:?} {:?}] {}",
                    asset.id, asset.kind, asset.origin, asset.path
                ));
                if let Err(error) = asset.validate() {
                    out(format!("    ! {error}"));
                } else if !asset.resolve(root).exists() {
                    // True for an external path too: a broken reference is a
                    // broken reference, whatever its origin.
                    out(format!("    ! missing: {}", asset.path));
                }
            }
            out(format!(
                "preserved {} unknown key(s)",
                document.extensions.len()
            ));
            for show in &document.project.shows {
                out(format!("  show  {} ({})", show.name, show.id));
                for group in &show.groups {
                    out(format!(
                        "    group {} — {} slide(s)",
                        group.name,
                        group.slides.len()
                    ));
                    for slide in &group.slides {
                        let first = slide
                            .elements
                            .first()
                            .map(|element| element.text.split('\n').next().unwrap_or(""))
                            .unwrap_or("");
                        let timing = slide
                            .transition
                            .as_ref()
                            .map(|transition| {
                                format!(
                                    " [{} {}ms {}]",
                                    serde_json::to_string(&transition.kind)
                                        .unwrap()
                                        .trim_matches('"'),
                                    transition.duration_ms,
                                    transition.easing
                                )
                            })
                            .unwrap_or_default();
                        out(format!("      {} — {first:?}{timing}", slide.id));
                    }
                }
            }
            Ok(Action::Handled)
        }

        [command, rest @ ..] if command == "serve" => {
            let mut port = presenter_remote::DEFAULT_PORT;
            let mut args = rest.iter();
            while let Some(arg) = args.next() {
                match arg.as_str() {
                    "--port" => {
                        let value = args
                            .next()
                            .ok_or_else(|| "--port needs a number".to_string())?;
                        port = value
                            .parse()
                            .map_err(|_| format!("not a port: {value:?}"))?;
                    }
                    other => return Err(format!("unknown option {other:?}")),
                }
            }
            Ok(Action::Serve(port))
        }

        [command, rest @ ..] if command == "render" => {
            if rest.len() < 2 {
                return Err("usage: cjcrsg-presenter render <file.cjcp> <out.html> \
                     [--layout stage|audience] [--slide N] [--transition NAME] \
                     [--duration MS] [--easing NAME]"
                    .into());
            }
            let project = PathBuf::from(&rest[0]);
            let out = PathBuf::from(&rest[1]);
            let mut layout = crate::render::Layout::Audience;
            let mut slide = None;
            let mut transition: Option<presenter_core::Transition> = None;
            let mut pause = None;

            let mut args = rest[2..].iter();
            while let Some(arg) = args.next() {
                match arg.as_str() {
                    "--layout" => {
                        layout = match args.next().map(String::as_str) {
                            Some("stage") => crate::render::Layout::Stage,
                            Some("audience") => crate::render::Layout::Audience,
                            other => return Err(format!("unknown layout {other:?}")),
                        };
                    }
                    "--transition" => {
                        let name = args.next().ok_or("--transition needs a name")?;
                        let chosen = transition
                            .get_or_insert_with(presenter_core::Transition::default);
                        chosen.kind = presenter_core::TransitionKind::ALL
                            .into_iter()
                            .find(|kind| {
                                serde_json::to_string(kind).unwrap().trim_matches('"') == name
                            })
                            .ok_or_else(|| format!("unknown transition {name:?}"))?;
                    }
                    "--duration" => {
                        let value = args.next().ok_or("--duration needs milliseconds")?;
                        let chosen = transition
                            .get_or_insert_with(presenter_core::Transition::default);
                        chosen.duration_ms = value
                            .parse()
                            .map_err(|_| format!("not a number: {value:?}"))?;
                    }
                    "--easing" => {
                        let name = args.next().ok_or("--easing needs a name")?;
                        if !presenter_core::EASINGS.iter().any(|known| *known == name) {
                            return Err(format!(
                                "unknown easing {name:?}; expected one of {}",
                                presenter_core::EASINGS.join(", ")
                            ));
                        }
                        let chosen = transition
                            .get_or_insert_with(presenter_core::Transition::default);
                        chosen.easing = name.to_string();
                    }
                    "--pause" => {
                        let value = args.next().ok_or("--pause needs milliseconds")?;
                        pause = Some(
                            value
                                .parse()
                                .map_err(|_| format!("not a number: {value:?}"))?,
                        );
                    }
                    "--slide" => {
                        let value = args.next().ok_or("--slide needs a number")?;
                        slide = Some(
                            value
                                .parse()
                                .map_err(|_| format!("not a number: {value:?}"))?,
                        );
                    }
                    other => return Err(format!("unknown option {other:?}")),
                }
            }

            Ok(Action::Render {
                project,
                out,
                layout,
                slide,
                transition,
                pause,
            })
        }

        [path] if path.ends_with(".cjcp") => Ok(Action::Gui(Some(PathBuf::from(path)))),

        [command, ..] => Err(format!(
            "unknown command {command:?}\n\
             usage:\n  \
             cjcrsg-presenter                 launch the app\n  \
             cjcrsg-presenter <file.cjcp>     launch with a project\n  \
             cjcrsg-presenter import <in.show> <out.cjcp>\n  \
             cjcrsg-presenter inspect <file.cjcp>\n  \
             cjcrsg-presenter import-project <projects.json> <shows-dir> <out.cjcp> [--id ID]\n  \
             cjcrsg-presenter bundle <file.cjcp>  copy external media into <dir>/media\n  \
             cjcrsg-presenter serve [--port N]   headless remote server\n  \
             cjcrsg-presenter render <in.cjcp> <out.html> [--layout stage|audience] [--slide N] \\n  \
             [--transition NAME] [--duration MS] [--easing NAME]"
        )),
    }
}
