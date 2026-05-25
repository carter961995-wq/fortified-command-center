const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { notarize } = require("@electron/notarize");

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveApiKeyFile(apiKey) {
  if (fs.existsSync(apiKey)) {
    return apiKey;
  }

  const keyContents = apiKey.includes("-----BEGIN") ? apiKey : Buffer.from(apiKey, "base64").toString("utf8");
  if (!keyContents.includes("-----BEGIN")) {
    throw new Error("APPLE_API_KEY must be an existing .p8 path, raw .p8 contents, or base64-encoded .p8 contents.");
  }
  const keyPath = path.join(os.tmpdir(), `fortified-notary-${Date.now()}.p8`);
  fs.writeFileSync(keyPath, keyContents, { mode: 0o600 });
  return keyPath;
}

function getNotaryOptions(appBundleId, appPath) {
  const apiKey = process.env.APPLE_API_KEY;
  const apiKeyId = process.env.APPLE_API_KEY_ID;
  const apiIssuer = process.env.APPLE_API_ISSUER;

  if (present(apiKey) && present(apiKeyId) && present(apiIssuer)) {
    return {
      appBundleId,
      appPath,
      tool: "notarytool",
      appleApiKey: resolveApiKeyFile(apiKey),
      appleApiKeyId: apiKeyId,
      appleApiIssuer: apiIssuer,
    };
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (present(appleId) && present(appleIdPassword) && present(teamId)) {
    return {
      appBundleId,
      appPath,
      tool: "notarytool",
      appleId,
      appleIdPassword,
      teamId,
    };
  }

  return null;
}

module.exports = async function notarizeMac(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appBundleId = context.packager.appInfo.appId;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const notaryOptions = getNotaryOptions(appBundleId, appPath);

  if (!notaryOptions) {
    console.log("Skipping macOS notarization because Apple notarization credentials are not configured.");
    return;
  }

  console.log(`Notarizing ${appBundleId} at ${appPath}`);
  await notarize(notaryOptions);
};
