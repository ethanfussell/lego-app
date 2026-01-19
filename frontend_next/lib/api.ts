// frontend_next/lib/api.ts

type ApiFetchOptions = {
    method?: string;
    token?: string | null;
    body?: any;
    headers?: Record<string, string>;
    // if you ever need to call absolute URLs, you can pass fullUrl
    fullUrl?: string;
  };
  
  export async function apiFetch(path: string, opts: ApiFetchOptions = {}) {
    const {
      method = "GET",
      token = null,
      body,
      headers = {},
      fullUrl,
    } = opts;
  
    const url = fullUrl || (path.startsWith("/api") ? path : `/api${path}`);
  
    const finalHeaders: Record<string, string> = {
      ...headers,
    };
  
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  
    // Only set JSON header if we actually send a body
    let payload: BodyInit | undefined = undefined;
    if (body !== undefined) {
      finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
      payload = typeof body === "string" ? body : JSON.stringify(body);
    }
  
    const resp = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
    });
  
    // Try to parse JSON if possible
    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
  
    if (!resp.ok) {
      const errText = isJson ? JSON.stringify(await safeJson(resp)) : await resp.text();
      // keep your existing style where errors start with status code (useful in UI)
      throw new Error(`${resp.status} ${errText}`);
    }
  
    return isJson ? await resp.json() : await resp.text();
  }
  
  async function safeJson(resp: Response) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }