import { ar } from '@/lib/farm-utils';
import type { Animal } from '../shared/appTypes';

type BStats = {
  total: number; tarbiyaMale: number; tarbiyaFemale: number;
  tasmeenMale: number; tasmeenFemale: number; tarbiya: number; tasmeen: number;
};

type Props = {
  species: 'goat' | 'sheep';
  breeds: string[];
  animals: Animal[];
  onAddAnimal: () => void;
  onMarkDeath: () => void;
};

export default function SpeciesPage({ species, breeds, animals, onAddAnimal, onMarkDeath }: Props) {
  const alive = animals.filter(a => a.status === 'alive');
  const emoji = species === 'goat' ? '🐐' : '🐑';
  const color = species === 'goat' ? 'var(--wonder-green)' : '#2196f3';
  const title = species === 'goat' ? 'قسم الماعز' : 'قسم الأغنام';

  const breedStats = (breed: string): BStats => {
    const list = alive.filter(a => a.breed === breed);
    const c = (g: 'male' | 'female', p: 'tarbiya' | 'tasmeen') =>
      list.filter(a => a.gender === g && a.purpose === p).length;
    return {
      total: list.length,
      tarbiyaMale: c('male', 'tarbiya'), tarbiyaFemale: c('female', 'tarbiya'),
      tasmeenMale: c('male', 'tasmeen'), tasmeenFemale: c('female', 'tasmeen'),
      tarbiya: c('male', 'tarbiya') + c('female', 'tarbiya'),
      tasmeen: c('male', 'tasmeen') + c('female', 'tasmeen'),
    };
  };

  const sorted = [...breeds].sort((a, b) => breedStats(b).total - breedStats(a).total);
  const biggestBreed = sorted[0];
  const total = alive.filter(a => a.species === species && a.purpose !== 'birth').length;
  const births = alive.filter(a => a.species === species && a.purpose === 'birth');
  const birthStats = {
    total: births.length,
    male: births.filter(a => a.gender === 'male').length,
    female: births.filter(a => a.gender === 'female').length,
  };

  // Per-animal list for this species
  const speciesAnimals = animals.filter(a => a.species === species).slice(0, 50);

  return (
    <div>
      {/* Header Card */}
      <div className="wonder-card animate-in mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="text-gray mb-1">{title}</div>
            <div className="stat-value" style={{ color }}>{emoji} {ar(total)}</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="action-btn primary" onClick={onAddAnimal}><i className="bi bi-plus-lg" /> إضافة</button>
            <button className="action-btn danger" onClick={onMarkDeath}><i className="bi bi-x-octagon" /> نفوق</button>
          </div>
        </div>
        {biggestBreed && (
          <div className="mt-3">
            <span className="type-badge badge-tarbiya">السلالة الأكبر: {biggestBreed} — {ar(breedStats(biggestBreed).total)}</span>
          </div>
        )}
      </div>

      {/* Breed Cards */}
      <div className="row g-3 mb-4">
        {breeds.map((breed, i) => {
          const s = breedStats(breed);
          return (
            <div className="col-lg-4 col-md-6" key={breed}>
              <div className={`breed-card animate-in ${i % 3 === 1 ? 'delay-1' : i % 3 === 2 ? 'delay-2' : ''}`}>
                <div className="breed-header">
                  <div className="breed-icon" style={{ background: 'rgba(255,255,255,.06)', fontSize: '1.4rem' }}>{emoji}</div>
                  <div>
                    <div className="fw-bold">{breed}</div>
                    <small className="text-gray">إجمالي السلالة</small>
                  </div>
                </div>
                <div className="stat-value mb-3" style={{ color }}>{ar(s.total)}</div>

                <div className="text-gray mb-2 fw-bold" style={{ fontSize: '.82rem' }}>تربية ({ar(s.tarbiya)})</div>
                <div className="row g-2 mb-3">
                  <div className="col-6"><div className="gender-box"><span className="gender-count">{ar(s.tarbiyaMale)}</span><small className="text-gray">ذكور</small></div></div>
                  <div className="col-6"><div className="gender-box"><span className="gender-count">{ar(s.tarbiyaFemale)}</span><small className="text-gray">إناث</small></div></div>
                </div>
                <div className="text-gray mb-2 fw-bold" style={{ fontSize: '.82rem' }}>تسمين ({ar(s.tasmeen)})</div>
                <div className="row g-2">
                  <div className="col-6"><div className="gender-box"><span className="gender-count accent-text">{ar(s.tasmeenMale)}</span><small className="text-gray">ذكور</small></div></div>
                  <div className="col-6"><div className="gender-box"><span className="gender-count accent-text">{ar(s.tasmeenFemale)}</span><small className="text-gray">إناث</small></div></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Births Summary */}
      <div className="births-section animate-in mb-4">
        <h5 className="fw-bold mb-3">المواليد <small className="text-gray fw-normal">— إجمالي {ar(birthStats.total)}</small></h5>
        <div className="row g-3">
          <div className="col-6"><div className="summary-card"><div className="summary-number">{ar(birthStats.male)}</div><small className="text-gray">ذكور</small></div></div>
          <div className="col-6"><div className="summary-card"><div className="summary-number" style={{ color: 'var(--accent-orange)' }}>{ar(birthStats.female)}</div><small className="text-gray">إناث</small></div></div>
        </div>
      </div>

      {/* Animal List Table */}
      <div className="wonder-card animate-in p-0">
        <div className="d-flex align-items-center justify-content-between p-3 pb-2">
          <h6 className="fw-bold mb-0">قائمة الحيوانات <small className="text-gray fw-normal">(آخر ٥٠)</small></h6>
        </div>
        <div className="table-responsive">
          <table className="table table-dark table-bordered mb-0 align-middle text-center" style={{ ['--bs-border-color' as any]: '#2a2a2a', fontSize: '.82rem' }}>
            <thead>
              <tr className="text-gray">
                <th>السلالة</th><th>الجنس</th><th>الغرض</th><th>الترقيم</th><th>الحالة</th><th>تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {speciesAnimals.length === 0 ? (
                <tr><td colSpan={6} className="text-gray py-4">لا توجد حيوانات مسجلة</td></tr>
              ) : speciesAnimals.map(a => (
                <tr key={a.id}>
                  <td className="fw-bold">{a.breed}</td>
                  <td>{a.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}</td>
                  <td>
                    <span className={`type-badge ${a.purpose === 'tasmeen' ? 'badge-tasmeen' : 'badge-tarbiya'}`}>
                      {a.purpose === 'tarbiya' ? 'تربية' : a.purpose === 'tasmeen' ? 'تسمين' : 'مواليد'}
                    </span>
                  </td>
                  <td>{a.tag || <span className="text-gray">—</span>}</td>
                  <td>
                    <span className={`type-badge ${a.status === 'alive' ? 'badge-tarbiya' : ''}`}
                      style={a.status === 'dead' ? { background: 'rgba(244,67,54,.12)', color: '#f44336', border: '1px solid rgba(244,67,54,.25)' } : {}}>
                      {a.status === 'alive' ? 'حي' : 'نافق'}
                    </span>
                  </td>
                  <td className="text-gray">{a.created_at?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
