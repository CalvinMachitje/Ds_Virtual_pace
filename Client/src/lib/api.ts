// src/lib/api.ts
export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  // Helper to always get the freshest token
  const getAuthHeader = () => {
    const token = localStorage.getItem("access_token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  let headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  let response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401
  if (response.status === 401) {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      console.warn("No refresh token → logging out");
      localStorage.clear();
      window.location.href = "/login";
      throw new Error("Session expired - no refresh token");
    }

    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!refreshRes.ok) {
      console.warn("Refresh failed → logging out");
      localStorage.clear();
      window.location.href = "/login";
      throw new Error("Refresh token invalid");
    }

    const { access_token: newAccessToken } = await refreshRes.json();

    // Save new token
    localStorage.setItem("access_token", newAccessToken);

    // CRITICAL FIX: Rebuild headers with fresh token for retry
    headers = {
      "Content-Type": "application/json",
      ...getAuthHeader(),  // ← uses new token now
      ...options.headers,
    };

    // Retry with updated headers
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  }

  if (!response.ok) {
    let errData;
    try {
      errData = await response.json();
    } catch {
      errData = {};
    }

    const errorMessage =
      errData.error ||
      errData.msg ||
      (response.status === 401 ? "Session expired - please log in again" :
       response.status === 403 ? "Permission denied" :
       response.status === 404 ? "Resource not found" :
       `Request failed (${response.status})`);

    throw new Error(errorMessage);
  }

  return response.json();
};