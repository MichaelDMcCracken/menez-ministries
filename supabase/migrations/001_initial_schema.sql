-- Sermon Library: Initial Supabase Schema
-- Run this in your Supabase project's SQL editor (or via supabase db push).

-- ─────────────────────────────────────────
-- Table: sermons
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sermons (
  id            bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_slug     text          NOT NULL,          -- e.g. "1-corinthians", "various"
  book_subtitle text,                            -- optional series subtitle for the whole book
  passage       text          NOT NULL DEFAULT '',
  title         text          NOT NULL,
  url           text          NOT NULL,
  date          date,                            -- sermon date (optional)
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sermons_set_updated_at
  BEFORE UPDATE ON sermons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Useful indexes
CREATE INDEX IF NOT EXISTS sermons_book_slug_idx ON sermons (book_slug);
CREATE INDEX IF NOT EXISTS sermons_date_idx      ON sermons (date DESC NULLS LAST);

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────
ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including anonymous) can read sermons.
-- This is used by the static GitHub Pages site.
CREATE POLICY "Public read sermons"
  ON sermons FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated write: only signed-in admin users can insert / update / delete.
CREATE POLICY "Authenticated insert sermons"
  ON sermons FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update sermons"
  ON sermons FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete sermons"
  ON sermons FOR DELETE
  TO authenticated
  USING (true);
