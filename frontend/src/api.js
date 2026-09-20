const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function buildThesis({ symbol, question }) {
  const res = await fetch(`${BASE}/api/thesis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}
