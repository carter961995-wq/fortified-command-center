const requireMacSigning = process.env.REQUIRE_MAC_SIGNING === "true";
const allowUnsignedMac = process.env.ELECTRON_BUILDER_ALLOW_UNSIGNED_MAC === "1";
const hasNotarizationCredentials = Boolean(
  process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID,
);

if (requireMacSigning && !hasNotarizationCredentials) {
  throw new Error(
    "REQUIRE_MAC_SIGNING=true requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID for notarization.",
  );
}

if (requireMacSigning && !allowUnsignedMac && !process.env.CSC_LINK && !process.env.CSC_NAME) {
  throw new Error(
    "REQUIRE_MAC_SIGNING=true requires CSC_LINK or CSC_NAME so electron-builder can sign with a Developer ID Application certificate.",
  );
}

if (requireMacSigning && process.env.CSC_LINK && !process.env.CSC_KEY_PASSWORD) {
  throw new Error("REQUIRE_MAC_SIGNING=true requires CSC_KEY_PASSWORD when CSC_LINK is provided.");
}

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "com.fortifiedfence.commandcenter",
  productName: "Fortified Command Center",
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
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
    notarize: hasNotarizationCredentials
      ? {
          teamId: process.env.APPLE_TEAM_ID,
        }
      : false,
  },
};
