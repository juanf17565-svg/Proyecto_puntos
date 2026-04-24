import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export type Rol = "cliente" | "vendedor" | "admin";
export interface TokenPayload {
  id: number;
  rol: Rol;
  email: string;
}

const WEAK_SECRETS = new Set(["dev-secret-cambialo", "cambia-esto-en-produccion"]);
const MIN_SECRET_LENGTH = 64;

function loadJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error(
      "JWT_SECRET no configurado. Generá uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\" y pegalo en backend/.env",
    );
  }
  if (WEAK_SECRETS.has(value)) {
    throw new Error("JWT_SECRET usa un valor por defecto conocido. Reemplazalo en backend/.env por un secret aleatorio.");
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET demasiado corto (${value.length}). Mínimo ${MIN_SECRET_LENGTH} caracteres.`);
  }
  return value;
}

export const JWT_SECRET = loadJwtSecret();

export function signToken(payload: TokenPayload): string {
  const expiresIn = payload.rol === "admin" || payload.rol === "vendedor" ? "1d" : "1h";
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as TokenPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}
