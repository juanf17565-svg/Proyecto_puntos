import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, qOne, qRun } from "../db";
import { signToken } from "../auth";

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function uniqueInviteCode(length: number): Promise<string> {
  while (true) {
    const code = makeCode(length);
    const exists = await qOne(pool, "SELECT id FROM usuarios WHERE codigo_invitacion = ?", [code]);
    if (!exists) return code;
  }
}

// ── POST /auth/register ──────────────────────────────────────────────────────

const registerSchema = z.object({
  nombre:                  z.string().min(1).max(100),
  email:                   z.string().email(),
  password:                z.string().min(6),
  dni:                     z.string().min(6).max(15),
  codigo_invitacion_usado: z.string().optional().nullable(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const { nombre, email, password, dni, codigo_invitacion_usado } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verificar duplicados
    const dup = await qOne(conn, "SELECT id FROM usuarios WHERE email = ? OR dni = ?", [email, dni]);
    if (dup) {
      res.status(409).json({ error: "El email o DNI ya está registrado" });
      return;
    }

    // Longitud del código de invitación propio
    const cfgRow = await qOne(conn, "SELECT valor FROM configuracion WHERE clave = 'longitud_codigo_invitacion'");
    const longitud = Number(cfgRow?.valor ?? 8);
    const codigoPropio = await uniqueInviteCode(longitud);

    const hash = await bcrypt.hash(password, 10);

    // Buscar invitador (si viene código)
    let referidoPor: number | null = null;
    let invitador: { id: number; nombre: string } | null = null;
    if (codigo_invitacion_usado) {
      const inv = await qOne(conn,
        "SELECT id, nombre FROM usuarios WHERE codigo_invitacion = ? AND activo = 1",
        [codigo_invitacion_usado.toUpperCase()]
      );
      if (inv) { invitador = inv; referidoPor = inv.id; }
    }

    // Crear usuario
    const { insertId: nuevoId } = await qRun(conn,
      `INSERT INTO usuarios (nombre, email, password_hash, rol, dni, codigo_invitacion, referido_por)
       VALUES (?, ?, ?, 'cliente', ?, ?, ?)`,
      [nombre, email, hash, dni, codigoPropio, referidoPor]
    );

    // Puntos por referido
    if (invitador) {
      const cfgRows = await qOne<any>(conn,
        `SELECT
           MAX(CASE WHEN clave='puntos_referido_invitador' THEN CAST(valor AS UNSIGNED) END) AS inv,
           MAX(CASE WHEN clave='puntos_referido_invitado'  THEN CAST(valor AS UNSIGNED) END) AS nuev
         FROM configuracion
         WHERE clave IN ('puntos_referido_invitador','puntos_referido_invitado')`
      );
      const ptsInv  = Number(cfgRows?.inv  ?? 50);
      const ptsNuev = Number(cfgRows?.nuev ?? 30);

      const { insertId: refId } = await qRun(conn,
        `INSERT INTO referidos (invitador_id, invitado_id, puntos_invitador, puntos_invitado)
         VALUES (?, ?, ?, ?)`,
        [invitador.id, nuevoId, ptsInv, ptsNuev]
      );

      await qRun(conn,
        `INSERT INTO movimientos_puntos (usuario_id, tipo, puntos, descripcion, referencia_id, referencia_tipo)
         VALUES (?, 'referido_invitador', ?, ?, ?, 'referidos')`,
        [invitador.id, ptsInv, `${nombre} se registró con tu código`, refId]
      );
      await qRun(conn, "UPDATE usuarios SET puntos_saldo = puntos_saldo + ? WHERE id = ?", [ptsInv, invitador.id]);

      await qRun(conn,
        `INSERT INTO movimientos_puntos (usuario_id, tipo, puntos, descripcion, referencia_id, referencia_tipo)
         VALUES (?, 'referido_invitado', ?, ?, ?, 'referidos')`,
        [nuevoId, ptsNuev, `Bono de bienvenida por código de ${invitador.nombre}`, refId]
      );
      await qRun(conn, "UPDATE usuarios SET puntos_saldo = puntos_saldo + ? WHERE id = ?", [ptsNuev, nuevoId]);
    }

    await conn.commit();

    const u = await qOne(conn,
      "SELECT id, nombre, email, rol, dni, puntos_saldo, codigo_invitacion FROM usuarios WHERE id = ?",
      [nuevoId]
    );

    res.status(201).json({
      token: signToken({ id: u.id, email: u.email, rol: u.rol }),
      user: u,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email y contraseña requeridos" });
    return;
  }
  const { email, password } = parsed.data;

  const user = await qOne(pool,
    `SELECT id, nombre, email, rol, dni, puntos_saldo, codigo_invitacion, password_hash, activo
     FROM usuarios WHERE email = ?`,
    [email]
  );

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }
  if (!user.activo) {
    res.status(403).json({ error: "Cuenta deshabilitada" });
    return;
  }

  const { password_hash, activo, ...safeUser } = user;
  res.json({
    token: signToken({ id: safeUser.id, email: safeUser.email, rol: safeUser.rol }),
    user: safeUser,
  });
});

export default router;
