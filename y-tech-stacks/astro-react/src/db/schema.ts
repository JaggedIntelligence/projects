import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
  catleve1: text('catleve1').notNull(), // category Level 1
  catleve2: text('catleve2'),
  url1: text('url1').notNull(),  // holds  Gemini Prompt response Shared URL 
  url2: text('url2'),
  note1: text('note1'),   // user notes
  note2: text('note2'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
