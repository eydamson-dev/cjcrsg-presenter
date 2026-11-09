#!/usr/bin/env bash
# Capture one native window by title on XWayland.
#
# The app must be running with GDK_BACKEND=x11 so it owns an X window; Wayland
# gives no window-targeted capture. Then:
#
#   GDK_BACKEND=x11 ./target/debug/cjcrsg-presenter &
#   scripts/capture_window.sh CJCRSG controller.png
#
# Usage: capture_window.sh <title-substring> <out.png>
set -euo pipefail

title=${1:?usage: capture_window.sh <title-substring> <out.png>}
out=${2:?usage: capture_window.sh <title-substring> <out.png>}

if [ -z "${DISPLAY:-}" ]; then
  echo "DISPLAY is not set; this needs an X session or XWayland" >&2
  exit 1
fi

for id in $(xprop -root _NET_CLIENT_LIST 2>/dev/null | grep -oE '0x[0-9a-f]+'); do
  name=$(xprop -id "$id" WM_NAME 2>/dev/null | sed 's/.*= //')
  case "$name" in
    *"$title"*)
      import -window "$id" "$out"
      echo "captured $name -> $out"
      exit 0
      ;;
  esac
done

echo "no window matching $title" >&2
exit 1
