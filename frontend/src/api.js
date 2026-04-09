const BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

export async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data && data.error ? data.error : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return data;
}

export { BASE };

