function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const appleIdNotarizationVars = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
const apiKeyNotarizationVars = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
const hasAppleIdNotarizationCredentials = appleIdNotarizationVars.every((name) =>
  present(process.env[name]),
);
const hasApiKeyNotarizationCredentials = apiKeyNotarizationVars.every((name) =>
  present(process.env[name]),
);
const hasNotarizationCredentials = hasAppleIdNotarizationCredentials || hasApiKeyNotarizationCredentials;
const hasSigningIdentity = present(process.env.CSC_LINK) || present(process.env.CSC_NAME);
const missingCertificatePassword = present(process.env.CSC_LINK) && !present(process.env.CSC_KEY_PASSWORD);

if (!hasNotarizationCredentials || !hasSigningIdentity || missingCertificatePassword) {
  const missing = [
    ...(hasNotarizationCredentials
      ? []
      : [
          "APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER",
        ]),
    ...(hasSigningIdentity ? [] : ["CSC_LINK or CSC_NAME"]),
    ...(missingCertificatePassword ? ["CSC_KEY_PASSWORD"] : []),
  ];

  console.error("Mac desktop signing is not configured.");
  console.error(`Missing: ${missing.join(", ")}`);
  console.error("");
  console.error("Configure a Developer ID Application certificate for electron-builder and Apple notarization credentials before publishing Mac downloads.");
  process.exit(1);
}

console.log("Mac desktop signing and notarization environment is configured.");
