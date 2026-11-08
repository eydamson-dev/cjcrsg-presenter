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
    },
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

            println!(
                "imported {} -> {} ({} shows, {} slides)",
                source.display(),
                destination.display(),
                document.project.shows.len(),
                document.project.slide_count()
            );
            Ok(Action::Handled)
        }

        [command, rest @ ..] if command == "inspect" => {
            let [path] = rest else {
                return Err("usage: cjcrsg-presenter inspect <file.cjcp>".into());
            };
            let document = cjcp::read(Path::new(path))
                .map_err(|error| format!("cannot read {}: {error}", path))?;

            println!("project   {}", document.project.name);
            println!("format    cjcp v{}", document.format_version);
            println!("app       {}", document.app_version);
            println!("shows     {}", document.project.shows.len());
            println!("slides    {}", document.project.slide_count());
            println!("preserved {} unknown key(s)", document.extensions.len());
            for show in &document.project.shows {
                println!("  show  {} ({})", show.name, show.id);
                for group in &show.groups {
                    println!("    group {} — {} slide(s)", group.name, group.slides.len());
                    for slide in &group.slides {
                        let first = slide
                            .elements
                            .first()
                            .map(|element| element.text.split('\n').next().unwrap_or(""))
                            .unwrap_or("");
                        println!("      {} — {:?}", slide.id, first);
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
             cjcrsg-presenter serve [--port N]   headless remote server\n  \
             cjcrsg-presenter render <in.cjcp> <out.html> [--layout stage|audience] [--slide N]"
        )),
    }
}
