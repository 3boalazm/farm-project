
CREATE TABLE public.animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('goat','sheep')),
  breed text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male','female')),
  purpose text NOT NULL CHECK (purpose IN ('tarbiya','tasmeen','birth')),
  status text NOT NULL DEFAULT 'alive' CHECK (status IN ('alive','dead')),
  tag text,
  notes text,
  died_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_animals_species ON public.animals(species);
CREATE INDEX idx_animals_status ON public.animals(status);
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read animals" ON public.animals FOR SELECT USING (true);
CREATE POLICY "public write animals" ON public.animals FOR INSERT WITH CHECK (true);
CREATE POLICY "public update animals" ON public.animals FOR UPDATE USING (true);
CREATE POLICY "public delete animals" ON public.animals FOR DELETE USING (true);

CREATE TABLE public.vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_section text NOT NULL,
  count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('done','pending','overdue')),
  scheduled_date date,
  done_date date,
  progress int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all vaccinations" ON public.vaccinations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('goat','sheep','general')),
  body text NOT NULL,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);
