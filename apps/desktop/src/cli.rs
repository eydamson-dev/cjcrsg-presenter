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
        transition: presenter_core::TransitionKind,
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

            let project = presenter_core::Project {
                id: "imported".to_string(),
                name: show.name.clone(),
                shows: vec![show],
                ..Default::default()
            };
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
                        out(format!("      {} — {first:?}", slide.id));
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
                     [--layout stage|audience] [--slide N]"
                    .into());
            }
            let project = PathBuf::from(&rest[0]);
            let out = PathBuf::from(&rest[1]);
            let mut layout = crate::render::Layout::Audience;
            let mut slide = None;
            let mut transition = presenter_core::TransitionKind::None;
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
                        transition = presenter_core::TransitionKind::ALL
                            .into_iter()
                            .find(|kind| {
                                serde_json::to_string(kind).unwrap().trim_matches('"') == name
                            })
                            .ok_or_else(|| format!("unknown transition {name:?}"))?;
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
             cjcrsg-presenter serve [--port N]   headless remote server\n  \
             cjcrsg-presenter render <in.cjcp> <out.html> [--layout stage|audience] [--slide N]"
        )),
    }
}
