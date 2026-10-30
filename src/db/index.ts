import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbPromise: Promise<Db> | undefined;

/**
 * 데이터베이스 연결.
 * - DATABASE_URL이 있으면 Neon Postgres (Vercel 운영·미리보기)
 * - 없으면 로컬 개발용 내장 Postgres(PGlite)를 .pglite 폴더에 만들고 마이그레이션을 적용한다
 */
export function getDb(): Promise<Db> {
  dbPromise ??= connect();
  return dbPromise;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as Db;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(process.env.PGLITE_DIR ?? ".pglite"), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

export { schema };
