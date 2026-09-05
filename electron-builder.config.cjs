const {
  getMacSigningStatus,
  loadDesktopEnv,
  normalizeDesktopSigningEnv,
  present,
} = require("./scripts/desktop-signing-env.cjs");

loadDesktopEnv();
normalizeDesktopSigningEnv();

const requireMacSigning = process.env.REQUIRE_MAC_SIGNING === "true";
const allowUnsignedMac = process.env.ELECTRON_BUILDER_ALLOW_UNSIGNED_MAC === "1";
const { hasNotarizationCredentials } = getMacSigningStatus();

if (requireMacSigning && !hasNotarizationCredentials) {
  throw new Error(
    "REQUIRE_MAC_SIGNING=true requires Apple ID credentials (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD or APPLE_ID_PASSWORD, APPLE_TEAM_ID) " +
      "or App Store Connect API credentials (APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER or APPLE_API_ISSUER_ID) for notarization.",
  );
}

if (
  requireMacSigning &&
  !allowUnsignedMac &&
  !present(process.env.CSC_LINK) &&
  !present(process.env.CSC_NAME)
) {
  throw new Error(
    "REQUIRE_MAC_SIGNING=true requires CSC_LINK or CSC_NAME so electron-builder can sign with a Developer ID Application certificate.",
  );
}

if (requireMacSigning && present(process.env.CSC_LINK) && !present(process.env.CSC_KEY_PASSWORD)) {
  throw new Error("REQUIRE_MAC_SIGNING=true requires CSC_KEY_PASSWORD when CSC_LINK is provided.");
}

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "com.fortifiedfence.commandcenter",
  productName: "Fortified Command Center",
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  afterSign: "scripts/notarize-mac.cjs",
  directories: {
    output: "dist-desktop",
  },
  afterPack: "scripts/ensure-packaged-standalone.cjs",
  files: ["electron/**/*"],
  extraResources: [
    {
      from: ".next/standalone",
      to: "app",
      filter: ["**/*", "!node_modules", "!node_modules/**", "!**/*.map"],
    },
    // electron-builder's extraResources filter drops a top-level node_modules
    // folder. Copy it as its own fileset so the packaged Next server can start.
    {
      from: ".next/standalone/node_modules",
      to: "app/node_modules",
    },
  ],
  mac: {
    category: "public.app-category.business",
    // Publish both formats:
    // - dmg: normal Mac installer disk image
    // - zip: first-class Codemagic download (Codemagic wraps bare .dmg into *_artifacts.zip)
    target: ["dmg", "zip"],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "electron/entitlements.mac.plist",
    entitlementsInherit: "electron/entitlements.mac.plist",
  },
  win: {
    // Built on Codemagic windows_x2 (or a Windows PC). NSIS is the installer.
    // Codemagic does not list .exe as a standalone artifact (it wraps it into
    // *_artifacts.zip), so prepare-windows-codemagic-artifacts.mjs zips the
    // installer for the first-class download.
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Fortified Command Center",
    uninstallDisplayName: "Fortified Command Center",
    include: require("path").join(__dirname, "electron/installer.nsh"),
  },
};
