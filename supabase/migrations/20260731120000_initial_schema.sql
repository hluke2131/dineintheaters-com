-- Initial schema for DineInTheaters.com: chains, locations, reviews,
-- submissions, field_verification, sponsorships.

create table public.chains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  locator_url text,
  known_sub_brands text[]
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  chain_id uuid references public.chains (id) on delete set null,
  sub_brand text,
  address text not null,
  city text not null,
  state text not null,
  zip text,
  lat double precision not null,
  lng double precision not null,
  place_id text,
  fsq_id text,
  phone text,
  website_url text,
  ticketing_url text,
  hours jsonb,
  delivery_style text not null default 'unknown'
    check (delivery_style in ('in_seat_delivery', 'counter_pickup', 'unknown')),
  alcohol_served text not null default 'unknown'
    check (alcohol_served in ('none', 'beer_wine', 'full_bar', 'unknown')),
  age_restricted_auditoriums boolean,
  reserved_recliners boolean,
  menu_price_range text check (menu_price_range in ('$', '$$', '$$$')),
  amenities text[],
  accessibility_notes text,
  parking_notes text,
  safety_notes text,
  description text not null default '',
  status text not null default 'active'
    check (status in ('active', 'temporarily_closed', 'permanently_closed')),
  last_verified_date date,
  photos text[],
  is_sponsored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_state_idx on public.locations (state);
create index locations_city_idx on public.locations (city);
create index locations_status_idx on public.locations (status);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  review_text text not null,
  visit_date date,
  reviewer_name text,
  reviewer_email text not null,
  created_at timestamptz not null default now()
);

create index reviews_location_id_idx on public.reviews (location_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations (id) on delete set null,
  submitted_fields jsonb not null,
  submitter_name text,
  submitter_email text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.field_verification (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  field_name text not null,
  confirmed_count int not null default 0,
  disputed_count int not null default 0,
  unique (location_id, field_name)
);

create index field_verification_location_id_idx on public.field_verification (location_id);

create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  claimant_name text not null,
  claimant_email text not null,
  claimant_phone text,
  verification_method text not null check (verification_method in ('email_domain_match', 'manual')),
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  subscription_status text check (subscription_status in ('active', 'past_due', 'canceled', 'incomplete')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: public directory data is readable by anyone; writes are blocked for
-- anon/authenticated roles until real submission/moderation flows exist
-- (service_role bypasses RLS for backend use). submissions and sponsorships
-- hold contact/billing details, so they get no public policies at all.
alter table public.chains enable row level security;
alter table public.locations enable row level security;
alter table public.reviews enable row level security;
alter table public.submissions enable row level security;
alter table public.field_verification enable row level security;
alter table public.sponsorships enable row level security;

create policy "Public read access" on public.chains for select using (true);
create policy "Public read access" on public.locations for select using (true);
create policy "Public read access" on public.reviews for select using (true);
create policy "Public read access" on public.field_verification for select using (true);
