import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const analyticsSessions = sqliteTable("analytics_sessions", {
  sessionId: text("session_id").primaryKey(),
  firstSeen: text("first_seen").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeen: text("last_seen").notNull().default(sql`CURRENT_TIMESTAMP`),
  path: text("path").notNull().default("/"),
}, (table) => [index("idx_analytics_sessions_last_seen").on(table.lastSeen)]);

export const analyticsPageviews = sqliteTable("analytics_pageviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  path: text("path").notNull().default("/"),
  viewedAt: text("viewed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_analytics_pageviews_viewed_at").on(table.viewedAt),
  index("idx_analytics_pageviews_session_viewed").on(table.sessionId, table.viewedAt),
]);

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  view: text("view").notNull().default("home"),
  sessionId: text("session_id"),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_feedback_created_at").on(table.createdAt),
  index("idx_feedback_status_created").on(table.status, table.createdAt),
]);
