---
name: Stack del Proyecto_puntos
description: Stack y arquitectura del sistema de puntos de fidelización (Node/Express + React/Vite, MySQL)
type: project
---

Proyecto_puntos es un sistema de puntos de fidelización con 3 roles: cliente, vendedor, admin.
El vendedor carga puntos manualmente usando el DNI del cliente; el cálculo lo hace el sistema.

**Stack actual (al 2026-04-27):**
- Backend: Node.js + Express 4 + TypeScript + MySQL (mysql2/promise) — ver `backend/src/db.ts`
- Frontend: Vite + React + TypeScript + React Query + React Router
- Auth: JWT en cookie httpOnly (`auth_token`) + bcrypt + protección CSRF en server.ts
- Estilo: minimalista

**Why del cambio a MySQL:** la memoria vieja decía SQLite (plan inicial de demo), pero el repo ya
corre sobre MySQL con migraciones en `database/*.sql` y un docker-compose.yml. No revertir.

**Estructura del repo:**
```
Proyecto_puntos/
├── backend/      # Express + mysql2
├── frontend/     # Vite + React
├── database/     # schema.sql + migrations
└── docker-compose.yml
```

**How to apply:**
- Para columnas `DATETIME` de MySQL nunca pasar un string ISO con sufijo `Z` o milisegundos —
  rompe en modo estricto. Pasar un objeto `Date` (mysql2 lo serializa) o convertir a
  `"YYYY-MM-DD HH:MM:SS"` antes del INSERT. Ya pasó en `POST /admin/codigos` (bug del 2026-04-27).
- Express 4 NO propaga errores async al middleware global de `server.ts` — cada handler debe
  cerrar su propio try/catch y mandar la respuesta, si no el cliente queda colgado.
- Mantener portabilidad: nada de features exclusivas de MySQL más allá de lo ya usado.
