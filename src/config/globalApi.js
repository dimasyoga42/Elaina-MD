import axios from "axios";

/*
 * Konfigurasi object:
 * {
 *   url: "https://api.example.com/endpoint" atau "https://api.example.com/{key}/data" (pakai {key} untuk path),
 *   method: "get" | "post" (default "get"),
 *   apikeyIn: "query" | "header" | "path" | "none" (default "query"),
 *   apikeyName: "apikey" (nama query param ATAU nama header, default "apikey"),
 * }
 */
const API_REGISTRY = {
  waifu: {
    url: "https://api.waifu.pics/sfw",
    apikeyIn: "none", // API ini publik, tidak butuh key
  },

  // contoh apikey lewat query param custom (?token=xxx)
  contoh_query: {
    url: "https://api.contoh.com/data",
    apikeyIn: "query",
    apikeyName: "token",
  },

  // contoh apikey lewat header (Authorization: Bearer xxx)
  contoh_header: {
    url: "https://api.contoh.com/secure",
    apikeyIn: "header",
    apikeyName: "Authorization",
  },

  // contoh apikey jadi bagian path (https://api.contoh.com/v1/KEYNYA/lookup)
  contoh_path: {
    url: "https://api.contoh.com/v1/{key}/lookup",
    apikeyIn: "path",
  },

  // shortcut: string biasa = default ke query param "apikey"
  contoh_simple: "https://api.contoh.com/simple",
};

function normalizeConfig(entry) {
  if (typeof entry === "string") {
    return { url: entry, method: "get", apikeyIn: "query", apikeyName: "apikey" };
  }
  return {
    method: "get",
    apikeyIn: "query",
    apikeyName: "apikey",
    ...entry,
  };
}

/**
 * global.api(name, params = {}, apikey = null)
 *
 * Contoh:
 *   await global.api("waifu", { category: "waifu" });
 *   await global.api("contoh_query", { q: "test" }, "MYKEY123");
 *   await global.api("contoh_header", {}, "Bearer MYKEY123");
 *   await global.api("contoh_path", {}, "MYKEY123");
 */
export async function apiCall(name, params = {}, apikey = null) {
  const raw = API_REGISTRY[name];

  if (!raw) {
    throw new Error(`[global.api] Endpoint "${name}" tidak terdaftar di API_REGISTRY`);
  }

  const cfg = normalizeConfig(raw);

  let finalUrl = cfg.url;
  const queryParams = { ...params };
  const headers = {};

  if (apikey && cfg.apikeyIn !== "none") {
    if (cfg.apikeyIn === "path") {
      finalUrl = finalUrl.replace("{key}", encodeURIComponent(apikey));
    } else if (cfg.apikeyIn === "header") {
      headers[cfg.apikeyName || "Authorization"] = apikey;
    } else {
      // default: query
      queryParams[cfg.apikeyName || "apikey"] = apikey;
    }
  }

  try {
    const response = await axios({
      method: cfg.method || "get",
      url: finalUrl,
      params: queryParams,
      headers,
      timeout: 15000,
    });
    return response.data;
  } catch (err) {
    console.error(`[global.api:${name}] Error:`, err.message);
    throw err;
  }
}

export function initGlobalApi() {
  global.api = apiCall;
}
