import { ar } from '@/lib/farm-utils';
import type { Animal, FarmSettings } from '../shared/appTypes';

type BStats = {
  total: number; tarbiyaMale: number; tarbiyaFemale: number;
  tasmeenMale: number; tasmeenFemale: number; tarbiya: number; tasmeen: number;
};
type Births = { total: number; male: number; female: number };

type Props = {
  animals: Animal[];
  settings: FarmSettings;
  onAddAnimal: () => void;
  onMarkDeath: () => void;
};

export default function DashboardPage({ animals, settings, onAddAnimal, onMarkDeath }: Props) {
  const alive = animals.filter(a => a.status === 'alive');

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

  const totalGoats = alive.filter(a => a.species === 'goat' && a.purpose !== 'birth').length;
  const totalSheep = alive.filter(a => a.species === 'sheep' && a.purpose !== 'birth').length;
  const total = totalGoats + totalSheep;
  const dead = animals.filter(a => a.status === 'dead').length;
  const goatBirths = alive.filter(a => a.species === 'goat' && a.purpose === 'birth');
  const sheepBirths = alive.filter(a => a.species === 'sheep' && a.purpose === 'birth');
  const births: { goat: Births; sheep: Births } = {
    goat: { total: goatBirths.length, male: goatBirths.filter(a => a.gender === 'male').length, female: goatBirths.filter(a => a.gender === 'female').length },
    sheep: { total: sheepBirths.length, male: sheepBirths.filter(a => a.gender === 'male').length, female: sheepBirths.filter(a => a.gender === 'female').length },
  };

  const GOAT_BREEDS = settings.goatBreeds;
  const SHEEP_BREEDS = settings.sheepBreeds;

  const breedDefs = [
    ...GOAT_BREEDS.map(k => ({ key: k, emoji: '🐐', colorClass: 'green-text' })),
    ...SHEEP_BREEDS.map(k => ({ key: k, emoji: '🐑', colorClass: 'accent-text' })),
  ];

  return (
    <div>
      {/* Top Stats Row */}
      <div className="row g-3 mb-4">
        {[
          { label: 'إجمالي القطيع', value: total + births.goat.total + births.sheep.total, color: 'var(--accent-orange)', icon: 'bi-bar-chart-fill' },
          { label: 'إجمالي الماعز', value: totalGoats, color: 'var(--wonder-green)', icon: 'bi-tropical-storm' },
          { label: 'إجمالي الأغنام', value: totalSheep, color: '#2196f3', icon: 'bi-cloud-fill' },
          { label: 'المواليد', value: births.goat.total + births.sheep.total, color: '#ffc107', icon: 'bi-stars' },
          { label: 'النافق', value: dead, color: '#f44336', icon: 'bi-x-octagon-fill' },
        ].map(s => (
          <div key={s.label} className="col-6 col-md-4 col-lg">
            <div className="summary-card">
              <i className={`bi ${s.icon} mb-2 d-block`} style={{ fontSize: '1.4rem', color: s.color }} />
              <div className="summary-number" style={{ color: s.color }}>{ar(s.value)}</div>
              <small className="text-gray">{s.label}</small>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="wonder-card mb-4 animate-in">
        <div className="d-flex gap-2 flex-wrap">
          <button className="action-btn primary" onClick={onAddAnimal}><i className="bi bi-plus-lg" /> إضافة حيوان</button>
          <button className="action-btn danger" onClick={onMarkDeath}><i className="bi bi-x-octagon" /> تسجيل نفوق</button>
        </div>
      </div>

      {/* Breed Cards */}
      <h5 className="fw-bold mb-3 animate-in">
        <i className="bi bi-grid-3x3-gap-fill accent-text" /> توزيع السلالات
      </h5>
      <div className="row g-3 mb-4">
        {breedDefs.map((b, i) => {
          const s = breedStats(b.key);
          return (
            <div key={b.key} className="col-md-4 col-sm-6">
              <div className={`breed-card animate-in ${i % 3 === 1 ? 'delay-1' : i % 3 === 2 ? 'delay-2' : ''}`}>
                <div className="breed-header">
                  <div className="breed-icon" style={{ background: 'rgba(255,255,255,.06)' }}>{b.emoji}</div>
                  <div>
                    <div className="fw-bold">{b.key}</div>
                    <small className="text-gray">إجمالي: {ar(s.total)}</small>
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-6"><div className="gender-box"><span className="gender-count green-text">{ar(s.tarbiyaMale)}</span><small className="text-gray">ذكور تربية</small></div></div>
                  <div className="col-6"><div className="gender-box"><span className="gender-count green-text">{ar(s.tarbiyaFemale)}</span><small className="text-gray">إناث تربية</small></div></div>
                  {(s.tasmeenMale + s.tasmeenFemale > 0) && <>
                    <div className="col-6"><div className="gender-box"><span className="gender-count accent-text">{ar(s.tasmeenMale)}</span><small className="text-gray">ذكور تسمين</small></div></div>
                    <div className="col-6"><div className="gender-box"><span className="gender-count accent-text">{ar(s.tasmeenFemale)}</span><small className="text-gray">إناث تسمين</small></div></div>
                  </>}
                </div>
                <div className="mt-3">
                  {s.tarbiya > 0 && <span className="type-badge badge-tarbiya">تربية {ar(s.tarbiya)}</span>}{' '}
                  {s.tasmeen > 0 && <span className="type-badge badge-tasmeen">تسمين {ar(s.tasmeen)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Births */}
      <div className="births-section animate-in">
        <h5 className="fw-bold mb-3">
          <i className="bi bi-stars" style={{ color: '#ffc107' }} /> الولدات
          <small className="text-gray fw-normal"> — إجمالي: {ar(births.goat.total + births.sheep.total)}</small>
        </h5>
        <div className="row g-3">
          {[
            { title: 'ولدات الماعز', b: births.goat },
            { title: 'ولدات الأغنام', b: births.sheep },
          ].map(x => (
            <div className="col-md-6" key={x.title}>
              <div className="d-flex justify-content-between align-items-center p-3" style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14 }}>
                <div>
                  <div className="fw-bold">{x.title}</div>
                  <small className="text-gray">الإجمالي: {ar(x.b.total)}</small>
                </div>
                <div className="d-flex gap-3">
                  <div className="text-center"><div className="fw-bold green-text" style={{ fontSize: '1.4rem' }}>{ar(x.b.male)}</div><small className="text-gray">ذكور</small></div>
                  <div className="text-center"><div className="fw-bold accent-text" style={{ fontSize: '1.4rem' }}>{ar(x.b.female)}</div><small className="text-gray">إناث</small></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
