#!/usr/bin/env bash
set -euo pipefail

# GitHub's Azure Ubuntu mirror failed DNS resolution in both main and PR runs.
# Use the canonical mirror for the same signed Ubuntu repositories; leave all
# security/third-party sources, suites, components and signing keys intact.
apt_root="${1:-/etc/apt}"
while IFS= read -r -d '' source_file; do
  sed -i 's|://azure\.archive\.ubuntu\.com/|://archive.ubuntu.com/|g' "$source_file"
done < <(find "$apt_root" -maxdepth 2 -type f \( -name sources.list -o -name '*.list' -o -name '*.sources' \) -print0)
