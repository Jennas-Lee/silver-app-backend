import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** 계정. 어르신은 이름만으로 만들고(휴대폰 한 대 = 계정 하나), 보호자는 이메일·비밀번호로 만든다. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role", { enum: ["senior", "guardian"] }).notNull(),
    name: text("name").notNull(),
    /** 보호자만 사용. 소문자로 저장 */
    email: text("email"),
    /** 보호자만 사용. scrypt 해시 */
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/** 로그인 토큰. 원문은 앱에만 있고 서버에는 해시만 저장한다. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/** 어르신 휴대폰에 표시하는 6자리 연결 코드. 짧게만 유효하다. */
export const linkCodes = pgTable("link_codes", {
  code: text("code").primaryKey(),
  seniorId: uuid("senior_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** 보호자 ↔ 어르신 연결 */
export const links = pgTable(
  "links",
  {
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seniorId: uuid("senior_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guardianId, t.seniorId] }), index("links_senior_idx").on(t.seniorId)],
);

/** 어르신 휴대폰에서 차단·경고한 메시지. 개인정보는 가린 본문만 저장한다. */
export const guardRecords = pgTable(
  "guard_records",
  {
    /** 앱에서 만든 기록 ID (같은 기록을 여러 번 올려도 한 번만 저장) */
    id: text("id").notNull(),
    seniorId: uuid("senior_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
    sender: text("sender").notNull(),
    bodyMasked: text("body_masked").notNull(),
    action: text("action", { enum: ["HIDDEN", "WARNED"] }).notNull(),
    category: text("category").notNull(),
    reason: text("reason").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seniorId, t.id] }), index("guard_records_senior_received_idx").on(t.seniorId, t.receivedAt)],
);

export type User = typeof users.$inferSelect;
