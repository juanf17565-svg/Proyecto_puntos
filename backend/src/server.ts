import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import "./db";

import authRoutes     from "./routes/auth";
import clienteRoutes  from "./routes/cliente";
import vendedorRoutes from "./routes/vendedor";
import adminRoutes    from "./routes/admin";
import productosRoutes from "./routes/productos";

const app = express();

app.use(cors());
app.use(express.json());

// ── Rutas ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date() }));

app.use("/api/auth",     authRoutes);
app.use("/api/productos", productosRoutes);   // público (catálogo)
app.use("/api/cliente",  clienteRoutes);
app.use("/api/vendedor", vendedorRoutes);
app.use("/api/admin",    adminRoutes);

// ── Manejo global de errores ───────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`🚀 API en http://localhost:${PORT}`));
