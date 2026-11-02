#!/usr/bin/env node
// 운영 DB(Prisma Postgres)에 마이그레이션을 적용한다. Vercel 빌드에서 next build 전에 실행된다.
// DATABASE_URL이 없으면(로컬, CI) 아무것도 하지 않는다. 로컬은 서버가 처음 DB를 열 때 적용한다.
// 마이그레이션은 연결 풀이 아닌 직접 연결(DATABASE_URL)로 한다.

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL 없음: 마이그레이션 건너뜀");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("마이그레이션 완료");
} finally {
  await client.end();
}
