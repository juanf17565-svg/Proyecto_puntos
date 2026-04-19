import { Router } from "express";
import { z } from "zod";
import { pool, qOne, qAll, qRun } from "../db";
import { requireAuth, requireRole } from "../auth";

const router = Router();
router.use(requireAuth, requireRole("cliente"));

// ── GET /cliente/me ──────────────────────────────────────────────────────────

router.get("/me", async (req, res) => {
  const user = await qOne(pool,
    "SELECT id, nombre, email, dni, puntos_saldo, codigo_invitacion FROM usuarios WHERE id = ?",
    [req.user!.id]
  );
  res.json(user);
});

// ── GET /cliente/mi-codigo ───────────────────────────────────────────────────

router.get("/mi-codigo", async (req, res) => {
  const user = await qOne(pool, "SELECT codigo_invitacion FROM usuarios WHERE id = ?", [req.user!.id]);
  const total = await qOne(pool, "SELECT COUNT(*) AS c FROM referidos WHERE invitador_id = ?", [req.user!.id]);
  res.json({ codigo: user?.codigo_invitacion, total_invitados: total?.c ?? 0 });
});

// ── GET /cliente/movimientos ─────────────────────────────────────────────────

router.get("/movimientos", async (req, res) => {
  const rows = await qAll(pool,
    `SELECT id, tipo, puntos, descripcion, referencia_tipo, created_at
     FROM movimientos_puntos WHERE usuario_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    [req.user!.id]
  );
  res.json(rows);
});

// ── GET /cliente/canjes ──────────────────────────────────────────────────────

router.get("/canjes", async (req, res) => {
  const rows = await qAll(pool,
    `SELECT c.id, c.puntos_usados, c.estado, c.fecha_limite_retiro, c.notas, c.created_at,
            p.nombre AS producto_nombre, p.imagen_url AS producto_imagen
     FROM canjes c JOIN productos p ON p.id = c.producto_id
     WHERE c.usuario_id = ? ORDER BY c.created_at DESC`,
    [req.user!.id]
  );
  res.json(rows);
});

// ── POST /cliente/canjear-codigo ─────────────────────────────────────────────

router.post("/canjear-codigo", async (req, res) => {
  const schema = z.object({ codigo: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Código requerido" }); return; }

  const codigo = parsed.data.codigo.toUpperCase().trim();
  const usuarioId = req.user!.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const c = await qOne(conn,
      "SELECT id, puntos_valor, usos_maximos, usos_actuales, fecha_expiracion, activo FROM codigos_puntos WHERE codigo = ?",
      [codigo]
    );
    if (!c)                                                         { res.status(404).json({ error: "Código no encontrado" }); return; }
    if (!c.activo)                                                  { res.status(400).json({ error: "Código inactivo" }); return; }
    if (c.fecha_expiracion && new Date(c.fecha_expiracion) < new Date()) { res.status(400).json({ error: "El código expiró" }); return; }
    if (c.usos_maximos > 0 && c.usos_actuales >= c.usos_maximos)   { res.status(400).json({ error: "El código ya alcanzó su límite de usos" }); return; }

    const yaUsado = await qOne(conn,
      "SELECT id FROM usos_codigos WHERE codigo_id = ? AND usuario_id = ?",
      [c.id, usuarioId]
    );
    if (yaUsado) { res.status(400).json({ error: "Ya usaste este código" }); return; }

    await qRun(conn, "INSERT INTO usos_codigos (codigo_id, usuario_id) VALUES (?, ?)", [c.id, usuarioId]);
    await qRun(conn, "UPDATE codigos_puntos SET usos_actuales = usos_actuales + 1 WHERE id = ?", [c.id]);
    await qRun(conn,
      `INSERT INTO movimientos_puntos (usuario_id, tipo, puntos, descripcion, referencia_id, referencia_tipo)
       VALUES (?, 'codigo_canje', ?, ?, ?, 'codigos_puntos')`,
      [usuarioId, c.puntos_valor, `Código canjeado: ${codigo}`, c.id]
    );
    await qRun(conn, "UPDATE usuarios SET puntos_saldo = puntos_saldo + ? WHERE id = ?", [c.puntos_valor, usuarioId]);

    await conn.commit();

    const updated = await qOne(pool, "SELECT puntos_saldo FROM usuarios WHERE id = ?", [usuarioId]);
    res.json({ ok: true, puntos_ganados: c.puntos_valor, nuevo_saldo: updated?.puntos_saldo });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ── POST /cliente/canjear-producto ───────────────────────────────────────────

router.post("/canjear-producto", async (req, res) => {
  const schema = z.object({ producto_id: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "producto_id requerido" }); return; }

  const { producto_id } = parsed.data;
  const usuarioId = req.user!.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const prod = await qOne(conn,
      "SELECT id, nombre, puntos_requeridos FROM productos WHERE id = ? AND activo = 1",
      [producto_id]
    );
    if (!prod) { res.status(404).json({ error: "Producto no encontrado o inactivo" }); return; }

    const userRow = await qOne(conn, "SELECT puntos_saldo FROM usuarios WHERE id = ?", [usuarioId]);
    const saldo = userRow?.puntos_saldo ?? 0;
    if (saldo < prod.puntos_requeridos) {
      res.status(400).json({ error: `Puntos insuficientes. Tenés ${saldo}, necesitás ${prod.puntos_requeridos}` });
      return;
    }

    const diasRow = await qOne(conn, "SELECT valor FROM configuracion WHERE clave = 'dias_limite_retiro'");
    const dias = parseInt(diasRow?.valor ?? "7", 10);
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    const { insertId: canjeId } = await qRun(conn,
      `INSERT INTO canjes (usuario_id, producto_id, puntos_usados, estado, fecha_limite_retiro)
       VALUES (?, ?, ?, 'pendiente', ?)`,
      [usuarioId, producto_id, prod.puntos_requeridos, fechaLimite]
    );

    await qRun(conn,
      `INSERT INTO movimientos_puntos (usuario_id, tipo, puntos, descripcion, referencia_id, referencia_tipo)
       VALUES (?, 'canje_producto', ?, ?, ?, 'canjes')`,
      [usuarioId, -prod.puntos_requeridos, `Canje: ${prod.nombre}`, canjeId]
    );
    await qRun(conn, "UPDATE usuarios SET puntos_saldo = puntos_saldo - ? WHERE id = ?", [prod.puntos_requeridos, usuarioId]);

    await conn.commit();

    res.status(201).json({
      ok: true,
      canje_id: canjeId,
      puntos_usados: prod.puntos_requeridos,
      nuevo_saldo: saldo - prod.puntos_requeridos,
      fecha_limite_retiro: fechaLimite,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

export default router;
