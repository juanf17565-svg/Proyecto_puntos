import "dotenv/config";
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

pool
  .getConnection()
  .then((conn) => { console.log("✅ MySQL conectado"); conn.release(); })
  .catch((err) => { console.error("❌ MySQL:", err.message); process.exit(1); });

type Queryable = Pool | PoolConnection;

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
