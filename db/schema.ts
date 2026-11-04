import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wishes = sqliteTable("wishes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  availableAt: integer("available_at").notNull(),
  cheers: integer("cheers").notNull().default(0),
  reports: integer("reports").notNull().default(0),
  deleteHash: text("delete_hash").notNull(),
}, table => [index("wishes_exhibition").on(table.status, table.createdAt, table.id)]);

export const dailyLimits = sqliteTable("daily_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
});
