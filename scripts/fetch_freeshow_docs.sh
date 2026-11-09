#!/usr/bin/env bash
# Mirror FreeShow's online documentation into docs/freeshow-reference/source/.
#
# The docs are Markdown in ChurchApps/FreeShowWeb, under src/routes/docs. The
# rendered site at freeshow.app is generated from those files, so the Markdown is
# the closer source. This script keeps the upstream directory structure and
# records the commit it fetched, so a page can always be traced back.
#
# It uses a codeload tarball rather than the GitHub API, because the API is rate
# limited to 60 requests an hour per IP and the mirror is a single call here.
#
# Usage: scripts/fetch_freeshow_docs.sh [ref]
#   ref defaults to main.
set -euo pipefail

ref="${1:-main}"
repo="ChurchApps/FreeShowWeb"
url="https://github.com/$repo"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/docs/freeshow-reference/source"

# Resolve the ref to a commit so the recorded provenance is exact. ls-remote is
# part of git, not the REST API, so it is not rate limited.
commit="$(git ls-remote "$url" "refs/heads/$ref" | cut -f1)"
if [ -z "$commit" ]; then
    echo "could not resolve $repo $ref" >&2
    exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "https://codeload.github.com/$repo/tar.gz/$commit" | tar -xz -C "$tmp" --strip-components=1 \
    --wildcards '*/src/routes/docs/*' '*/src/routes/api/*' '*/static/images/docs/*'

rm -rf "$out"
mkdir -p "$out"

count=0
while IFS= read -r file; do
    case "$file" in
        src/routes/docs/*) rel="${file#src/routes/docs/}" ;;
        src/routes/api/*) rel="${file#src/routes/}" ;;
        *) continue ;;
    esac
    rel="${rel/\/+page.md/.md}"
    rel="${rel/\/+page.svelte/.svelte}"
    rel="${rel/\/+layout.svelte//_nav.svelte}"
    # The docs root has bare +page.svelte / +layout.svelte.
    [ "$rel" = "+layout.svelte" ] && rel="_nav.svelte"
    [ "$rel" = "+page.svelte" ] && rel="index.svelte"
    mkdir -p "$out/docs/$(dirname "$rel")"
    cp "$tmp/$file" "$out/docs/$rel"
    count=$((count + 1))
done < <(cd "$tmp" && find src/routes/docs src/routes/api -type f \( -name '*.md' -o -name '*.svelte' \) | sort)

# The Markdown links images by site path (/images/docs/...), so mirror those too.
imgcount=0
if [ -d "$tmp/static/images/docs" ]; then
    mkdir -p "$out/static/images/docs"
    find "$tmp/static/images/docs" -type f -exec cp {} "$out/static/images/docs/" \;
    imgcount="$(find "$out/static/images/docs" -type f | wc -l)"
fi

{
    echo "# FreeShow documentation source"
    echo
    echo "Mirrored from https://github.com/$repo at commit \`$commit\` (ref \`$ref\`)."
    echo "Fetched $(date -u +%Y-%m-%dT%H:%M:%SZ) by \`scripts/fetch_freeshow_docs.sh\`."
    echo
    echo "Layout:"
    echo
    echo "- \`docs/\` mirrors \`src/routes/docs\`: \`+page.md\` becomes \`<dir>.md\`,"
    echo "  and \`+layout.svelte\` becomes \`docs/_nav.svelte\`."
    echo "- \`docs/api.svelte\` is the API page (\`src/routes/api/+page.svelte\`)."
    echo "- \`static/images/docs/\` holds the images the Markdown links."
    echo
    echo "Do not edit these files: they are upstream text. Write findings in the"
    echo "pages next to this directory instead, and cite \`source/docs/<page>.md\`."
    echo
    echo "Files: $count markdown/page files, $imgcount images."
} > "$out/README.md"

echo "Mirrored $count files and $imgcount images from $repo@$commit into ${out#"$root"/}"
