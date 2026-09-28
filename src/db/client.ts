import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Single database for both local dev and production: your Neon project.
// Set DATABASE_URL — locally in a .env.local file (never committed), and in
// Vercel under Project Settings → Environment Variables. Nothing else in
// the app changes between the two.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env.local (local dev) " +
      "or to the Vercel project's Environment Variables (deployed)."
  );
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
