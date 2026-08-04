import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, getImsConfig, invalidateToken } from "./tokenManager";

describe("tokenManager OAuth configuration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    invalidateToken();
    vi.restoreAllMocks();
  });

  it("accepts OAuth Server-to-Server credentials without JWT fields", () => {
    process.env.AEM_IMS_CLIENT_ID = "client-id";
    process.env.AEM_IMS_CLIENT_SECRET = "client-secret";
    process.env.AEM_IMS_SCOPES = "scope-a, scope-b";

    expect(getImsConfig()).toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      scopes: ["scope-a", "scope-b"]
    });
  });

  it("exchanges OAuth credentials and caches the access token", async () => {
    process.env.AEM_IMS_CLIENT_ID = "client-id";
    process.env.AEM_IMS_CLIENT_SECRET = "client-secret";
    process.env.AEM_IMS_SCOPES = "scope-a";
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access-token", expires_in: 3600 })
    } as Response);

    await expect(getAccessToken()).resolves.toBe("access-token");
    await expect(getAccessToken()).resolves.toBe("access-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/ims/token/v3");
  });
});
