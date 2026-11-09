#!/usr/bin/env bash
# Install CJCRSG Presenter for one user.
#
# Layout: this script lives next to the binary in the release tarball, and in
# installer/linux/ in the repository (where the binary is found under
# target/release). PREFIX defaults to ~/.local, so no root is needed.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PREFIX=${PREFIX:-$HOME/.local}
BINARY=${BINARY:-}

if [ -z "$BINARY" ]; then
  for candidate in "$HERE/cjcrsg-presenter" "$HERE/../../target/release/cjcrsg-presenter"; do
    if [ -x "$candidate" ]; then
      BINARY=$candidate
      break
    fi
  done
fi
if [ -z "$BINARY" ] || [ ! -x "$BINARY" ]; then
  echo "cannot find cjcrsg-presenter; build it or set BINARY=/path/to/binary" >&2
  exit 1
fi

install -Dm755 "$BINARY" "$PREFIX/bin/cjcrsg-presenter"
install -Dm644 "$HERE/cjcrsg-presenter.desktop" "$PREFIX/share/applications/cjcrsg-presenter.desktop"
install -Dm644 "$HERE/cjcrsg-presenter.svg" \
  "$PREFIX/share/icons/hicolor/scalable/apps/cjcrsg-presenter.svg"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$PREFIX/share/applications" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t "$PREFIX/share/icons/hicolor" >/dev/null 2>&1 || true
fi

echo "installed to $PREFIX"
echo "  binary   $PREFIX/bin/cjcrsg-presenter"
echo "  desktop  $PREFIX/share/applications/cjcrsg-presenter.desktop"
echo "  icon     $PREFIX/share/icons/hicolor/scalable/apps/cjcrsg-presenter.svg"
echo
echo "If $PREFIX/bin is not in PATH, add it or run $PREFIX/bin/cjcrsg-presenter directly."
