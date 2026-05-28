let loadEnvConfig;

try {
  ({ loadEnvConfig } = require("@next/env"));
} catch (error) {
  if (error?.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

let envLoaded = false;

function loadDesktopEnv(projectDir = process.cwd()) {
  if (envLoaded) {
    return;
  }

  if (loadEnvConfig) {
    loadEnvConfig(projectDir);
  }
  envLoaded = true;
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function copyEnvAlias(env, canonicalName, aliasName) {
  if (!present(env[canonicalName]) && present(env[aliasName])) {
    env[canonicalName] = env[aliasName];
  }
}

function normalizeDesktopSigningEnv(env = process.env) {
  copyEnvAlias(env, "CSC_LINK", "MACOS_CERTIFICATE");
  copyEnvAlias(env, "CSC_KEY_PASSWORD", "MACOS_CERTIFICATE_PASSWORD");
  copyEnvAlias(env, "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_ID_PASSWORD");
  copyEnvAlias(env, "APPLE_API_ISSUER", "APPLE_API_ISSUER_ID");
  return env;
}

function getMacSigningStatus(env = process.env) {
  const normalizedEnv = normalizeDesktopSigningEnv(env);
  const hasAppleIdNotarizationCredentials =
    present(normalizedEnv.APPLE_ID) &&
    present(normalizedEnv.APPLE_APP_SPECIFIC_PASSWORD) &&
    present(normalizedEnv.APPLE_TEAM_ID);
  const hasApiKeyNotarizationCredentials =
    present(normalizedEnv.APPLE_API_KEY) &&
    present(normalizedEnv.APPLE_API_KEY_ID) &&
    present(normalizedEnv.APPLE_API_ISSUER);
  const hasNotarizationCredentials =
    hasAppleIdNotarizationCredentials || hasApiKeyNotarizationCredentials;
  const hasSigningIdentity = present(normalizedEnv.CSC_LINK) || present(normalizedEnv.CSC_NAME);
  const missingCertificatePassword =
    present(normalizedEnv.CSC_LINK) && !present(normalizedEnv.CSC_KEY_PASSWORD);

  return {
    hasAppleIdNotarizationCredentials,
    hasApiKeyNotarizationCredentials,
    hasNotarizationCredentials,
    hasSigningIdentity,
    missingCertificatePassword,
  };
}

module.exports = {
  getMacSigningStatus,
  loadDesktopEnv,
  normalizeDesktopSigningEnv,
  present,
};
