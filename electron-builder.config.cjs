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
  files: ["electron/**/*"],
  extraResources: [
    {
      from: ".next/standalone",
      to: "app",
    },
  ],
  mac: {
    category: "public.app-category.business",
    target: ["dmg", "zip"],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "electron/entitlements.mac.plist",
    entitlementsInherit: "electron/entitlements.mac.plist",
  },
};
