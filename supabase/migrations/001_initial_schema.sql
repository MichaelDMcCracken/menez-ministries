-- ============================================================
-- Menez Ministries Sermon Library — Supabase Schema
-- ============================================================

-- Speakers
create table if not exists speakers (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Series (each series belongs to a book/book-slug)
create table if not exists series (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  book_slug text,          -- e.g. '1-corinthians'
  subtitle  text,          -- optional subtitle shown on book pages
  created_at timestamptz not null default now()
);

-- Sermons
create table if not exists sermons (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  passage    text,                                         -- e.g. "1 Corinthians 1:1–9"
  book_slug  text not null,                               -- e.g. "1-corinthians"
  date       date,
  speaker_id uuid references speakers(id) on delete set null,
  series_id  uuid references series(id) on delete set null,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Media links (one sermon may have multiple external media URLs)
create table if not exists media_links (
  id         uuid primary key default gen_random_uuid(),
  sermon_id  uuid not null references sermons(id) on delete cascade,
  url        text not null,
  provider   text,          -- 'soundcloud' | 'youtube' | 'vimeo' | etc.
  label      text,          -- optional display label
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists sermons_book_slug_idx  on sermons(book_slug);
create index if not exists sermons_published_idx  on sermons(published);
create index if not exists sermons_date_idx       on sermons(date desc);
create index if not exists media_links_sermon_idx on media_links(sermon_id);

-- ============================================================
-- Trigger: keep sermons.updated_at current
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sermons_updated_at on sermons;
create trigger sermons_updated_at
  before update on sermons
  for each row execute procedure update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table speakers    enable row level security;
alter table series      enable row level security;
alter table sermons     enable row level security;
alter table media_links enable row level security;

-- -------------------------------------------------------
-- Public (anon) — read-only, published sermons only
-- -------------------------------------------------------

-- Anyone can read speakers
create policy "public_read_speakers" on speakers
  for select using (true);

-- Anyone can read series
create policy "public_read_series" on series
  for select using (true);

-- Public can only read published sermons
create policy "public_read_published_sermons" on sermons
  for select using (published = true);

-- Public can only read media links for published sermons
create policy "public_read_media_links" on media_links
  for select using (
    exists (
      select 1 from sermons s
      where s.id = media_links.sermon_id
        and s.published = true
    )
  );

-- -------------------------------------------------------
-- Authenticated users — full access
-- -------------------------------------------------------
create policy "auth_all_speakers" on speakers
  for all using (auth.role() = 'authenticated');

create policy "auth_all_series" on series
  for all using (auth.role() = 'authenticated');

create policy "auth_all_sermons" on sermons
  for all using (auth.role() = 'authenticated');

create policy "auth_all_media_links" on media_links
  for all using (auth.role() = 'authenticated');
