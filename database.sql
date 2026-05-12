-- =====================================================
-- بيان المزرعة — كل الجداول
-- شغّل هذا الكود مرة واحدة في SQL Editor في Supabase
-- =====================================================

-- جداول موجودة (create if not exists آمن)
create table if not exists animals (
  id uuid default gen_random_uuid() primary key,
  species text, breed text, gender text, purpose text,
  status text default 'alive', tag text, birth_date date,
  notes text, died_at timestamptz,
  created_at timestamptz default now()
);
create table if not exists vaccinations (
  id uuid default gen_random_uuid() primary key,
  name text, target_section text, count int default 0,
  status text default 'pending', scheduled_date date,
  done_date date, progress int default 0,
  created_at timestamptz default now()
);
create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  category text, body text, tag text,
  created_at timestamptz default now()
);

-- جداول جديدة
create table if not exists breeding (
  id text primary key,
  female_tag text, female_breed text, female_species text,
  male_tag text, male_breed text,
  mating_date text, expected_birth text, actual_birth text,
  offspring_count int, male_offspring int, female_offspring int,
  status text default 'pending', notes text,
  created_at timestamptz default now()
);
create table if not exists health (
  id text primary key,
  animal_tag text, animal_breed text, animal_species text,
  date text, diagnosis text, medication text, dosage text,
  withdrawal_days int, treatment_end text, withdrawal_end text,
  status text default 'active', notes text,
  created_at timestamptz default now()
);
create table if not exists finance (
  id text primary key,
  date text, type text, category text,
  amount numeric, description text,
  created_at timestamptz default now()
);
create table if not exists inventory_meds (
  id text primary key,
  name text, quantity numeric, unit text,
  expiry text, purpose text, notes text,
  created_at timestamptz default now()
);
create table if not exists inventory_feeds (
  id text primary key,
  name text, quantity numeric, unit text,
  min_quantity numeric, cost_per_unit numeric,
  created_at timestamptz default now()
);
create table if not exists inventory_equipment (
  id text primary key,
  name text, type text, status text default 'working',
  next_maintenance text, notes text,
  created_at timestamptz default now()
);
create table if not exists weights (
  id text primary key,
  animal_id text, animal_tag text,
  date text, weight numeric, notes text,
  created_at timestamptz default now()
);
create table if not exists milk (
  id text primary key,
  animal_id text, animal_tag text,
  date text, liters numeric, notes text,
  created_at timestamptz default now()
);

-- تفعيل الصلاحيات لكل الجداول
do $$ declare t text;
begin for t in select unnest(array[
  'animals','vaccinations','notes','breeding','health',
  'finance','inventory_meds','inventory_feeds',
  'inventory_equipment','weights','milk'
]) loop
  execute format('alter table %I enable row level security', t);
  execute format('drop policy if exists "allow all" on %I', t);
  execute format('create policy "allow all" on %I for all using (true) with check (true)', t);
end loop; end $$;
