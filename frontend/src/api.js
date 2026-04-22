const BASE = "/api";

function token() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Si el token expiró o es inválido, cerrar sesión automáticamente
  if (res.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    if (window.Alpine) {
      const auth = window.Alpine.store("auth");
      if (auth?.user) auth.user = null;
    }
    window.location.hash = "/login";
    throw new Error("Sesión expirada. Iniciá sesión nuevamente.");
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) {
        msg = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
      }
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:   (p)       => request(p),
  post:  (p, body) => request(p, { method: "POST",   body: JSON.stringify(body) }),
  put:   (p, body) => request(p, { method: "PUT",    body: JSON.stringify(body) }),
  patch: (p, body) => request(p, { method: "PATCH",  body: JSON.stringify(body) }),
  del:   (p)       => request(p, { method: "DELETE" }),
};
