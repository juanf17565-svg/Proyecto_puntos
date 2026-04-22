import { Router } from "express";
import { pool } from "../db";

const router = Router();

// Catálogo público — no requiere autenticación
// Query params opcionales:
//   ?categoria=alfajores   → filtra por categoría (exacto, case-insensitive)
//   ?max_puntos=500        → filtra productos con puntos_requeridos <= N
router.get("/", async (req, res) => {
  const { categoria, max_puntos } = req.query;

  const conditions: string[] = ["activo = 1"];
  const params: (string | number)[] = [];

  if (categoria && typeof categoria === "string") {
    conditions.push("LOWER(categoria) = LOWER(?)");
    params.push(categoria.trim());
  }

  if (max_puntos) {
    const pts = parseInt(String(max_puntos), 10);
    if (!isNaN(pts) && pts > 0) {
      conditions.push("puntos_requeridos <= ?");
      params.push(pts);
    }
  }

  const where = conditions.join(" AND ");
  const [rows] = await pool.query(
    `SELECT id, nombre, descripcion, imagen_url, categoria, puntos_requeridos, puntos_acumulables
     FROM productos
     WHERE ${where}
     ORDER BY puntos_requeridos ASC, nombre ASC`,
    params
  );
  res.json(rows);
});

// GET /productos/categorias — lista las categorías disponibles
router.get("/categorias", async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT DISTINCT categoria FROM productos WHERE activo = 1 AND categoria IS NOT NULL ORDER BY categoria ASC"
  );
  const categorias = (rows as { categoria: string }[]).map(r => r.categoria);
  res.json(categorias);
});

export default router;
