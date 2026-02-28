create extension if not exists "pgcrypto";

create table if not exists apartments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ownership_share numeric not null check (ownership_share >= 0 and ownership_share <= 1),
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  net_revenue_dkk numeric not null check (net_revenue_dkk >= 0),
  created_at timestamptz not null default now()
);

create table if not exists booking_calculations (
  booking_id uuid primary key references bookings(id) on delete cascade,
  year integer not null,
  booking_revenue_dkk numeric not null check (booking_revenue_dkk >= 0),
  total_revenue_before_dkk numeric not null check (total_revenue_before_dkk >= 0),
  total_revenue_after_dkk numeric not null check (total_revenue_after_dkk >= 0),
  bundfradrag_dkk numeric not null check (bundfradrag_dkk >= 0),
  taxable_base_booking_dkk numeric not null check (taxable_base_booking_dkk >= 0),
  tax_on_booking_dkk numeric not null check (tax_on_booking_dkk >= 0),
  cut_after_tax_each_dkk numeric not null check (cut_after_tax_each_dkk >= 0),
  tax_rate numeric not null check (tax_rate >= 0 and tax_rate <= 1),
  created_at timestamptz not null default now()
);

create table if not exists tax_settings (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  bundfradrag_platform_dkk numeric not null,
  bundfradrag_private_dkk numeric not null,
  uses_platform boolean not null default true,
  tax_rate numeric not null check (tax_rate >= 0 and tax_rate <= 1),
  created_at timestamptz not null default now()
);

alter table apartments enable row level security;
alter table bookings enable row level security;
alter table booking_calculations enable row level security;
alter table tax_settings enable row level security;

-- No policies are added yet. This means only the service role key can access data.
