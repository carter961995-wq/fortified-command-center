#!/usr/bin/env bash
# Prepare Mac desktop artifacts that Codemagic can expose as direct downloads.
# Codemagic only lists certain extensions as standalone artifacts (zip, app, pkg, ...).
# A bare .dmg is wrapped into "{project}_{version}_artifacts.zip", which is easy to
# mistake for a broken Mac build.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist-desktop"
INSTRUCTIONS="${OUT_DIR}/HOW_TO_OPEN_MAC_BUILD.txt"

if [ ! -d "${OUT_DIR}" ]; then
  echo "Missing ${OUT_DIR}. Run the desktop build first."
  exit 1
fi

shopt -s nullglob
apps=("${OUT_DIR}"/mac*/"Fortified Command Center.app" "${OUT_DIR}/mac/Fortified Command Center.app")
dmgs=("${OUT_DIR}"/*.dmg)
zips=("${OUT_DIR}"/*.zip)

app_path=""
for candidate in "${apps[@]}"; do
  if [ -d "${candidate}" ]; then
    app_path="${candidate}"
    break
  fi
done

if [ -z "${app_path}" ]; then
  echo "No Fortified Command Center.app bundle found under ${OUT_DIR}."
  ls -laR "${OUT_DIR}" || true
  exit 1
fi

# Copy the .app to a top-level publish path so Codemagic can pick it up with a
# simple *.app pattern (nested mac-arm64/ paths are easy to miss).
publish_app="${OUT_DIR}/Fortified Command Center.app"
rm -rf "${publish_app}"
if command -v ditto >/dev/null 2>&1; then
  ditto "${app_path}" "${publish_app}"
else
  cp -R "${app_path}" "${publish_app}"
fi
echo "Published app bundle for Codemagic: ${publish_app}"

# Ensure there is a first-class .zip Codemagic can list separately from the
# generic artifacts archive. electron-builder usually creates one when target
# includes "zip"; if not, create it from the .app bundle.
if [ "${#zips[@]}" -eq 0 ]; then
  version="$(node -p "require('${ROOT_DIR}/package.json').version")"
  zip_name="Fortified Command Center-${version}-mac-arm64.zip"
  # Prefer arch from the app parent folder when present (mac, mac-arm64, mac-x64).
  parent="$(basename "$(dirname "${app_path}")")"
  case "${parent}" in
    mac-arm64) zip_name="Fortified Command Center-${version}-mac-arm64.zip" ;;
    mac-x64) zip_name="Fortified Command Center-${version}-mac-x64.zip" ;;
    mac) zip_name="Fortified Command Center-${version}-mac.zip" ;;
  esac

  echo "Creating Codemagic-friendly Mac zip: ${zip_name}"
  if command -v ditto >/dev/null 2>&1; then
    (
      cd "${OUT_DIR}"
      ditto -c -k --sequesterRsrc --keepParent "Fortified Command Center.app" "${OUT_DIR}/${zip_name}"
    )
  else
    (
      cd "${OUT_DIR}"
      zip -qry "${zip_name}" "Fortified Command Center.app"
    )
  fi
  zips=("${OUT_DIR}"/*.zip)
fi

cat > "${INSTRUCTIONS}" <<'EOF'
Fortified Command Center — Mac download

Codemagic wraps unsupported artifact types (including .dmg) into a file named like:
  fortified-command-center_*_artifacts.zip

What to download
1. Prefer the standalone file ending in .zip that contains the .app
   (for example: Fortified Command Center-0.1.0-mac-arm64.zip)
2. Or download the .app artifact if Codemagic lists it separately.
3. The generic "*_artifacts.zip" may contain a .dmg inside — unzip it first.

How to install / open
1. Double-click the .zip to extract "Fortified Command Center.app"
   OR open the .dmg and drag the app to Applications.
2. If macOS says the app cannot be opened (unsigned/unnotarized build):
   - Finder → right-click the app → Open → Open
   - Or: System Settings → Privacy & Security → Open Anyway
3. Do not expect the outer Codemagic "*_artifacts.zip" itself to launch as an app.

Use the Codemagic workflow named "Fortified Command Center Mac Download".
The "Fortified Command Center Web Build" artifacts are not a Mac app.
EOF

echo "Mac artifact summary:"
ls -lh "${OUT_DIR}"/*.dmg "${OUT_DIR}"/*.zip 2>/dev/null || true
echo "App bundle: ${app_path}"
echo "Wrote ${INSTRUCTIONS}"
