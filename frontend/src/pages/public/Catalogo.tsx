import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuthStore } from "../../store/authStore";
import type { Producto } from "../../types";

type CanjeProductoResponse = {
  canje_id: number;
  canje_codigo?: string | null;
  codigo_retiro?: string | null;
  nuevo_saldo: number;
  puntos_usados: number;
};

type CatalogToast = {
  msg: string;
  variant: "success" | "error" | "confirm" | "info";
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  autoHideMs?: number;
};

function isLegacyCanjeCode(code?: string | null): boolean {
  return Boolean(code && /^C0{2,}[A-Z0-9]*$/.test(code));
}

function getCanjeCode(data: CanjeProductoResponse): string | null {
  if (data.canje_codigo && !isLegacyCanjeCode(data.canje_codigo)) return data.canje_codigo;
  if (data.codigo_retiro && !isLegacyCanjeCode(data.codigo_retiro)) return data.codigo_retiro;
  return null;
}

export function Catalogo() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUserPoints = useAuthStore((state) => state.updateUserPoints);
  const isCliente = user?.rol === "cliente";

  const [categoriaActiva, setCategoriaActiva] = useState("");
  const [maxPuntos, setMaxPuntos] = useState(0);
  const [productoModal, setProductoModal] = useState<Producto | null>(null);
  const [imgZoomed, setImgZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const hasDragged = useRef(false);
  const [toast, setToast] = useState<CatalogToast | null>(null);

  const productosQuery = useQuery({
    queryKey: ["productos"],
    queryFn: () => api.get<Producto[]>("/productos"),
  });

  const categoriasQuery = useQuery({
    queryKey: ["productos", "categorias"],
    queryFn: () => api.get<string[]>("/productos/categorias"),
  });

  const productos = productosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];

  const puntosMax = useMemo(() => {
    if (!productos.length) return 1000;
    const maxRaw = Math.max(...productos.map((producto) => producto.puntos_requeridos || 0));
    return Math.max(50, Math.ceil(maxRaw / 50) * 50);
  }, [productos]);

  useEffect(() => {
    setMaxPuntos(puntosMax);
  }, [puntosMax]);

  useEffect(() => {
    document.body.classList.add("catalog-background");
    return () => {
      document.body.classList.remove("catalog-background");
    };
  }, []);

  useEffect(() => {
    if (!toast?.autoHideMs) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, toast.autoHideMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((producto) => {
      const coincideCategoria = !categoriaActiva || producto.categoria === categoriaActiva;
      const coincidePuntos = !maxPuntos || producto.puntos_requeridos <= maxPuntos;
      return coincideCategoria && coincidePuntos;
    });
  }, [productos, categoriaActiva, maxPuntos]);

  const canjearMutation = useMutation({
    mutationFn: (productoId: number) =>
      api.post<CanjeProductoResponse>("/cliente/canjear-producto", {
        producto_id: productoId,
    }),
    onSuccess: (data) => {
      const codigoRetiro = getCanjeCode(data);
      updateUserPoints(data.nuevo_saldo);
      setToast({
        msg: codigoRetiro
          ? `Canje exitoso. Codigo de retiro: ${codigoRetiro}`
          : "Canje exitoso. El codigo de retiro queda disponible en Mis Canjes.",
        variant: "success",
        actionLabel: "Ver en mi cuenta",
        onAction: () => navigate("/mi-perfil#mis-canjes"),
        dismissLabel: "Cerrar",
        autoHideMs: 7000,
      });
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase();
      if (message.includes("completa tus datos obligatorios")) {
        setToast({
          msg: error.message,
          variant: "error",
          actionLabel: "Completar mi perfil",
          onAction: () => navigate("/mi-perfil"),
          dismissLabel: "Cerrar",
          autoHideMs: 9000,
        });
        return;
      }
      setToast({
        msg: error.message,
        variant: "error",
        dismissLabel: "Cerrar",
        autoHideMs: 7000,
      });
    },
  });

  const loading = productosQuery.isLoading || categoriasQuery.isLoading;

  return (
    <section className="catalog-page">
      <div className="catalog-top-shell">
        <div className="catalog-header">
          <h1 className="catalog-title">Catalogo de productos</h1>
          <p className="catalog-subtitle">Canjea tus puntos por productos exclusivos Nande</p>
        </div>

        {isCliente ? (
          <div className="catalog-user-banner">
            <div>
              <p>
                Hola, <strong>{user.nombre}</strong>
              </p>
              <p style={{ fontSize: "0.8rem", color: "#A08060", marginTop: "0.15rem" }}>Tus puntos disponibles</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="banner-pts">{user.puntos_saldo ?? 0}</p>
              <p className="banner-pts-label">puntos</p>
            </div>
          </div>
        ) : null}

      </div>
      <div className="catalog-products-shell">
        {!loading ? (
          <div className="catalog-filters">
            <div className="catalog-filter-dropdown" style={{ position: "relative" }}>
              <select
                className="catalog-dropdown-btn"
                value={categoriaActiva}
                onChange={(event) => setCategoriaActiva(event.target.value)}
              >
                <option value="">Todas las categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter-range">
              <div className="catalog-filter-range-header">
                <label className="catalog-filter-label">Puntos maximos</label>
                <span className="catalog-filter-range-val">{maxPuntos} pts</span>
              </div>
              <input
                type="range"
                className="catalog-range-slider"
                min={0}
                max={puntosMax}
                step={50}
                value={maxPuntos}
                onChange={(event) => setMaxPuntos(Number(event.target.value))}
              />
            </div>

            <button
              className="catalog-filter-clear"
              onClick={() => {
                setCategoriaActiva("");
                setMaxPuntos(puntosMax);
              }}
            >
              Limpiar
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="catalog-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="product-card">
                <div className="product-card-placeholder" />
                <div className="product-card-body">
                  <div className="catalog-skeleton" style={{ height: "1rem", borderRadius: "6px" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="catalog-grid">
            {productosFiltrados.length === 0 ? (
              <div className="catalog-empty">
                <h3>Sin productos disponibles</h3>
                <p>Prueba con otros filtros.</p>
              </div>
            ) : null}

            {productosFiltrados.map((producto) => (
              <div key={producto.id} className="product-card">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} className="product-card-img" />
                ) : (
                  <div className="product-card-placeholder" />
                )}

                {producto.categoria ? <span className="product-card-cat">{producto.categoria}</span> : null}

                <div className="product-card-body">
                  <p className="product-card-name">{producto.nombre}</p>
                  <p className="product-card-desc">{producto.descripcion || "Producto disponible para canje."}</p>

                  <div className="product-card-points">
                    <div className="product-card-row">
                      <span>Puntos para canjear</span>
                      <span className="cost">{producto.puntos_requeridos} pts</span>
                    </div>
                    {producto.puntos_acumulables ? (
                      <>
                        <div className="product-card-divider" />
                        <div className="product-card-row">
                          <span>Puntos que sumas al comprar</span>
                          <span className="earn">+{producto.puntos_acumulables} pts</span>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <button
                    className="product-card-btn product-card-btn-ver"
                    onClick={() => { setProductoModal(producto); setImgZoomed(false); setPan({ x: 0, y: 0 }); setZoomOrigin("50% 50%"); }}
                  >
                    Ver producto
                  </button>

                  {user ? (
                    <button
                      className="product-card-btn product-card-btn-canjear"
                      style={{ marginTop: "0.5rem" }}
                      disabled={canjearMutation.isPending}
                      onClick={() => {
                        if (user.rol !== "cliente") {
                          setToast({
                            msg: "Solo los clientes pueden canjear productos.",
                            variant: "info",
                            actionLabel: "Ir a login",
                            onAction: () => navigate("/login"),
                            dismissLabel: "Cerrar",
                            autoHideMs: 7000,
                          });
                          return;
                        }
                        setToast({
                          msg: `Canjear ${producto.nombre} por ${producto.puntos_requeridos} pts?`,
                          variant: "confirm",
                          actionLabel: "Confirmar canje",
                          onAction: () => canjearMutation.mutate(producto.id),
                          dismissLabel: "Cancelar",
                        });
                      }}
                    >
                      Canjear producto
                    </button>
                  ) : (
                    <Link to="/login" className="product-card-btn product-card-btn-login" style={{ marginTop: "0.5rem" }}>
                      Iniciar sesion para canjear
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast ? (
        toast.variant === "confirm" ? (
          <div className="catalog-confirm-overlay" onClick={() => setToast(null)}>
            <div
              className={`catalog-float-toast catalog-float-toast-${toast.variant} catalog-float-toast-front`}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="catalog-float-toast-msg">{toast.msg}</p>
              <div className="catalog-float-toast-actions">
                {toast.actionLabel && toast.onAction ? (
                  <button
                    className="catalog-float-toast-btn-primary"
                    onClick={() => {
                      toast.onAction?.();
                      setToast(null);
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                ) : null}
                <button className="catalog-float-toast-btn-secondary" onClick={() => setToast(null)}>
                  {toast.dismissLabel ?? "Cerrar"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`catalog-float-toast catalog-float-toast-${toast.variant}`}>
            <p className="catalog-float-toast-msg">{toast.msg}</p>
            <div className="catalog-float-toast-actions">
              {toast.actionLabel && toast.onAction ? (
                <button
                  className="catalog-float-toast-btn-primary"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
              <button className="catalog-float-toast-btn-secondary" onClick={() => setToast(null)}>
                {toast.dismissLabel ?? "Cerrar"}
              </button>
            </div>
          </div>
        )
      ) : null}

      {productoModal ? (
        <div className="producto-modal-overlay" onClick={() => setProductoModal(null)}>
          <div className="producto-modal" onClick={(e) => e.stopPropagation()}>
            <button className="producto-modal-close" onClick={() => setProductoModal(null)}>✕</button>

            <div className="producto-modal-img-wrap">
              {productoModal.imagen_url ? (
                <img
                  src={productoModal.imagen_url}
                  alt={productoModal.nombre}
                  className="producto-modal-img"
                  style={{
                    transformOrigin: zoomOrigin,
                    transform: imgZoomed ? `translate(${pan.x}px, ${pan.y}px) scale(2.4)` : "none",
                    cursor: !imgZoomed ? "zoom-in" : "grab",
                    transition: dragRef.current?.active ? "none" : "transform 0.3s ease",
                  }}
                  onClick={(e) => {
                    if (hasDragged.current) return;
                    if (imgZoomed) {
                      setImgZoomed(false);
                      setPan({ x: 0, y: 0 });
                      setZoomOrigin("50% 50%");
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setZoomOrigin(`${x}% ${y}%`);
                      setImgZoomed(true);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!imgZoomed) return;
                    e.preventDefault();
                    hasDragged.current = false;
                    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
                  }}
                  onMouseMove={(e) => {
                    if (!dragRef.current?.active) return;
                    const dx = e.clientX - dragRef.current.startX;
                    const dy = e.clientY - dragRef.current.startY;
                    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
                    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
                  }}
                  onMouseUp={() => { if (dragRef.current) dragRef.current.active = false; }}
                  onMouseLeave={() => { if (dragRef.current) dragRef.current.active = false; }}
                  onTouchStart={(e) => {
                    if (!imgZoomed) return;
                    const t = e.touches[0];
                    hasDragged.current = false;
                    dragRef.current = { active: true, startX: t.clientX, startY: t.clientY, panX: pan.x, panY: pan.y };
                  }}
                  onTouchMove={(e) => {
                    if (!dragRef.current?.active) return;
                    e.preventDefault();
                    const t = e.touches[0];
                    const dx = t.clientX - dragRef.current.startX;
                    const dy = t.clientY - dragRef.current.startY;
                    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
                    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
                  }}
                  onTouchEnd={() => { if (dragRef.current) dragRef.current.active = false; }}
                  title={imgZoomed ? "Arrastrá para mover · Click para alejar" : "Click para hacer zoom"}
                />
              ) : (
                <div className="product-card-placeholder" style={{ height: "260px" }} />
              )}
              {productoModal.categoria ? (
                <span className="product-card-cat">{productoModal.categoria}</span>
              ) : null}
            </div>

            <div className="producto-modal-body">
              <p className="producto-modal-name">{productoModal.nombre}</p>
              <p className="producto-modal-desc">{productoModal.descripcion || "Producto disponible para canje."}</p>

              <div className="product-card-points">
                <div className="product-card-row">
                  <span>Puntos para canjear</span>
                  <span className="cost">{productoModal.puntos_requeridos} pts</span>
                </div>
                {productoModal.puntos_acumulables ? (
                  <>
                    <div className="product-card-divider" />
                    <div className="product-card-row">
                      <span>Puntos que sumas al comprar</span>
                      <span className="earn">+{productoModal.puntos_acumulables} pts</span>
                    </div>
                  </>
                ) : null}
              </div>

              {user ? (
                <button
                  className="product-card-btn product-card-btn-canjear"
                  disabled={canjearMutation.isPending}
                  onClick={() => {
                    if (user.rol !== "cliente") {
                      setToast({
                        msg: "Solo los clientes pueden canjear productos.",
                        variant: "info",
                        actionLabel: "Ir a login",
                        onAction: () => navigate("/login"),
                        dismissLabel: "Cerrar",
                        autoHideMs: 7000,
                      });
                      return;
                    }
                    setToast({
                      msg: `Canjear ${productoModal.nombre} por ${productoModal.puntos_requeridos} pts?`,
                      variant: "confirm",
                      actionLabel: "Confirmar canje",
                      onAction: () => {
                        canjearMutation.mutate(productoModal.id);
                        setProductoModal(null);
                      },
                      dismissLabel: "Cancelar",
                    });
                  }}
                >
                  Canjear producto
                </button>
              ) : (
                <Link to="/login" className="product-card-btn product-card-btn-login">
                  Iniciar sesion para canjear
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
