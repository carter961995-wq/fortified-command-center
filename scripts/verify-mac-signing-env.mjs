import signingEnv from "./desktop-signing-env.cjs";

signingEnv.loadDesktopEnv();

const { hasNotarizationCredentials, hasSigningIdentity, missingCertificatePassword } =
  signingEnv.getMacSigningStatus();

if (!hasNotarizationCredentials || !hasSigningIdentity || missingCertificatePassword) {
  const missing = [
    ...(hasNotarizationCredentials
      ? []
      : [
          "APPLE_ID + (APPLE_APP_SPECIFIC_PASSWORD or APPLE_ID_PASSWORD) + APPLE_TEAM_ID or " +
            "APPLE_API_KEY + APPLE_API_KEY_ID + (APPLE_API_ISSUER or APPLE_API_ISSUER_ID)",
        ]),
    ...(hasSigningIdentity ? [] : ["CSC_LINK or CSC_NAME"]),
    ...(missingCertificatePassword ? ["CSC_KEY_PASSWORD"] : []),
  ];

  console.error("Mac desktop signing is not configured.");
  console.error(`Missing: ${missing.join(", ")}`);
  console.error("");
  console.error(
    "Configure a Developer ID Application certificate for electron-builder and Apple notarization credentials before publishing Mac downloads.",
  );
  process.exit(1);
}

console.log("Mac desktop signing and notarization environment is configured.");
