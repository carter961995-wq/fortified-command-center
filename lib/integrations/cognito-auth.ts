import { createHash, createHmac, randomBytes } from "node:crypto";

const COGNITO_N_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";

const N = BigInt(`0x${COGNITO_N_HEX}`);
const G = BigInt(2);

export type CognitoTokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
};

type CognitoAuthInput = {
  region: string;
  clientId: string;
  userPoolId: string;
  username: string;
  password: string;
  oauthDomain?: string;
};

function poolNameFromId(userPoolId: string) {
  const idx = userPoolId.indexOf("_");
  return idx >= 0 ? userPoolId.slice(idx + 1) : userPoolId;
}

function cognitoTimestamp() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${days[now.getUTCDay()]} ${months[now.getUTCMonth()]} ${now.getUTCDate()} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC ${now.getUTCFullYear()}`;
}

function padHex(hex: string) {
  return hex.length % 2 ? `0${hex}` : hex;
}

function toHex(value: bigint) {
  return padHex(value.toString(16));
}

function fromHex(hex: string) {
  return BigInt(`0x${hex.replace(/^0x/, "") || "0"}`);
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest();
}

function hmacSha256(key: Buffer, data: Buffer | string) {
  return createHmac("sha256", key).update(data).digest();
}

function hexHash(hex: string) {
  return sha256(Buffer.from(padHex(hex), "hex")).toString("hex");
}

function modPow(base: bigint, exp: bigint, mod: bigint) {
  let result = BigInt(1);
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > BigInt(0)) {
    if (e & BigInt(1)) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= BigInt(1);
  }
  return result;
}

async function cognitoJson<T>(region: string, target: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json()) as T & { __type?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.message || data.__type || `${target} failed (${response.status})`);
  }
  return data;
}

function tokensFromAuthResult(result?: {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
}): CognitoTokens | null {
  if (!result?.AccessToken && !result?.IdToken) return null;
  return {
    idToken: result.IdToken || result.AccessToken || "",
    accessToken: result.AccessToken || result.IdToken || "",
    refreshToken: result.RefreshToken,
  };
}

async function authWithPasswordFlow(input: CognitoAuthInput): Promise<CognitoTokens> {
  const data = await cognitoJson<{
    AuthenticationResult?: { IdToken?: string; AccessToken?: string; RefreshToken?: string };
    ChallengeName?: string;
  }>(input.region, "InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: input.clientId,
    AuthParameters: {
      USERNAME: input.username,
      PASSWORD: input.password,
    },
  });
  const tokens = tokensFromAuthResult(data.AuthenticationResult);
  if (tokens) return tokens;
  throw new Error(data.ChallengeName ? `TrueSource login needs ${data.ChallengeName}.` : "TrueSource password login did not return a session.");
}

async function authWithOauthPassword(input: CognitoAuthInput): Promise<CognitoTokens> {
  if (!input.oauthDomain) throw new Error("OAuth domain missing.");
  const response = await fetch(`https://${input.oauthDomain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: input.clientId,
      username: input.username,
      password: input.password,
      scope: "openid email profile vai/call",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || (!data.access_token && !data.id_token)) {
    throw new Error(data.error_description || data.error || "OAuth password grant failed.");
  }
  return {
    idToken: data.id_token || data.access_token || "",
    accessToken: data.access_token || data.id_token || "",
    refreshToken: data.refresh_token,
  };
}

async function authWithSrp(input: CognitoAuthInput): Promise<CognitoTokens> {
  const a = fromHex(randomBytes(128).toString("hex")) % N;
  const A = modPow(G, a, N);
  const Ahex = toHex(A);

  const init = await cognitoJson<{
    ChallengeName?: string;
    ChallengeParameters?: Record<string, string>;
    AuthenticationResult?: { IdToken?: string; AccessToken?: string; RefreshToken?: string };
  }>(input.region, "InitiateAuth", {
    AuthFlow: "USER_SRP_AUTH",
    ClientId: input.clientId,
    AuthParameters: {
      USERNAME: input.username,
      SRP_A: Ahex,
    },
  });

  const early = tokensFromAuthResult(init.AuthenticationResult);
  if (early) return early;
  if (init.ChallengeName !== "PASSWORD_VERIFIER") {
    throw new Error(init.ChallengeName ? `TrueSource login needs ${init.ChallengeName}.` : "TrueSource SRP login was rejected.");
  }

  const params = init.ChallengeParameters ?? {};
  const userId = params.USER_ID_FOR_SRP || input.username;
  const saltHex = params.SALT;
  const srpBHex = params.SRP_B;
  const secretBlock = params.SECRET_BLOCK;
  if (!saltHex || !srpBHex || !secretBlock) {
    throw new Error("TrueSource SRP challenge was incomplete.");
  }

  const B = fromHex(srpBHex);
  if (B % N === BigInt(0)) throw new Error("TrueSource SRP challenge was invalid.");

  const uHex = hexHash(Ahex + srpBHex);
  const u = fromHex(uHex);
  if (u === BigInt(0)) throw new Error("TrueSource SRP hash was invalid.");

  const poolName = poolNameFromId(input.userPoolId);
  const usernamePasswordHash = sha256(`${poolName}${userId}:${input.password}`).toString("hex");
  const x = fromHex(hexHash(saltHex + usernamePasswordHash));
  const k = fromHex(hexHash(COGNITO_N_HEX + toHex(G)));
  const S = modPow(B - ((k * modPow(G, x, N)) % N) + N, a + u * x, N);
  const Shex = toHex(S);

  const hkdf = (() => {
    const prk = hmacSha256(Buffer.from(padHex(uHex), "hex"), Buffer.from(padHex(Shex), "hex"));
    const info = Buffer.concat([Buffer.from("Caldera Derived Key", "utf8"), Buffer.from([1])]);
    return hmacSha256(prk, info).subarray(0, 16);
  })();

  const timestamp = cognitoTimestamp();
  const message = Buffer.concat([
    Buffer.from(poolName, "utf8"),
    Buffer.from(userId, "utf8"),
    Buffer.from(secretBlock, "base64"),
    Buffer.from(timestamp, "utf8"),
  ]);
  const signature = hmacSha256(hkdf, message).toString("base64");

  const responded = await cognitoJson<{
    AuthenticationResult?: { IdToken?: string; AccessToken?: string; RefreshToken?: string };
    ChallengeName?: string;
  }>(input.region, "RespondToAuthChallenge", {
    ClientId: input.clientId,
    ChallengeName: "PASSWORD_VERIFIER",
    ChallengeResponses: {
      USERNAME: params.USERNAME || input.username,
      PASSWORD_CLAIM_SECRET_BLOCK: secretBlock,
      TIMESTAMP: timestamp,
      PASSWORD_CLAIM_SIGNATURE: signature,
    },
  });

  const tokens = tokensFromAuthResult(responded.AuthenticationResult);
  if (tokens) return tokens;
  throw new Error(responded.ChallengeName ? `TrueSource login needs ${responded.ChallengeName}.` : "TrueSource SRP verifier failed.");
}

export async function cognitoPasswordSignIn(input: CognitoAuthInput): Promise<CognitoTokens> {
  const errors: string[] = [];
  for (const attempt of [
    () => authWithPasswordFlow(input),
    () => authWithSrp(input),
    () => authWithOauthPassword(input),
  ]) {
    try {
      return await attempt();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "login failed");
    }
  }
  throw new Error(errors[0] || "TrueSource login failed.");
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/") + "===".slice((parts[1].length + 3) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
