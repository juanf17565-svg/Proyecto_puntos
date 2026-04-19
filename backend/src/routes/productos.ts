import { Router } from "express";
import { pool } from "../db";

const router = Router();

// Catálogo público — no requiere autenticación
router.get("/", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, nombre, descripcion, imagen_url, categoria, puntos_requeridos, puntos_acumulables
     FROM productos
     WHERE activo = 1
     ORDER BY nombre ASC`
  );
  res.json(rows);
});

export default router;
