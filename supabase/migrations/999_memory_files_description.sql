-- Add optional description column to memory_files if it doesn't exist.
-- This allows the memory API to select it without a 42703 error.
alter table memory_files
  add column if not exists description text;
