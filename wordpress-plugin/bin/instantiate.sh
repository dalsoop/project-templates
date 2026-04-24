#!/usr/bin/env bash
# Generate a new WordPress plugin from this template.
#
# Usage:
#   ./bin/instantiate.sh --name "SEO for Korean" --target ../seo-for-korean --author "Your Name" --vendor dalsoop
#
# Required:
#   --name "Plugin Display Name"
#   --target /path/to/new/plugin
#
# Optional (auto-derived from --name if omitted):
#   --slug seo-for-korean
#   --prefix sfk
#   --namespace SEOForKorean
#   --const SFK
#
# Other optional:
#   --description "..."
#   --author "Your Name"
#   --author-uri https://...
#   --plugin-uri https://...
#   --vendor composer-vendor
#   --version 0.1.0
#   --min-php 8.0
#   --min-wp 6.0

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMPLATE_DIR=$(cd "$SCRIPT_DIR/../template" && pwd)

PLUGIN_NAME=""
TARGET_DIR=""
PLUGIN_SLUG=""
PLUGIN_PREFIX=""
PLUGIN_NAMESPACE=""
PLUGIN_CONST=""
PLUGIN_DESCRIPTION="A WordPress plugin."
AUTHOR_NAME="Your Name"
AUTHOR_URI="https://example.com"
PLUGIN_URI=""
COMPOSER_VENDOR="vendor"
PLUGIN_VERSION="0.1.0"
MIN_PHP="8.0"
MIN_WP="6.0"

usage() {
	sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
	exit 1
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--name)         PLUGIN_NAME="$2"; shift 2 ;;
		--target)       TARGET_DIR="$2"; shift 2 ;;
		--slug)         PLUGIN_SLUG="$2"; shift 2 ;;
		--prefix)       PLUGIN_PREFIX="$2"; shift 2 ;;
		--namespace)    PLUGIN_NAMESPACE="$2"; shift 2 ;;
		--const)        PLUGIN_CONST="$2"; shift 2 ;;
		--description)  PLUGIN_DESCRIPTION="$2"; shift 2 ;;
		--author)       AUTHOR_NAME="$2"; shift 2 ;;
		--author-uri)   AUTHOR_URI="$2"; shift 2 ;;
		--plugin-uri)   PLUGIN_URI="$2"; shift 2 ;;
		--vendor)       COMPOSER_VENDOR="$2"; shift 2 ;;
		--version)      PLUGIN_VERSION="$2"; shift 2 ;;
		--min-php)      MIN_PHP="$2"; shift 2 ;;
		--min-wp)       MIN_WP="$2"; shift 2 ;;
		-h|--help)      usage ;;
		*)              echo "Unknown arg: $1" >&2; usage ;;
	esac
done

[[ -z "$PLUGIN_NAME" ]] && { echo "ERROR: --name is required" >&2; usage; }
[[ -z "$TARGET_DIR" ]] && { echo "ERROR: --target is required" >&2; usage; }
[[ -e "$TARGET_DIR" ]] && { echo "ERROR: target already exists: $TARGET_DIR" >&2; exit 1; }

# Derive slug: "SEO for Korean" -> "seo-for-korean"
if [[ -z "$PLUGIN_SLUG" ]]; then
	PLUGIN_SLUG=$(echo "$PLUGIN_NAME" \
		| tr '[:upper:]' '[:lower:]' \
		| sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
fi

# Derive prefix: "seo-for-korean" -> "sfk" (first letter of each word, max 4)
if [[ -z "$PLUGIN_PREFIX" ]]; then
	PLUGIN_PREFIX=$(echo "$PLUGIN_SLUG" \
		| awk -F- '{ for (i=1; i<=NF && i<=4; i++) printf "%s", substr($i, 1, 1) }')
fi

# Derive namespace: "SEO for Korean" -> "SEOForKorean"
if [[ -z "$PLUGIN_NAMESPACE" ]]; then
	PLUGIN_NAMESPACE=$(echo "$PLUGIN_NAME" \
		| sed -E 's/[^A-Za-z0-9 ]+//g' \
		| awk '{ for (i=1; i<=NF; i++) { word = $i; first = toupper(substr(word, 1, 1)); rest = substr(word, 2); printf "%s%s", first, rest } }')
fi

# Derive const: prefix uppercased
if [[ -z "$PLUGIN_CONST" ]]; then
	PLUGIN_CONST=$(echo "$PLUGIN_PREFIX" | tr '[:lower:]' '[:upper:]')
fi

[[ -z "$PLUGIN_URI" ]] && PLUGIN_URI="$AUTHOR_URI/$PLUGIN_SLUG"

YEAR=$(date +%Y)

cat <<EOF
Generating WordPress plugin:
  Name:        $PLUGIN_NAME
  Slug:        $PLUGIN_SLUG
  Prefix:      $PLUGIN_PREFIX
  Namespace:   $PLUGIN_NAMESPACE
  Const:       $PLUGIN_CONST
  Vendor:      $COMPOSER_VENDOR
  Version:     $PLUGIN_VERSION
  Min PHP/WP:  $MIN_PHP / $MIN_WP
  Target:      $TARGET_DIR
EOF

cp -r "$TEMPLATE_DIR" "$TARGET_DIR"

# Cross-platform in-place sed (BSD on macOS needs an empty arg after -i).
sed_inplace() {
	if sed --version >/dev/null 2>&1; then
		sed -i "$@"
	else
		sed -i '' "$@"
	fi
}

# Substitute placeholders across every regular file (skip binary safety nets).
find "$TARGET_DIR" -type f -print0 | while IFS= read -r -d '' file; do
	sed_inplace \
		-e "s|{{PLUGIN_NAME}}|$PLUGIN_NAME|g" \
		-e "s|{{PLUGIN_SLUG}}|$PLUGIN_SLUG|g" \
		-e "s|{{PLUGIN_PREFIX}}|$PLUGIN_PREFIX|g" \
		-e "s|{{PLUGIN_NAMESPACE}}|$PLUGIN_NAMESPACE|g" \
		-e "s|{{PLUGIN_CONST}}|$PLUGIN_CONST|g" \
		-e "s|{{PLUGIN_DESCRIPTION}}|$PLUGIN_DESCRIPTION|g" \
		-e "s|{{PLUGIN_VERSION}}|$PLUGIN_VERSION|g" \
		-e "s|{{AUTHOR_NAME}}|$AUTHOR_NAME|g" \
		-e "s|{{AUTHOR_URI}}|$AUTHOR_URI|g" \
		-e "s|{{PLUGIN_URI}}|$PLUGIN_URI|g" \
		-e "s|{{COMPOSER_VENDOR}}|$COMPOSER_VENDOR|g" \
		-e "s|{{MIN_PHP}}|$MIN_PHP|g" \
		-e "s|{{MIN_WP}}|$MIN_WP|g" \
		-e "s|{{YEAR}}|$YEAR|g" \
		"$file"
done

# Rename main plugin file.
mv "$TARGET_DIR/{{PLUGIN_SLUG}}.php" "$TARGET_DIR/$PLUGIN_SLUG.php"

# Initialize git repo.
( cd "$TARGET_DIR" && git init -q && git add -A && git commit -q -m "chore: scaffold $PLUGIN_NAME from wp-plugin-template" )

cat <<EOF

✓ Plugin generated at: $TARGET_DIR

Next:
  cd $TARGET_DIR
  composer install
  npm install
  npm run build

Then symlink or copy into wp-content/plugins/ to test.
EOF
