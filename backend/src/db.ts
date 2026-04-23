import "dotenv/config";
import { randomInt } from "crypto";
import mysql, { Pool, PoolConnection } from "mysql2/promise";

export const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || "localhost",
  port:     Number(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DATABASE || "nande_puntos",
  user:     process.env.MYSQL_USER     || "nande_user",
  password: process.env.MYSQL_PASSWORD || "nande_password",
  charset:  "utf8mb4",          /* ← codificación para tildes y ñ */
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
});

const REDEEM_CODE_LENGTH = 9;
const REDEEM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRandomRedeemCode(): string {
  let code = "";
  for (let i = 0; i < REDEEM_CODE_LENGTH; i += 1) {
    code += REDEEM_CODE_CHARS[randomInt(REDEEM_CODE_CHARS.length)];
  }
  return code;
}

function isLegacyRedeemCode(code: string | null | undefined): boolean {
  if (!code || code.length !== REDEEM_CODE_LENGTH) return true;
  return /^C0{2,}[A-Z0-9]*$/.test(code);
}

async function ensureUsuarioTelefonoSchema() {
  const [colRows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'telefono'
     LIMIT 1`
  ) as [any[], any[]];

  if (!colRows.length) {
    await pool.query("ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(25) NULL AFTER dni");
  }
}

async function ensureCanjeRedeemCodeSchema() {
  // Agrega la columna si no existe, o expande a VARCHAR(50) para que quepan los updates
  const [colRows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canjes' AND COLUMN_NAME = 'codigo_retiro'
     LIMIT 1`
  ) as [any[], any[]];

  if (!colRows.length) {
    await pool.query("ALTER TABLE canjes ADD COLUMN codigo_retiro VARCHAR(50) NULL AFTER producto_id");
  } else {
    // Expande temporalmente para poder escribir sin importar el tamaño actual
    await pool.query("ALTER TABLE canjes MODIFY COLUMN codigo_retiro VARCHAR(50) NULL");
  }

  // Asigna códigos random a los canjes que tienen código legacy o vacío
  const [codeRows] = await pool.query(
    "SELECT id, codigo_retiro FROM canjes"
  ) as [Array<{ id: number; codigo_retiro: string | null }>, any[]];

  const usedCodes = new Set(
    codeRows
      .map((r) => r.codigo_retiro)
      .filter((c): c is string => Boolean(c) && !isLegacyRedeemCode(c))
  );

  for (const row of codeRows) {
    if (!isLegacyRedeemCode(row.codigo_retiro)) continue;
    let code = makeRandomRedeemCode();
    while (usedCodes.has(code)) code = makeRandomRedeemCode();
    usedCodes.add(code);
    await pool.query("UPDATE canjes SET codigo_retiro = ? WHERE id = ?", [code, row.id]);
  }

  // Ajuste de schema — no crítico, se ignora si falla
  try {
    await pool.query("ALTER TABLE canjes MODIFY COLUMN codigo_retiro VARCHAR(9) NOT NULL");
  } catch { /* ya estaba bien o los datos no lo permiten aún */ }

  try {
    const [idxRows] = await pool.query(
      `SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canjes'
         AND INDEX_NAME = 'uq_canjes_codigo_retiro' LIMIT 1`
    ) as [any[], any[]];
    if (!idxRows.length) {
      await pool.query("ALTER TABLE canjes ADD UNIQUE INDEX uq_canjes_codigo_retiro (codigo_retiro)");
    }
  } catch { /* índice ya existe con otro nombre */ }
}

pool
  .getConnection()
  .then(async (conn) => {
    console.log("✅ MySQL conectado");
    conn.release();
    try {
      await ensureUsuarioTelefonoSchema();
    } catch (err: any) {
      console.error("Migracion telefono:", err.message);
    }
    try {
      await ensureCanjeRedeemCodeSchema();
    } catch (err: any) {
      console.error("⚠️  Migración códigos de canje:", err.message);
    }
  })
  .catch((err) => { console.error("❌ MySQL:", err.message); process.exit(1); });

export type Queryable = Pool | PoolConnection;

/** Devuelve todas las filas de un SELECT */
export async function qAll<T = any>(
  q: Queryable, sql: string, params?: any[]
): Promise<T[]> {
  const [rows] = await q.query(sql, params) as [any[], any[]];
  return rows as T[];
}

/** Devuelve la primera fila de un SELECT (o undefined) */
export async function qOne<T = any>(
  q: Queryable, sql: string, params?: any[]
): Promise<T | undefined> {
  const [rows] = await q.query(sql, params) as [any[], any[]];
  return (rows as T[])[0];
}

/** Ejecuta INSERT/UPDATE/DELETE y devuelve insertId y affectedRows */
export async function qRun(
  q: Queryable, sql: string, params?: any[]
): Promise<{ insertId: number; affectedRows: number }> {
  const [result] = await q.query(sql, params) as [any, any];
  return { insertId: result.insertId ?? 0, affectedRows: result.affectedRows ?? 0 };
}
