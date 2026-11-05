#!/usr/bin/env bash
set -euo pipefail

# Publishes one workspace package unless npm already has its version.
# Usage: ./scripts/publish-if-new.sh @idioma/core
#
# The Publish workflow runs it for each package, so re-running a failed
# publish only publishes the packages that are still missing.

NAME="$1"
VERSION=$(pnpm --filter "$NAME" exec node -p "require('./package.json').version")

if npm view "$NAME@$VERSION" version >/dev/null 2>&1; then
  echo "$NAME@$VERSION is already on npm: skipping"
  exit 0
fi

pnpm --filter "$NAME" publish --no-git-checks --provenance --access public
