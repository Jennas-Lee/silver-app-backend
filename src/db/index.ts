import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbPromise: Promise<Db> | undefined;

/**
 * 데이터베이스 연결.
 * - DATABASE_URL이 있으면 Prisma Postgres (Vercel 운영·미리보기). 연결 풀 주소(DATABASE_URL_POOLED)를 우선 쓴다
 * - 없으면 로컬 개발용 내장 Postgres(PGlite)를 .pglite 폴더에 만들고 마이그레이션을 적용한다
 */
export function getDb(): Promise<Db> {
  dbPromise ??= connect();
  return dbPromise;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { attachDatabasePool } = await import("@vercel/functions");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    // 함수가 잠들기 전에 쉬는 연결을 정리한다 (Vercel Fluid compute)
    attachDatabasePool(pool);
    return drizzle(pool, { schema }) as unknown as Db;
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
