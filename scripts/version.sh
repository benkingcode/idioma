#!/usr/bin/env bash
set -euo pipefail

# Lockstep version bumping for @idioma/core and @idioma/react.
# Usage:
#   ./scripts/version.sh patch          # 0.1.12 → 0.1.13
#   ./scripts/version.sh minor          # 0.1.12 → 0.2.0
#   ./scripts/version.sh major          # 0.1.12 → 1.0.0
#   ./scripts/version.sh 0.2.0          # explicit version

if [ $# -eq 0 ]; then
  echo "Usage: $0 <patch|minor|major|x.y.z>"
  exit 1
fi

VERSION="$1"

# If argument is patch/minor/major, compute the next version
if [[ "$VERSION" =~ ^(patch|minor|major)$ ]]; then
  CURRENT=$(node -p "require('./packages/core/package.json').version")
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$VERSION" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  esac
  VERSION="$MAJOR.$MINOR.$PATCH"
fi

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Invalid version '$VERSION'. Use semver (e.g., 0.1.13) or patch|minor|major"
  exit 1
fi

echo "Bumping to v$VERSION..."

# Update both package.json files
node -e "
  const fs = require('fs');
  for (const pkg of ['packages/core/package.json', 'packages/react/package.json']) {
    const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
    json.version = '$VERSION';
    fs.writeFileSync(pkg, JSON.stringify(json, null, 2) + '\n');
  }
"

# Stage, commit, and tag
git add packages/core/package.json packages/react/package.json
git commit -m "chore: bump to v$VERSION"
git tag "v$VERSION"

echo ""
echo "Done! Version bumped to v$VERSION"
echo "  - packages/core/package.json  → $VERSION"
echo "  - packages/react/package.json → $VERSION"
echo "  - Git commit created"
echo "  - Git tag v$VERSION created"
echo ""
echo "To publish, push with tags:"
echo "  git push && git push --tags"
