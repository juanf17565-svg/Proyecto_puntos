import "dotenv/config";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "./db";

import authRoutes     from "./routes/auth";
import clienteRoutes  from "./routes/cliente";
import vendedorRoutes from "./routes/vendedor";
import adminRoutes    from "./routes/admin";
import productosRoutes from "./routes/productos";
import paginasRoutes  from "./routes/paginas";

const app = express();

// ── Proxy: req.ip real cuando corremos detrás de Nginx/Docker/CF ──
// Con un único hop de proxy; aumentar si hay más capas.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
  app.set("trust proxy", Number.isNaN(Number(TRUST_PROXY)) ? TRUST_PROXY : Number(TRUST_PROXY));
}

// ── Seguridad: headers HTTP seguros ───────────────────────
app.use(helmet());

// ── CORS: solo dominios permitidos ────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (Postman, apps móviles, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS no permitido para este origen"));
  },
  credentials: true,
}));

app.use(express.json());

// ── Servir imágenes subidas estáticamente ─────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

// ── Rate limiting: rutas de autenticación ─────────────────
// Máx 15 intentos por IP cada 15 minutos (anti fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Demasiados intentos. Esperá 15 minutos e intentá de nuevo." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Rate limiting: API general ────────────────────────────
// Máx 1000 requests por IP cada 15 minutos — aplica a todos los roles.
// (Bypass por admin en base al JWT se quitó: un token robado/obsoleto no
// debería saltarse el limiter, y validar "activo" en DB en cada request
// agrega latencia innecesaria.)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Demasiadas solicitudes. Intentá en unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", generalLimiter);

// ── Rutas ──────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date() }));

app.use("/api/auth",     authLimiter, authRoutes);
app.use("/api/productos", productosRoutes);   // público (catálogo)
app.use("/api/paginas",  paginasRoutes);      // público (sobre nosotros, términos)
app.use("/api/cliente",  clienteRoutes);
app.use("/api/vendedor", vendedorRoutes);
app.use("/api/admin",    adminRoutes);

// ── Manejo global de errores ───────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`🚀 API en http://localhost:${PORT}`));
