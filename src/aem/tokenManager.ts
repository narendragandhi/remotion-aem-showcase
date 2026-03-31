/**
 * AEM Token Manager
 *
 * Handles IMS Service Account (JWT) token acquisition and refresh
 * for AEM Cloud Service authentication.
 *
 * Supports:
 * - Service Account (JWT) authentication
 * - Token caching with automatic refresh
 * - Token validation and expiry checking
 */

import jwt from "jsonwebtoken";
import { trackError, trackPerformance, createTimer } from "../telemetry";

export interface ImsConfig {
  clientId: string;
  clientSecret: string;
  technicalAccountId: string;
  orgId: string;
  privateKey: string;
  imsEndpoint?: string;
  metascopes?: string[];
}

export interface TokenInfo {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
  tokenType: string;
}

// Token cache
let cachedToken: TokenInfo | null = null;

// Buffer time before expiry to refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Default IMS endpoint
const DEFAULT_IMS_ENDPOINT = "https://ims-na1.adobelogin.com";

// Default metascopes for AEM
const DEFAULT_METASCOPES = [
  "https://ims-na1.adobelogin.com/s/ent_aem_cloud_api",
];

/**
 * Get IMS configuration from environment variables
 */
export const getImsConfig = (): ImsConfig | null => {
  const clientId = process.env.AEM_IMS_CLIENT_ID;
  const clientSecret = process.env.AEM_IMS_CLIENT_SECRET;
  const technicalAccountId = process.env.AEM_IMS_TECHNICAL_ACCOUNT_ID;
  const orgId = process.env.AEM_IMS_ORG_ID;
  const privateKey = process.env.AEM_IMS_PRIVATE_KEY;

  if (!clientId || !clientSecret || !technicalAccountId || !orgId || !privateKey) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    technicalAccountId,
    orgId,
    // Handle escaped newlines in env var
    privateKey: privateKey.replace(/\\n/g, "\n"),
    imsEndpoint: process.env.AEM_IMS_ENDPOINT || DEFAULT_IMS_ENDPOINT,
    metascopes: process.env.AEM_IMS_METASCOPES?.split(",") || DEFAULT_METASCOPES,
  };
};

/**
 * Create JWT assertion for IMS token exchange
 */
const createJwtAssertion = (config: ImsConfig): string => {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 60 * 60 * 24; // 24 hours

  const payload: Record<string, unknown> = {
    exp: expiry,
    iss: config.orgId,
    sub: config.technicalAccountId,
    aud: `${config.imsEndpoint}/c/${config.clientId}`,
  };

  // Add metascopes
  for (const scope of config.metascopes || DEFAULT_METASCOPES) {
    payload[scope] = true;
  }

  return jwt.sign(payload, config.privateKey, { algorithm: "RS256" });
};

/**
 * Exchange JWT assertion for access token
 */
const exchangeJwtForToken = async (
  config: ImsConfig,
  jwtAssertion: string
): Promise<TokenInfo> => {
  const timer = createTimer("ims_token_exchange");
  const endpoint = `${config.imsEndpoint}/ims/exchange/jwt`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    jwt_token: jwtAssertion,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IMS token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    timer.stop();

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type || "bearer",
    };
  } catch (error) {
    timer.stop();
    trackError(
      "ims_token_exchange_error",
      error instanceof Error ? error : new Error(String(error)),
      { endpoint }
    );
    throw error;
  }
};

/**
 * Check if token needs refresh
 */
const needsRefresh = (token: TokenInfo | null): boolean => {
  if (!token) return true;
  return Date.now() >= token.expiresAt - REFRESH_BUFFER_MS;
};

/**
 * Get a valid access token, refreshing if necessary
 */
export const getAccessToken = async (config?: ImsConfig): Promise<string | null> => {
  const imsConfig = config || getImsConfig();

  // If no IMS config, fall back to static token
  if (!imsConfig) {
    const staticToken = process.env.AEM_TOKEN;
    if (staticToken) {
      console.info("[TokenManager] Using static AEM_TOKEN");
      return staticToken;
    }
    return null;
  }

  // Check if cached token is still valid
  if (!needsRefresh(cachedToken)) {
    return cachedToken!.accessToken;
  }

  console.info("[TokenManager] Refreshing IMS access token...");

  try {
    const jwtAssertion = createJwtAssertion(imsConfig);
    const tokenInfo = await exchangeJwtForToken(imsConfig, jwtAssertion);
    cachedToken = tokenInfo;

    const expiresInMs = tokenInfo.expiresAt - Date.now();
    console.info(
      `[TokenManager] Token refreshed, expires in ${Math.round(expiresInMs / 60000)} minutes`
    );

    trackPerformance("token_refresh_success", 1, "count", {
      expiresInMs,
    });

    return tokenInfo.accessToken;
  } catch (error) {
    console.error("[TokenManager] Token refresh failed:", error);

    // If we have a cached token that's expired, try to use it anyway
    // (some grace period might be allowed)
    if (cachedToken) {
      console.warn("[TokenManager] Using expired token as fallback");
      return cachedToken.accessToken;
    }

    // Fall back to static token
    const staticToken = process.env.AEM_TOKEN;
    if (staticToken) {
      console.warn("[TokenManager] Falling back to static AEM_TOKEN");
      return staticToken;
    }

    throw error;
  }
};

/**
 * Invalidate cached token (force refresh on next request)
 */
export const invalidateToken = (): void => {
  cachedToken = null;
  console.info("[TokenManager] Token cache invalidated");
};

/**
 * Get token status for health checks
 */
export const getTokenStatus = (): {
  hasToken: boolean;
  isExpired: boolean;
  expiresAt?: string;
  tokenType: "ims" | "static" | "none";
} => {
  const imsConfig = getImsConfig();

  if (cachedToken) {
    return {
      hasToken: true,
      isExpired: needsRefresh(cachedToken),
      expiresAt: new Date(cachedToken.expiresAt).toISOString(),
      tokenType: "ims",
    };
  }

  if (process.env.AEM_TOKEN) {
    return {
      hasToken: true,
      isExpired: false, // Static tokens don't expire (from our perspective)
      tokenType: "static",
    };
  }

  if (imsConfig) {
    return {
      hasToken: false,
      isExpired: true,
      tokenType: "ims",
    };
  }

  return {
    hasToken: false,
    isExpired: true,
    tokenType: "none",
  };
};

/**
 * Validate that the token configuration is correct
 */
export const validateTokenConfig = async (): Promise<{
  valid: boolean;
  message: string;
}> => {
  const imsConfig = getImsConfig();

  if (!imsConfig && !process.env.AEM_TOKEN) {
    return {
      valid: false,
      message: "No authentication configured. Set AEM_TOKEN or IMS credentials.",
    };
  }

  if (!imsConfig) {
    return {
      valid: true,
      message: "Using static AEM_TOKEN (no auto-refresh)",
    };
  }

  try {
    await getAccessToken(imsConfig);
    return {
      valid: true,
      message: "IMS authentication configured and working",
    };
  } catch (error) {
    return {
      valid: false,
      message: `IMS authentication failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
