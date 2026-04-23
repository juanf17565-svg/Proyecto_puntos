import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { marked } from "marked";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { Producto } from "../../types";

type AdminTab =
  | "inicio"
  | "usuarios"
  | "productos"
  | "categorias"
  | "transacciones"
  | "canjes"
  | "codigos"
  | "crear"
  | "sobre-nosotros"
  | "terminos";

type Stats = {
  clientes: number;
  productos: number;
  codigos_activos: number;
  canjes_pendientes: number;
  puntos_emitidos: number;
};

type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol: "cliente" | "vendedor" | "admin";
  dni: string | null;
  puntos_saldo: number;
  codigo_invitacion: string | null;
  activo: boolean;
  created_at: string;
};

type Movimiento = {
  id: number;
  tipo: string;
  puntos: number;
  descripcion: string | null;
  referencia_tipo: string | null;
  created_at: string;
  usuario_nombre: string;
  usuario_email: string;
  admin_nombre: string | null;
};

type ProductoAdmin = Producto & {
  activo: boolean;
  created_at: string;
};

type Categoria = {
  id: number;
  nombre: string;
  created_at: string;
};

type Codigo = {
  id: number;
  codigo: string;
  puntos_valor: number;
  usos_maximos: number;
  usos_actuales: number;
  fecha_expiracion: string | null;
  activo: boolean;
  created_at: string;
  creado_por_nombre: string;
};

type CanjeAdmin = {
  id: number;
  codigo_retiro?: string | null;
  puntos_usados: number;
  estado: string;
  fecha_limite_retiro: string | null;
  notas: string | null;
  created_at: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_dni: string;
  producto_nombre: string;
};

type Pagina = {
  slug: string;
  titulo: string;
  contenido: string;
};

type ProductoForm = {
  nombre: string;
  descripcion: string;
  categoria: string;
  puntos_requeridos: number | "";
  puntos_acumulables: number | "";
  imagen_url: string;
  imagen_file: File | null;
  imagen_preview: string | null;
};

type EditorDraft = {
  titulo: string;
  contenido: string;
  okMsg: string;
  errMsg: string;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCanjeCode(canje: Pick<CanjeAdmin, "id" | "codigo_retiro">): string {
  if (!canje.codigo_retiro || /^C0{2,}[A-Z0-9]*$/.test(canje.codigo_retiro)) return "Generando...";
  return canje.codigo_retiro;
}

function emptyProductoForm(): ProductoForm {
  return {
    nombre: "",
    descripcion: "",
    categoria: "",
    puntos_requeridos: "",
    puntos_acumulables: "",
    imagen_url: "",
    imagen_file: null,
    imagen_preview: null,
  };
}

function uploadPreview(file: File, onDone: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    onDone(String(event.target?.result || ""));
  };
  reader.readAsDataURL(file);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="admin-section-header">
      <h2 className="admin-section-title">{title}</h2>
    </div>
  );
}

export function Admin() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<AdminTab>("inicio");
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [nuevoProducto, setNuevoProducto] = useState<ProductoForm>(emptyProductoForm());
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ProductoForm>(emptyProductoForm());

  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: "" });
  const [nuevoCodigo, setNuevoCodigo] = useState({
    codigo: "",
    puntos_valor: 0,
    usos_maximos: 1,
    fecha_expiracion: "",
  });
  const [nuevoUsuario, setNuevoUsuario] = useState({
    email: "",
    password: "",
    nombre: "",
    rol: "vendedor",
    dni: "",
  });
  const [busquedaUsuarios, setBusquedaUsuarios] = useState("");
  const [busquedaProductos, setBusquedaProductos] = useState("");
  const [asignacionUsuarioId, setAsignacionUsuarioId] = useState<number | null>(null);
  const [asignacionPuntos, setAsignacionPuntos] = useState("100");
  const [asignacionDescripcion, setAsignacionDescripcion] = useState("");

  const [sobreDraft, setSobreDraft] = useState<EditorDraft>({
    titulo: "",
    contenido: "",
    okMsg: "",
    errMsg: "",
  });
  const [terminosDraft, setTerminosDraft] = useState<EditorDraft>({
    titulo: "",
    contenido: "",
    okMsg: "",
    errMsg: "",
  });

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<Stats>("/admin/stats"),
  });

  const usuariosQuery = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => api.get<Usuario[]>("/admin/usuarios"),
  });

  const movimientosQuery = useQuery({
    queryKey: ["admin", "movimientos"],
    queryFn: () => api.get<Movimiento[]>("/admin/movimientos"),
  });

  const productosQuery = useQuery({
    queryKey: ["admin", "productos"],
    queryFn: () => api.get<ProductoAdmin[]>("/admin/productos"),
  });

  const categoriasQuery = useQuery({
    queryKey: ["admin", "categorias"],
    queryFn: () => api.get<Categoria[]>("/admin/categorias"),
  });

  const codigosQuery = useQuery({
    queryKey: ["admin", "codigos"],
    queryFn: () => api.get<Codigo[]>("/admin/codigos"),
  });

  const canjesQuery = useQuery({
    queryKey: ["admin", "canjes"],
    queryFn: () => api.get<CanjeAdmin[]>("/admin/canjes"),
  });

  const sobreQuery = useQuery({
    queryKey: ["admin", "paginas", "sobre-nosotros"],
    queryFn: () => api.get<Pagina>("/admin/paginas/sobre-nosotros"),
  });

  const terminosQuery = useQuery({
    queryKey: ["admin", "paginas", "terminos"],
    queryFn: () => api.get<Pagina>("/admin/paginas/terminos"),
  });

  useEffect(() => {
    if (!sobreQuery.data) return;
    setSobreDraft((prev) =>
      prev.titulo || prev.contenido
        ? prev
        : {
            ...prev,
            titulo: sobreQuery.data.titulo,
            contenido: sobreQuery.data.contenido,
          },
    );
  }, [sobreQuery.data]);

  useEffect(() => {
    if (!terminosQuery.data) return;
    setTerminosDraft((prev) =>
      prev.titulo || prev.contenido
        ? prev
        : {
            ...prev,
            titulo: terminosQuery.data.titulo,
            contenido: terminosQuery.data.contenido,
          },
    );
  }, [terminosQuery.data]);

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("imagen", file);
      return api.post<{ url: string }>("/admin/productos/upload", form);
    },
  });

  const commandMutation = useMutation({
    mutationFn: async ({
      method,
      path,
      body,
    }: {
      method: "post" | "put" | "patch" | "delete";
      path: string;
      body?: unknown;
    }) => {
      if (method === "post") return api.post(path, body as Record<string, unknown>);
      if (method === "put") return api.put(path, body as Record<string, unknown>);
      if (method === "patch") return api.patch(path, body as Record<string, unknown>);
      return api.delete(path);
    },
  });

  async function refreshQueries(keys: Array<readonly string[]>) {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
  }

  const productos = productosQuery.data ?? [];
  const usuarios = usuariosQuery.data ?? [];
  const movimientos = movimientosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];
  const codigos = codigosQuery.data ?? [];
  const canjes = canjesQuery.data ?? [];

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuarios.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((usuario) => {
      const haystack = [
        usuario.nombre,
        usuario.email,
        usuario.rol,
        usuario.dni || "",
        String(usuario.puntos_saldo),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [usuarios, busquedaUsuarios]);

  const productosFiltrados = useMemo(() => {
    const q = busquedaProductos.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((producto) => {
      const haystack = [
        producto.nombre,
        producto.descripcion || "",
        producto.categoria || "",
        String(producto.puntos_requeridos),
        String(producto.puntos_acumulables ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [productos, busquedaProductos]);

  const sobreHtml = useMemo(() => marked(sobreDraft.contenido || ""), [sobreDraft.contenido]);
  const terminosHtml = useMemo(() => marked(terminosDraft.contenido || ""), [terminosDraft.contenido]);

  async function crearProducto() {
    setErrMsg("");
    setOkMsg("");
    if (!nuevoProducto.nombre.trim()) {
      setErrMsg("El nombre del producto es obligatorio.");
      return;
    }

    const puntosReq = Number(nuevoProducto.puntos_requeridos);
    if (!Number.isFinite(puntosReq) || puntosReq <= 0) {
      setErrMsg("Los puntos requeridos deben ser mayores a 0.");
      return;
    }

    setBusy(true);
    try {
      let imagenUrl = nuevoProducto.imagen_url || null;
      if (nuevoProducto.imagen_file) {
        const upload = await uploadImageMutation.mutateAsync(nuevoProducto.imagen_file);
        imagenUrl = upload.url;
      }

      await commandMutation.mutateAsync({
        method: "post",
        path: "/admin/productos",
        body: {
          nombre: nuevoProducto.nombre.trim(),
          descripcion: nuevoProducto.descripcion || null,
          categoria: nuevoProducto.categoria || null,
          puntos_requeridos: puntosReq,
          puntos_acumulables: nuevoProducto.puntos_acumulables !== "" ? Number(nuevoProducto.puntos_acumulables) : null,
          imagen_url: imagenUrl,
        },
      });

      setNuevoProducto(emptyProductoForm());
      setOkMsg("Producto creado correctamente.");
      await refreshQueries([["admin", "productos"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(producto: ProductoAdmin) {
    setEditId(producto.id);
    setEditDraft({
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      categoria: producto.categoria || "",
      puntos_requeridos: producto.puntos_requeridos,
      puntos_acumulables: producto.puntos_acumulables ?? "",
      imagen_url: producto.imagen_url || "",
      imagen_file: null,
      imagen_preview: null,
    });
  }

  async function saveEdit(productoId: number) {
    setErrMsg("");
    setOkMsg("");
    setBusy(true);
    try {
      let imagenUrl = editDraft.imagen_url || null;
      if (editDraft.imagen_file) {
        const upload = await uploadImageMutation.mutateAsync(editDraft.imagen_file);
        imagenUrl = upload.url;
      }

      await commandMutation.mutateAsync({
        method: "put",
        path: `/admin/productos/${productoId}`,
        body: {
          nombre: editDraft.nombre.trim(),
          descripcion: editDraft.descripcion || null,
          categoria: editDraft.categoria || null,
          puntos_requeridos: Number(editDraft.puntos_requeridos),
          puntos_acumulables: editDraft.puntos_acumulables !== "" ? Number(editDraft.puntos_acumulables) : null,
          imagen_url: imagenUrl,
        },
      });

      setEditId(null);
      setOkMsg("Producto actualizado.");
      await refreshQueries([["admin", "productos"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleProductoActivo(producto: ProductoAdmin) {
    setErrMsg("");
    try {
      await commandMutation.mutateAsync({
        method: "patch",
        path: `/admin/productos/${producto.id}/activo`,
        body: { activo: !producto.activo },
      });
      await refreshQueries([["admin", "productos"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    }
  }

  async function crearCategoria() {
    setErrMsg("");
    setOkMsg("");
    if (!nuevaCategoria.nombre.trim()) {
      setErrMsg("El nombre de categoria es obligatorio.");
      return;
    }

    setBusy(true);
    try {
      await commandMutation.mutateAsync({
        method: "post",
        path: "/admin/categorias",
        body: {
          nombre: nuevaCategoria.nombre.trim(),
        },
      });
      setNuevaCategoria({ nombre: "" });
      setOkMsg("Categoria creada.");
      await refreshQueries([["admin", "categorias"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleUsuarioActivo(usuario: Usuario) {
    setErrMsg("");
    try {
      await commandMutation.mutateAsync({
        method: "patch",
        path: `/admin/usuarios/${usuario.id}/activo`,
        body: { activo: !usuario.activo },
      });
      await refreshQueries([["admin", "usuarios"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    }
  }

  function abrirAsignacion(usuario: Usuario) {
    setAsignacionUsuarioId(usuario.id);
    setAsignacionPuntos("100");
    setAsignacionDescripcion("");
    setErrMsg("");
    setOkMsg("");
  }

  function cancelarAsignacion() {
    setAsignacionUsuarioId(null);
    setAsignacionPuntos("100");
    setAsignacionDescripcion("");
  }

  async function asignarPuntosManual() {
    if (!asignacionUsuarioId) return;
    const puntos = Number(asignacionPuntos);
    if (!Number.isFinite(puntos) || !Number.isInteger(puntos) || puntos <= 0) {
      setErrMsg("Ingresa una cantidad entera de puntos mayor a 0.");
      return;
    }

    setBusy(true);
    setErrMsg("");
    setOkMsg("");
    try {
      await commandMutation.mutateAsync({
        method: "post",
        path: "/admin/puntos",
        body: {
          usuario_id: asignacionUsuarioId,
          puntos,
          descripcion: asignacionDescripcion.trim() || "Asignacion manual desde panel admin",
          tipo: "asignacion_manual",
        },
      });
      setOkMsg(`Se asignaron ${puntos} puntos correctamente.`);
      cancelarAsignacion();
      await refreshQueries([["admin", "usuarios"], ["admin", "stats"], ["admin", "movimientos"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function crearCodigo() {
    setErrMsg("");
    setOkMsg("");
    if (!nuevoCodigo.codigo.trim()) {
      setErrMsg("El codigo es obligatorio.");
      return;
    }
    if (!nuevoCodigo.puntos_valor || Number(nuevoCodigo.puntos_valor) <= 0) {
      setErrMsg("Los puntos deben ser mayores a 0.");
      return;
    }
    setBusy(true);
    try {
      await commandMutation.mutateAsync({
        method: "post",
        path: "/admin/codigos",
        body: {
          codigo: nuevoCodigo.codigo.trim().toUpperCase(),
          puntos_valor: Number(nuevoCodigo.puntos_valor),
          usos_maximos: Number(nuevoCodigo.usos_maximos) >= 0 ? Number(nuevoCodigo.usos_maximos) : 1,
          fecha_expiracion: nuevoCodigo.fecha_expiracion ? new Date(nuevoCodigo.fecha_expiracion).toISOString() : null,
        },
      });
      setNuevoCodigo({ codigo: "", puntos_valor: 0, usos_maximos: 1, fecha_expiracion: "" });
      setOkMsg("Codigo creado.");
      await refreshQueries([["admin", "codigos"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCodigo(codigo: Codigo) {
    setErrMsg("");
    try {
      await commandMutation.mutateAsync({
        method: "patch",
        path: `/admin/codigos/${codigo.id}`,
        body: { activo: !codigo.activo },
      });
      await refreshQueries([["admin", "codigos"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    }
  }

  async function crearUsuario() {
    setErrMsg("");
    setOkMsg("");
    setBusy(true);
    try {
      await commandMutation.mutateAsync({
        method: "post",
        path: "/admin/usuarios",
        body: {
          nombre: nuevoUsuario.nombre,
          email: nuevoUsuario.email,
          password: nuevoUsuario.password,
          rol: nuevoUsuario.rol,
          dni: nuevoUsuario.rol === "cliente" ? nuevoUsuario.dni : undefined,
        },
      });
      setNuevoUsuario({ email: "", password: "", nombre: "", rol: "vendedor", dni: "" });
      setOkMsg("Usuario creado.");
      await refreshQueries([["admin", "usuarios"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function actualizarEstadoCanje(id: number, estado: "entregado" | "cancelado") {
    if (!window.confirm(`Cambiar estado a ${estado}?`)) return;
    setErrMsg("");
    try {
      await commandMutation.mutateAsync({
        method: "patch",
        path: `/admin/canjes/${id}`,
        body: { estado },
      });
      await refreshQueries([["admin", "canjes"], ["admin", "stats"]]);
    } catch (error) {
      setErrMsg((error as Error).message);
    }
  }

  async function guardarPagina(slug: "sobre-nosotros" | "terminos") {
    const draft = slug === "sobre-nosotros" ? sobreDraft : terminosDraft;
    const setDraft = slug === "sobre-nosotros" ? setSobreDraft : setTerminosDraft;
    setDraft((prev) => ({ ...prev, okMsg: "", errMsg: "" }));
    try {
      await commandMutation.mutateAsync({
        method: "put",
        path: `/admin/paginas/${slug}`,
        body: {
          titulo: draft.titulo,
          contenido: draft.contenido,
        },
      });
      setDraft((prev) => ({ ...prev, okMsg: "Guardado correctamente." }));
      await queryClient.invalidateQueries({ queryKey: ["admin", "paginas", slug] });
    } catch (error) {
      setDraft((prev) => ({ ...prev, errMsg: (error as Error).message }));
    }
  }

  async function subirImagenSobre(file: File) {
    try {
      const upload = await uploadImageMutation.mutateAsync(file);
      setSobreDraft((prev) => ({
        ...prev,
        contenido: `${prev.contenido}\n\n![imagen](${upload.url})\n`,
      }));
    } catch (error) {
      setSobreDraft((prev) => ({ ...prev, errMsg: (error as Error).message }));
    }
  }

  const stats = statsQuery.data;

  return (
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <p className="admin-brand-name">Administrador</p>
          <p className="admin-brand-role">Panel</p>
        </div>

        <nav className="admin-nav">
          <span className="admin-nav-section">General</span>
          <button className={`admin-nav-btn ${tab === "inicio" ? "active" : ""}`} onClick={() => setTab("inicio")}>
            Inicio
          </button>

          <span className="admin-nav-section">Gestion</span>
          <button className={`admin-nav-btn ${tab === "usuarios" ? "active" : ""}`} onClick={() => setTab("usuarios")}>
            Usuarios
          </button>
          <button className={`admin-nav-btn ${tab === "productos" ? "active" : ""}`} onClick={() => setTab("productos")}>
            Productos
          </button>
          <button className={`admin-nav-btn ${tab === "categorias" ? "active" : ""}`} onClick={() => setTab("categorias")}>
            Categorias
          </button>
          <button className={`admin-nav-btn ${tab === "transacciones" ? "active" : ""}`} onClick={() => setTab("transacciones")}>
            Transacciones
          </button>
          <button className={`admin-nav-btn ${tab === "canjes" ? "active" : ""}`} onClick={() => setTab("canjes")}>
            Canjes
          </button>
          <button className={`admin-nav-btn ${tab === "codigos" ? "active" : ""}`} onClick={() => setTab("codigos")}>
            Codigos
          </button>

          <span className="admin-nav-section">Configuracion</span>
          <button className={`admin-nav-btn ${tab === "crear" ? "active" : ""}`} onClick={() => setTab("crear")}>
            Crear usuario
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <h1 className="admin-topbar-title">Panel de administracion</h1>
            <p className="admin-topbar-sub">Resumen del programa de puntos</p>
          </div>
          <div className="admin-topbar-date">{new Date().toLocaleDateString("es-AR")}</div>
        </div>

        <div className="admin-content">
          <div className="admin-stats">
            <div className="admin-stat-card">
              <p className="admin-stat-label">Clientes</p>
              <p className="admin-stat-value">{stats?.clientes ?? "-"}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Productos activos</p>
              <p className="admin-stat-value">{stats?.productos ?? "-"}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Canjes pendientes</p>
              <p className="admin-stat-value accent">{stats?.canjes_pendientes ?? "-"}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Puntos emitidos</p>
              <p className="admin-stat-value">{stats?.puntos_emitidos ?? "-"}</p>
            </div>
          </div>

          {errMsg ? <div className="adm-msg-err" style={{ marginBottom: "1rem" }}>{errMsg}</div> : null}
          {okMsg ? <div className="adm-msg-ok" style={{ marginBottom: "1rem" }}>{okMsg}</div> : null}

          {tab === "inicio" ? (
            <>
              <div className="admin-section-header">
                <h2 className="admin-section-title">Ultimos movimientos</h2>
                <button className="adm-btn-link" onClick={() => setTab("transacciones")}>
                  Ver todos
                </button>
              </div>

              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Tipo</th>
                        <th>Puntos</th>
                        <th>Descripcion</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.slice(0, 12).map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>{movimiento.usuario_nombre}</td>
                          <td>{movimiento.tipo}</td>
                          <td className={movimiento.puntos >= 0 ? "adm-pts-pos" : "adm-pts-neg"}>
                            {movimiento.puntos >= 0 ? "+" : ""}
                            {movimiento.puntos}
                          </td>
                          <td>{movimiento.descripcion || "-"}</td>
                          <td>{formatDate(movimiento.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {tab === "usuarios" ? (
            <>
              <div className="admin-section-header">
                <h2 className="admin-section-title">Usuarios registrados</h2>
                <button className="adm-btn-link" onClick={() => setTab("crear")}>
                  Crear usuario
                </button>
              </div>

              <div className="adm-list-search">
                <input
                  className="adm-input"
                  placeholder="Buscar por nombre, email, DNI, rol o saldo..."
                  value={busquedaUsuarios}
                  onChange={(event) => setBusquedaUsuarios(event.target.value)}
                />
              </div>

              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>DNI</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="adm-empty">No hay usuarios que coincidan con la busqueda.</div>
                          </td>
                        </tr>
                      ) : null}
                      {usuariosFiltrados.map((usuario) => (
                        <Fragment key={usuario.id}>
                          <tr>
                            <td>{usuario.nombre}</td>
                            <td>{usuario.email}</td>
                            <td>{usuario.rol}</td>
                            <td>{usuario.dni || "-"}</td>
                            <td>{usuario.puntos_saldo}</td>
                            <td>
                              <span className={`adm-badge ${usuario.activo ? "adm-badge-active" : "adm-badge-inactive"}`}>
                                {usuario.activo ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td>
                              <div className="adm-user-actions">
                                {usuario.rol === "cliente" ? (
                                  <button className="adm-btn-link" onClick={() => abrirAsignacion(usuario)}>
                                    Asignar puntos
                                  </button>
                                ) : null}
                                <button
                                  className={usuario.activo ? "adm-btn-danger" : "adm-btn-success"}
                                  onClick={() => toggleUsuarioActivo(usuario)}
                                >
                                  {usuario.activo ? "Desactivar" : "Activar"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {asignacionUsuarioId === usuario.id ? (
                            <tr>
                              <td colSpan={7}>
                                <div className="adm-inline-points-box">
                                  <p className="adm-inline-points-title">Asignar puntos a {usuario.nombre}</p>
                                  <div className="adm-inline-points-grid">
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      className="adm-input"
                                      placeholder="Puntos a asignar"
                                      value={asignacionPuntos}
                                      onChange={(event) => setAsignacionPuntos(event.target.value)}
                                    />
                                    <input
                                      className="adm-input"
                                      placeholder="Descripcion (opcional)"
                                      value={asignacionDescripcion}
                                      onChange={(event) => setAsignacionDescripcion(event.target.value)}
                                    />
                                  </div>
                                  <div className="adm-inline-points-actions">
                                    <button className="adm-btn-primary adm-btn-inline" disabled={busy} onClick={asignarPuntosManual}>
                                      {busy ? "Asignando..." : "Confirmar asignacion"}
                                    </button>
                                    <button className="adm-btn-secondary adm-btn-inline" onClick={cancelarAsignacion}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {tab === "productos" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionTitle title="Nuevo producto" />

              <div className="admin-card admin-card-padded" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div className="adm-form-grid">
                  <div className="adm-field">
                    <label className="adm-label">Nombre</label>
                    <input className="adm-input" value={nuevoProducto.nombre} onChange={(event) => setNuevoProducto((prev) => ({ ...prev, nombre: event.target.value }))} />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">Categoria</label>
                    <select className="adm-input" value={nuevoProducto.categoria} onChange={(event) => setNuevoProducto((prev) => ({ ...prev, categoria: event.target.value }))}>
                      <option value="">Sin categoria</option>
                      {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="adm-field">
                  <label className="adm-label">Descripcion</label>
                  <textarea className="adm-input" value={nuevoProducto.descripcion} onChange={(event) => setNuevoProducto((prev) => ({ ...prev, descripcion: event.target.value }))} />
                </div>

                <div className="adm-form-grid">
                  <div className="adm-field">
                    <label className="adm-label">Puntos requeridos</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="adm-input"
                      placeholder="Ej: 100"
                      value={nuevoProducto.puntos_requeridos}
                      onChange={(event) => {
                        const v = event.target.value;
                        setNuevoProducto((prev) => ({ ...prev, puntos_requeridos: v === "" ? "" : Number(v) }));
                      }}
                    />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">Puntos acumulables</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="adm-input"
                      placeholder="Opcional"
                      value={nuevoProducto.puntos_acumulables}
                      onChange={(event) => {
                        const v = event.target.value;
                        setNuevoProducto((prev) => ({ ...prev, puntos_acumulables: v === "" ? "" : Number(v) }));
                      }}
                    />
                  </div>
                </div>

                <div className="adm-field">
                  <label className="adm-label">URL de imagen</label>
                  <input className="adm-input" value={nuevoProducto.imagen_url} onChange={(event) => setNuevoProducto((prev) => ({ ...prev, imagen_url: event.target.value }))} />
                </div>

                <div className="adm-upload">
                  <label className="adm-label" style={{ justifyContent: "center", cursor: "pointer" }}>
                    Subir imagen
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        uploadPreview(file, (preview) => setNuevoProducto((prev) => ({ ...prev, imagen_file: file, imagen_preview: preview })));
                      }}
                    />
                  </label>
                </div>

                {nuevoProducto.imagen_preview ? <img src={nuevoProducto.imagen_preview} className="admin-preview-img" alt="preview nuevo producto" /> : null}

                <button className="adm-btn-primary" disabled={busy} onClick={crearProducto}>
                  {busy ? "Creando..." : "Crear producto"}
                </button>
              </div>

              <SectionTitle title="Productos existentes" />
              <div className="adm-list-search">
                <input
                  className="adm-input"
                  placeholder="Buscar producto por nombre, categoria, descripcion o puntos..."
                  value={busquedaProductos}
                  onChange={(event) => setBusquedaProductos(event.target.value)}
                />
              </div>
              <div className="admin-card">
                {productosFiltrados.length === 0 ? <div className="adm-empty">No hay productos que coincidan con la busqueda.</div> : null}
                {productosFiltrados.map((producto) => (
                  <div key={producto.id} className="adm-product-row">
                    {editId === producto.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div className="adm-form-grid">
                          <input className="adm-input" value={editDraft.nombre} onChange={(event) => setEditDraft((prev) => ({ ...prev, nombre: event.target.value }))} />
                          <select className="adm-input" value={editDraft.categoria} onChange={(event) => setEditDraft((prev) => ({ ...prev, categoria: event.target.value }))}>
                            <option value="">Sin categoria</option>
                            {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                        </div>

                        <textarea className="adm-input" value={editDraft.descripcion} onChange={(event) => setEditDraft((prev) => ({ ...prev, descripcion: event.target.value }))} />

                        <div className="adm-form-grid">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="adm-input"
                            placeholder="Puntos requeridos"
                            value={editDraft.puntos_requeridos}
                            onChange={(event) => {
                              const v = event.target.value;
                              setEditDraft((prev) => ({ ...prev, puntos_requeridos: v === "" ? "" : Number(v) }));
                            }}
                          />
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className="adm-input"
                            placeholder="Puntos acumulables"
                            value={editDraft.puntos_acumulables}
                            onChange={(event) => {
                              const v = event.target.value;
                              setEditDraft((prev) => ({ ...prev, puntos_acumulables: v === "" ? "" : Number(v) }));
                            }}
                          />
                        </div>

                        <input className="adm-input" value={editDraft.imagen_url} onChange={(event) => setEditDraft((prev) => ({ ...prev, imagen_url: event.target.value }))} />

                        <div className="adm-upload">
                          <label className="adm-label" style={{ justifyContent: "center", cursor: "pointer" }}>
                            Reemplazar imagen
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                uploadPreview(file, (preview) => setEditDraft((prev) => ({ ...prev, imagen_file: file, imagen_preview: preview })));
                              }}
                            />
                          </label>
                        </div>

                        {editDraft.imagen_preview ? <img src={editDraft.imagen_preview} className="admin-preview-img" alt="preview edit" /> : null}

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="adm-btn-primary" style={{ flex: 2 }} onClick={() => saveEdit(producto.id)}>
                            Guardar cambios
                          </button>
                          <button className="adm-btn-secondary" onClick={() => setEditId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-producto-resumen">
                        <div>
                          <p className="admin-producto-title">{producto.nombre}</p>
                          <p className="admin-producto-sub">
                            {producto.categoria || "Sin categoria"} - {producto.puntos_requeridos} pts
                          </p>
                        </div>
                        <div className="admin-producto-actions">
                          <button className="adm-btn-link" onClick={() => startEdit(producto)}>
                            Editar
                          </button>
                          <button className={producto.activo ? "adm-btn-danger" : "adm-btn-success"} onClick={() => toggleProductoActivo(producto)}>
                            {producto.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "categorias" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionTitle title="Nueva categoria" />
              <div className="admin-card admin-card-padded" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <input className="adm-input" placeholder="Nombre" value={nuevaCategoria.nombre} onChange={(event) => setNuevaCategoria((prev) => ({ ...prev, nombre: event.target.value }))} />
                <button className="adm-btn-primary" disabled={busy} onClick={crearCategoria}>
                  {busy ? "Creando..." : "Crear categoria"}
                </button>
              </div>

              <SectionTitle title="Categorias existentes" />
              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Creada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorias.map((categoria) => (
                        <tr key={categoria.id}>
                          <td>{categoria.nombre}</td>
                          <td>{formatDate(categoria.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "transacciones" ? (
            <>
              <SectionTitle title="Historial de movimientos" />
              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Tipo</th>
                        <th>Puntos</th>
                        <th>Descripcion</th>
                        <th>Admin</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td>{movimiento.usuario_nombre}</td>
                          <td>{movimiento.tipo}</td>
                          <td className={movimiento.puntos >= 0 ? "adm-pts-pos" : "adm-pts-neg"}>
                            {movimiento.puntos >= 0 ? "+" : ""}
                            {movimiento.puntos}
                          </td>
                          <td>{movimiento.descripcion || "-"}</td>
                          <td>{movimiento.admin_nombre || "-"}</td>
                          <td>{formatDate(movimiento.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {tab === "canjes" ? (
            <>
              <SectionTitle title="Gestion de canjes" />
              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Producto</th>
                        <th>Codigo</th>
                        <th>Puntos</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {canjes.map((canje) => (
                        <tr key={canje.id}>
                          <td>
                            {canje.cliente_nombre}
                            <br />
                            <span style={{ color: "#8B5A30", fontSize: "0.75rem" }}>{canje.cliente_dni}</span>
                          </td>
                          <td>{canje.producto_nombre}</td>
                          <td><span className="adm-code-chip">{getCanjeCode(canje)}</span></td>
                          <td>{canje.puntos_usados}</td>
                          <td>{canje.estado}</td>
                          <td>{formatDate(canje.created_at)}</td>
                          <td>
                            {canje.estado === "pendiente" ? (
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <button className="adm-btn-primary" style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }} onClick={() => actualizarEstadoCanje(canje.id, "entregado")}>
                                  Entregar
                                </button>
                                <button className="adm-btn-danger" style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }} onClick={() => actualizarEstadoCanje(canje.id, "cancelado")}>
                                  Anular
                                </button>
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          {tab === "codigos" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionTitle title="Nuevo codigo promocional" />
              <div className="admin-card admin-card-padded" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div className="adm-form-grid">
                  <input className="adm-input" placeholder="Codigo" value={nuevoCodigo.codigo} onChange={(event) => setNuevoCodigo((prev) => ({ ...prev, codigo: event.target.value.toUpperCase() }))} />
                  <input type="number" className="adm-input" placeholder="Puntos" value={nuevoCodigo.puntos_valor} onChange={(event) => setNuevoCodigo((prev) => ({ ...prev, puntos_valor: Number(event.target.value) }))} />
                </div>
                <div className="adm-form-grid">
                  <input type="number" className="adm-input" placeholder="Usos maximos" value={nuevoCodigo.usos_maximos} onChange={(event) => setNuevoCodigo((prev) => ({ ...prev, usos_maximos: Number(event.target.value) }))} />
                  <input type="datetime-local" className="adm-input" value={nuevoCodigo.fecha_expiracion} onChange={(event) => setNuevoCodigo((prev) => ({ ...prev, fecha_expiracion: event.target.value }))} />
                </div>
                <button className="adm-btn-primary" disabled={busy} onClick={crearCodigo}>
                  {busy ? "Creando..." : "Crear codigo"}
                </button>
              </div>

              <SectionTitle title="Codigos existentes" />
              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Puntos</th>
                        <th>Usos</th>
                        <th>Expira</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codigos.map((codigo) => (
                        <tr key={codigo.id}>
                          <td><span className="adm-code-chip">{codigo.codigo}</span></td>
                          <td>{codigo.puntos_valor}</td>
                          <td>{codigo.usos_actuales}/{codigo.usos_maximos}</td>
                          <td>{codigo.fecha_expiracion ? formatDate(codigo.fecha_expiracion) : "Sin vencimiento"}</td>
                          <td>{codigo.activo ? "Activo" : "Inactivo"}</td>
                          <td>
                            <button className={codigo.activo ? "adm-btn-danger" : "adm-btn-success"} onClick={() => toggleCodigo(codigo)}>
                              {codigo.activo ? "Desactivar" : "Activar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "crear" ? (
            <>
              <SectionTitle title="Crear usuario" />
              <div className="admin-card admin-card-padded" style={{ maxWidth: "520px", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <input className="adm-input" placeholder="Nombre" value={nuevoUsuario.nombre} onChange={(event) => setNuevoUsuario((prev) => ({ ...prev, nombre: event.target.value }))} />
                <input className="adm-input" placeholder="Email" value={nuevoUsuario.email} onChange={(event) => setNuevoUsuario((prev) => ({ ...prev, email: event.target.value }))} />
                <input type="password" className="adm-input" placeholder="Contrasena" value={nuevoUsuario.password} onChange={(event) => setNuevoUsuario((prev) => ({ ...prev, password: event.target.value }))} />
                <select className="adm-input" value={nuevoUsuario.rol} onChange={(event) => setNuevoUsuario((prev) => ({ ...prev, rol: event.target.value }))}>
                  <option value="vendedor">Vendedor</option>
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
                {nuevoUsuario.rol === "cliente" ? (
                  <input className="adm-input" placeholder="DNI" value={nuevoUsuario.dni} onChange={(event) => setNuevoUsuario((prev) => ({ ...prev, dni: event.target.value }))} />
                ) : null}
                <button className="adm-btn-primary" disabled={busy} onClick={crearUsuario}>
                  {busy ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </>
          ) : null}

          {tab === "sobre-nosotros" ? (
            <>
              <SectionTitle title="Quienes Somos" />
              <div className="adm-page-editor-grid">
                <div className="adm-page-editor-col">
                  <div className="adm-notepad">
                    <div className="adm-notepad-header">
                      <p className="adm-notepad-header-title">Editor Markdown</p>
                      <span className="adm-notepad-md-badge">MD</span>
                    </div>
                    <div className="adm-notepad-body">
                      <input className="adm-notepad-title-input" value={sobreDraft.titulo} onChange={(event) => setSobreDraft((prev) => ({ ...prev, titulo: event.target.value }))} placeholder="Titulo" />
                      <textarea className="adm-notepad-textarea adm-page-textarea" value={sobreDraft.contenido} onChange={(event) => setSobreDraft((prev) => ({ ...prev, contenido: event.target.value }))} placeholder="Contenido en markdown" />
                    </div>
                    <div className="adm-notepad-footer">
                      <label className="adm-btn-secondary" style={{ cursor: "pointer", textAlign: "center" }}>
                        Subir imagen
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void subirImagenSobre(file); }} />
                      </label>
                      <span className="adm-notepad-ok">{sobreDraft.okMsg}</span>
                      <span className="adm-notepad-err">{sobreDraft.errMsg}</span>
                      <button className="adm-notepad-save" onClick={() => guardarPagina("sobre-nosotros")}>
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                </div>
                <div className="adm-page-editor-col">
                  <div className="adm-notepad adm-notepad-preview">
                    <div className="adm-notepad-header">
                      <p className="adm-notepad-header-title">Preview</p>
                      <span className="adm-notepad-md-badge">LIVE</span>
                    </div>
                    <div className="adm-md-preview" dangerouslySetInnerHTML={{ __html: sobreHtml }} />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {tab === "terminos" ? (
            <>
              <SectionTitle title="Terminos y Condiciones" />
              <div className="adm-page-editor-grid">
                <div className="adm-page-editor-col">
                  <div className="adm-notepad">
                    <div className="adm-notepad-header">
                      <p className="adm-notepad-header-title">Editor Markdown</p>
                      <span className="adm-notepad-md-badge">MD</span>
                    </div>
                    <div className="adm-notepad-body">
                      <input className="adm-notepad-title-input" value={terminosDraft.titulo} onChange={(event) => setTerminosDraft((prev) => ({ ...prev, titulo: event.target.value }))} placeholder="Titulo" />
                      <textarea className="adm-notepad-textarea adm-page-textarea" value={terminosDraft.contenido} onChange={(event) => setTerminosDraft((prev) => ({ ...prev, contenido: event.target.value }))} placeholder="Contenido en markdown" />
                    </div>
                    <div className="adm-notepad-footer">
                      <span className="adm-notepad-ok">{terminosDraft.okMsg}</span>
                      <span className="adm-notepad-err">{terminosDraft.errMsg}</span>
                      <button className="adm-notepad-save" onClick={() => guardarPagina("terminos")}>
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                </div>
                <div className="adm-page-editor-col">
                  <div className="adm-notepad adm-notepad-preview">
                    <div className="adm-notepad-header">
                      <p className="adm-notepad-header-title">Preview</p>
                      <span className="adm-notepad-md-badge">LIVE</span>
                    </div>
                    <div className="adm-md-preview" dangerouslySetInnerHTML={{ __html: terminosHtml }} />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </section>
  );
}
