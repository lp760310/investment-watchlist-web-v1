create extension if not exists pgcrypto;

create table if not exists watchlist_assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  market text not null,
  asset_type text not null,
  name_cn text not null,
  name_en text,
  sector text,
  observe_reason text,
  beginner_note text,
  data_provider text not null,
  provider_symbol text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists watchlist_assets_symbol_market_key
  on watchlist_assets(symbol, market);

create table if not exists daily_prices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references watchlist_assets(id) on delete cascade,
  trade_date date not null,
  close_price numeric,
  previous_close numeric,
  change_amount numeric,
  change_percent numeric,
  volume numeric,
  market_cap numeric,
  pe_ratio numeric,
  currency text,
  source text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id, trade_date)
);

create table if not exists update_logs (
  id uuid primary key default gen_random_uuid(),
  run_started_at timestamptz not null,
  run_finished_at timestamptz,
  status text not null,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  message text,
  details jsonb
);

create table if not exists daily_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null,
  title text,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_notes_note_date_key
  on daily_notes(note_date);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_watchlist_assets_updated_at on watchlist_assets;
create trigger set_watchlist_assets_updated_at
before update on watchlist_assets
for each row execute function set_updated_at();

drop trigger if exists set_daily_notes_updated_at on daily_notes;
create trigger set_daily_notes_updated_at
before update on daily_notes
for each row execute function set_updated_at();
