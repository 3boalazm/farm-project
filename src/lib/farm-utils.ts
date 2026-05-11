export const ar = (n: number): string => {
  const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(n).replace(/\d/g, d => map[parseInt(d,10)]);
};

export const todayAr = (): string => {
  const d = new Date();
  return `${ar(d.getFullYear())}/${ar(d.getMonth()+1).padStart(2,'٠')}/${ar(d.getDate()).padStart(2,'٠')}`;
};

export type Animal = {
  id: string;
  species: 'goat' | 'sheep';
  breed: string;
  gender: 'male' | 'female';
  purpose: 'tarbiya' | 'tasmeen' | 'birth';
  status: 'alive' | 'dead';
  tag: string | null;
  notes: string | null;
  died_at: string | null;
  created_at: string;
};
