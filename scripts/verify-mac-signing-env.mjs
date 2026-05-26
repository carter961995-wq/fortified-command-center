const requiredNotarizationVars = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
const missingNotarizationVars = requiredNotarizationVars.filter((name) => !process.env[name]);
const hasSigningIdentity = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);
const missingCertificatePassword = Boolean(process.env.CSC_LINK && !process.env.CSC_KEY_PASSWORD);

if (missingNotarizationVars.length > 0 || !hasSigningIdentity || missingCertificatePassword) {
  const missing = [
    ...missingNotarizationVars,
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
