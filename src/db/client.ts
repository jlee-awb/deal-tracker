import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Local dev: a plain file-based SQLite DB. When this moves to Vercel + Neon,
// only this file changes (swap to drizzle-orm/neon-http against a Postgres
// connection string) — schema.ts and every query stay the same, since none
// of them use SQLite-specific syntax.
const sqlite = new Database(path.join(process.cwd(), "dev.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
