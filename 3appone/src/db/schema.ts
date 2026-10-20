import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const todos = pgTable('todos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// to hold Gemini prompt responses in a table so serach UI can be built to query and view Later as KNOWLEDGE BASE , so to avoid repeat Prompting
export const knowledgebase = pgTable('knowledgebase', {
  id: serial('id').primaryKey(),
  catlevel1: text('catlevel1').notNull(), // category Level 1
  catlevel2: text('catlevel2'),
  url1: text('url1').notNull(),  // holds  Gemini Prompt response Shared URL 
  url2: text('url2'),
  note1: text('note1'),   // user notes
  note2: text('note2'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const images = pgTable('images', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull(),
  desc: text('description'),
  r2Key: text('r2_key').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  status: text('status').notNull().default('ready'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('images_r2_key_unique').on(table.r2Key),
  index('images_user_created_idx').on(table.userId, table.createdAt, table.id),
]);
