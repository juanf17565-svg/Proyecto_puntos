import Alpine from "alpinejs";
import { api } from "./api.js";
import "./styles.css";
import "./login.css";
import "./layout.css";
import "./catalog.css";

// ── Importar vistas como HTML crudo ──────────────────────────────
import catalogHtml  from "./views/catalog.html?raw";
import loginHtml    from "./views/login.html?raw";
import registroHtml from "./views/registro.html?raw";
import clienteHtml  from "./views/cliente.html?raw";
import vendedorHtml from "./views/vendedor.html?raw";
import adminHtml    from "./views/admin.html?raw";

// Inyectar todas las vistas en el contenedor (síncrono, antes de Alpine)
const outlet = document.getElementById("views-outlet");
if (outlet) {
  outlet.innerHTML =
    catalogHtml + loginHtml + registroHtml + clienteHtml + vendedorHtml + adminHtml;
}


window.Alpine = Alpine;

Alpine.store("auth", {
  user: JSON.parse(localStorage.getItem("user") || "null"),
  loading: false,
  error: "",

  persist(user, tokenValue) {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      if (tokenValue) localStorage.setItem("token", tokenValue);
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    this.user = user;
  },

  async login(email, password) {
    this.loading = true;
    this.error = "";
    try {
      const { token, user } = await api.post("/auth/login", { email, password });
      this.persist(user, token);
      navigate(defaultRouteFor(user.rol));
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },

  async register(data) {
    this.loading = true;
    this.error = "";
    try {
      const { token, user } = await api.post("/auth/register", data);
      this.persist(user, token);
      navigate("/cliente");
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },

  logout() {
    this.persist(null);
    navigate("/login");
  },
});

Alpine.store("router", {
  current: "/login",
});

function parseHash() {
  const h = location.hash.slice(1) || "/";
  return h.startsWith("/") ? h : "/" + h;
}

function defaultRouteFor(rol) {
  if (rol === "vendedor") return "/vendedor";
  if (rol === "admin") return "/admin";
  return "/cliente";
}

function navigate(path) {
  if (location.hash !== "#" + path) location.hash = path;
  else applyRoute();
}

function applyRoute() {
  const path = parseHash();
  const user = Alpine.store("auth").user;

  // "/" (catálogo) es siempre público
  if (path === "/") {
    Alpine.store("router").current = path;
    return;
  }

  const authOnlyRoutes = ["/login", "/registro"];
  const rolRoutes = {
    cliente:  ["/cliente"],
    vendedor: ["/vendedor"],
    admin:    ["/admin", "/vendedor"],
  };

  if (!user && !authOnlyRoutes.includes(path)) return (location.hash = "/login");
  if (user && authOnlyRoutes.includes(path))   return (location.hash = defaultRouteFor(user.rol));
  if (user && !rolRoutes[user.rol]?.includes(path)) return (location.hash = defaultRouteFor(user.rol));

  Alpine.store("router").current = path;
}

window.addEventListener("hashchange", applyRoute);
window.navigate = navigate;

// ---------- Helpers UI ----------

const formatMoney = (n) =>
  (n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });
const formatDate = (s) =>
  new Date(s).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// ---------- Componentes ----------

Alpine.data("loginForm", () => ({
  email: "",
  password: "",
  showPassword: false,
  remember: false,
  submit() {
    Alpine.store("auth").login(this.email, this.password);
  },
}));

Alpine.data("registroForm", () => ({
  nombre: "",
  dni: "",
  email: "",
  password: "",
  confirmPassword: "",
  codigoInvitacion: "",
  showPassword: false,
  showConfirmPassword: false,
  localError: "",
  submit() {
    this.localError = "";
    if (this.password !== this.confirmPassword) {
      this.localError = "Las contraseñas no coinciden.";
      return;
    }
    if (this.password.length < 6) {
      this.localError = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }
    Alpine.store("auth").register({
      nombre: this.nombre,
      dni: this.dni,
      email: this.email,
      password: this.password,
      codigo_invitacion_usado: this.codigoInvitacion || null,
    });
  },
}));

Alpine.data("catalogView", () => ({
  productos: [],
  loading: true,
  async init() {
    try {
      this.productos = await api.get("/productos");
    } catch {
      this.productos = [];
    } finally {
      this.loading = false;
    }
  },
  async canjear(producto) {
    if (!Alpine.store("auth").user) {
      navigate("/login");
      return;
    }
    navigate("/cliente");
  },
}));

Alpine.data("clienteView", () => ({
  me: null,
  movs: [],
  loading: true,
  formatMoney,
  formatDate,
  async init() {
    try {
      const [me, movs] = await Promise.all([
        api.get("/cliente/me"),
        api.get("/cliente/movimientos"),
      ]);
      this.me = me;
      this.movs = movs;
    } finally {
      this.loading = false;
    }
  },
}));

Alpine.data("vendedorView", () => ({
  dni: "",
  descripcion: "",
  cliente: null,
  productos: [],
  filtro: "",
  cart: {}, // { producto_id: cantidad }
  error: "",
  ok: "",
  busy: false,
  formatMoney,

  async init() {
    try {
      this.productos = await api.get("/productos");
    } catch (e) {
      this.error = "No pude cargar el catálogo";
    }
  },

  get productosFiltrados() {
    const q = this.filtro.trim().toLowerCase();
    if (!q) return this.productos;
    return this.productos.filter((p) => p.nombre.toLowerCase().includes(q));
  },

  get cartItems() {
    return this.productos
      .filter((p) => this.cart[p.id])
      .map((p) => ({
        ...p,
        cantidad: this.cart[p.id],
        subtotal_precio: p.precio * this.cart[p.id],
        subtotal_puntos: p.puntos_por_unidad * this.cart[p.id],
      }));
  },

  get totalMonto() {
    return this.cartItems.reduce((a, i) => a + i.subtotal_precio, 0);
  },

  get totalPuntos() {
    return this.cartItems.reduce((a, i) => a + i.subtotal_puntos, 0);
  },

  add(p) {
    this.cart = { ...this.cart, [p.id]: (this.cart[p.id] || 0) + 1 };
  },

  inc(id) {
    this.cart = { ...this.cart, [id]: (this.cart[id] || 0) + 1 };
  },

  dec(id) {
    const next = (this.cart[id] || 0) - 1;
    const copy = { ...this.cart };
    if (next <= 0) delete copy[id];
    else copy[id] = next;
    this.cart = copy;
  },

  clear() {
    this.cart = {};
    this.descripcion = "";
  },

  async buscar() {
    this.error = "";
    this.ok = "";
    this.cliente = null;
    if (!this.dni) return;
    try {
      this.cliente = await api.get(`/vendedor/cliente/${this.dni}`);
    } catch (e) {
      this.error = e.message;
    }
  },

  async confirmar() {
    this.error = "";
    this.ok = "";
    if (!this.cliente) return (this.error = "Buscá primero un cliente por DNI");
    if (this.cartItems.length === 0) return (this.error = "Agregá al menos un producto");
    this.busy = true;
    try {
      const items = Object.entries(this.cart).map(([producto_id, cantidad]) => ({
        producto_id: Number(producto_id),
        cantidad,
      }));
      const resp = await api.post("/vendedor/cargar", {
        dni: this.cliente.dni,
        items,
        descripcion: this.descripcion || undefined,
      });
      this.ok = `+${resp.total_puntos} puntos · Total $${formatMoney(resp.total_monto)}. Saldo: ${resp.puntos_totales_cliente}`;
      this.cliente.puntos = resp.puntos_totales_cliente;
      this.clear();
    } catch (e) {
      this.error = e.message;
    } finally {
      this.busy = false;
    }
  },
}));

Alpine.data("adminView", () => ({
  tab: "usuarios",
  stats: null,
  usuarios: [],
  txs: [],
  productos: [],
  nuevoUsuario: { email: "", password: "", nombre: "", rol: "vendedor", dni: "" },
  nuevoProducto: { nombre: "", precio: 0, puntos_por_unidad: 0 },
  editId: null,
  editDraft: { nombre: "", precio: 0, puntos_por_unidad: 0 },
  okMsg: "",
  errMsg: "",
  busy: false,
  formatMoney,
  formatDate,

  async init() {
    await this.refresh();
  },

  async refresh() {
    const [stats, usuarios, txs, productos] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/usuarios"),
      api.get("/admin/transacciones"),
      api.get("/admin/productos"),
    ]);
    this.stats = stats;
    this.usuarios = usuarios;
    this.txs = txs;
    this.productos = productos;
  },

  async crearUsuario() {
    this.okMsg = "";
    this.errMsg = "";
    this.busy = true;
    try {
      await api.post("/admin/usuarios", {
        ...this.nuevoUsuario,
        dni: this.nuevoUsuario.rol === "cliente" ? this.nuevoUsuario.dni : undefined,
      });
      this.okMsg = "Usuario creado";
      this.nuevoUsuario = { email: "", password: "", nombre: "", rol: "vendedor", dni: "" };
      await this.refresh();
    } catch (e) {
      this.errMsg = e.message;
    } finally {
      this.busy = false;
    }
  },

  async crearProducto() {
    this.okMsg = "";
    this.errMsg = "";
    const p = this.nuevoProducto;
    if (!p.nombre) return (this.errMsg = "Nombre requerido");
    if (p.precio < 0 || p.puntos_por_unidad < 0)
      return (this.errMsg = "Valores no pueden ser negativos");
    this.busy = true;
    try {
      await api.post("/admin/productos", {
        nombre: p.nombre,
        precio: Number(p.precio),
        puntos_por_unidad: Number(p.puntos_por_unidad),
      });
      this.okMsg = "Producto creado";
      this.nuevoProducto = { nombre: "", precio: 0, puntos_por_unidad: 0 };
      await this.refresh();
    } catch (e) {
      this.errMsg = e.message;
    } finally {
      this.busy = false;
    }
  },

  startEdit(p) {
    this.editId = p.id;
    this.editDraft = {
      nombre: p.nombre,
      precio: p.precio,
      puntos_por_unidad: p.puntos_por_unidad,
    };
  },

  cancelEdit() {
    this.editId = null;
  },

  async saveEdit(p) {
    try {
      await api.put(`/admin/productos/${p.id}`, {
        nombre: this.editDraft.nombre,
        precio: Number(this.editDraft.precio),
        puntos_por_unidad: Number(this.editDraft.puntos_por_unidad),
        activo: !!p.activo,
      });
      this.editId = null;
      await this.refresh();
    } catch (e) {
      this.errMsg = e.message;
    }
  },

  async toggleActivo(p) {
    try {
      await api.put(`/admin/productos/${p.id}`, {
        nombre: p.nombre,
        precio: p.precio,
        puntos_por_unidad: p.puntos_por_unidad,
        activo: !p.activo,
      });
      await this.refresh();
    } catch (e) {
      this.errMsg = e.message;
    }
  },
}));

Alpine.start();
applyRoute();
