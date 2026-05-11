import { useState } from 'react';
import { SettingsStore } from '../shared/appTypes';
import { toast } from 'sonner';
import type { FarmSettings } from '../shared/appTypes';

type Props = { settings: FarmSettings; onSave: (s: FarmSettings) => void };

export default function SettingsPage({ settings, onSave }: Props) {
  const [form, setForm] = useState<FarmSettings>({ ...settings });
  const [newGoatBreed, setNewGoatBreed] = useState('');
  const [newSheepBreed, setNewSheepBreed] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (k: keyof FarmSettings, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    SettingsStore.save(form);
    onSave(form);
    setSaved(true);
    toast.success('تم حفظ الإعدادات');
    setTimeout(() => setSaved(false), 2000);
  };

  const addGoatBreed = () => {
    const b = newGoatBreed.trim();
    if (!b || form.goatBreeds.includes(b)) { toast.error('السلالة موجودة بالفعل أو فارغة'); return; }
    set('goatBreeds', [...form.goatBreeds, b]);
    setNewGoatBreed('');
  };

  const removeGoatBreed = (b: string) => {
    if (form.goatBreeds.length <= 1) { toast.error('يجب الإبقاء على سلالة واحدة على الأقل'); return; }
    set('goatBreeds', form.goatBreeds.filter(x => x !== b));
  };

  const addSheepBreed = () => {
    const b = newSheepBreed.trim();
    if (!b || form.sheepBreeds.includes(b)) { toast.error('السلالة موجودة بالفعل أو فارغة'); return; }
    set('sheepBreeds', [...form.sheepBreeds, b]);
    setNewSheepBreed('');
  };

  const removeSheepBreed = (b: string) => {
    if (form.sheepBreeds.length <= 1) { toast.error('يجب الإبقاء على سلالة واحدة على الأقل'); return; }
    set('sheepBreeds', form.sheepBreeds.filter(x => x !== b));
  };

  return (
    <div>
      {/* Header */}
      <div className="wonder-card animate-in mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="fw-bold mb-1"><i className="bi bi-gear-fill accent-text" /> الإعدادات</h5>
            <small className="text-gray">تخصيص بيانات ومتغيرات المزرعة</small>
          </div>
          <button className="action-btn primary" onClick={handleSave}>
            <i className={`bi ${saved ? 'bi-check-lg' : 'bi-floppy-fill'}`} /> {saved ? 'تم الحفظ!' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Farm Info */}
      <SectionCard title="معلومات المزرعة" icon="bi-house-fill">
        <div className="row g-3">
          <div className="col-md-6">
            <label>اسم المزرعة</label>
            <input value={form.farmName} onChange={e => set('farmName', e.target.value)} placeholder="بيان المزرعة" />
          </div>
          <div className="col-md-6">
            <label>اسم المدير / المالك</label>
            <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="مدير المزرعة" />
          </div>
          <div className="col-md-6">
            <label>العملة</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="ج.م">جنيه مصري (ج.م)</option>
              <option value="ر.س">ريال سعودي (ر.س)</option>
              <option value="د.إ">درهم إماراتي (د.إ)</option>
              <option value="د.ك">دينار كويتي (د.ك)</option>
              <option value="د.ا">دينار أردني (د.ا)</option>
              <option value="ل.ل">ليرة لبنانية (ل.ل)</option>
              <option value="د.م">درهم مغربي (د.م)</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Goat Breeds */}
      <SectionCard title="سلالات الماعز" icon="bi-tropical-storm">
        <div className="d-flex flex-wrap gap-2 mb-3">
          {form.goatBreeds.map(b => (
            <span key={b} className="d-flex align-items-center gap-1 type-badge badge-tarbiya" style={{ fontSize: '.85rem' }}>
              🐐 {b}
              <button onClick={() => removeGoatBreed(b)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', opacity: .7 }}>
                <i className="bi bi-x-lg" style={{ fontSize: '.7rem' }} />
              </button>
            </span>
          ))}
        </div>
        <div className="d-flex gap-2">
          <input value={newGoatBreed} onChange={e => setNewGoatBreed(e.target.value)}
            placeholder="أضف سلالة ماعز جديدة..." onKeyDown={e => e.key === 'Enter' && addGoatBreed()} />
          <button className="action-btn primary" onClick={addGoatBreed} style={{ flexShrink: 0 }}><i className="bi bi-plus-lg" /></button>
        </div>
      </SectionCard>

      {/* Sheep Breeds */}
      <SectionCard title="سلالات الأغنام" icon="bi-cloud-fill">
        <div className="d-flex flex-wrap gap-2 mb-3">
          {form.sheepBreeds.map(b => (
            <span key={b} className="d-flex align-items-center gap-1 type-badge badge-tasmeen" style={{ fontSize: '.85rem' }}>
              🐑 {b}
              <button onClick={() => removeSheepBreed(b)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', opacity: .7 }}>
                <i className="bi bi-x-lg" style={{ fontSize: '.7rem' }} />
              </button>
            </span>
          ))}
        </div>
        <div className="d-flex gap-2">
          <input value={newSheepBreed} onChange={e => setNewSheepBreed(e.target.value)}
            placeholder="أضف سلالة أغنام جديدة..." onKeyDown={e => e.key === 'Enter' && addSheepBreed()} />
          <button className="action-btn primary" onClick={addSheepBreed} style={{ flexShrink: 0 }}><i className="bi bi-plus-lg" /></button>
        </div>
      </SectionCard>

      {/* Thresholds */}
      <SectionCard title="المتغيرات والحدود" icon="bi-sliders">
        <div className="row g-3">
          <div className="col-md-6">
            <label>أيام الحمل (لحساب موعد الولادة)</label>
            <input type="number" min="100" max="200" value={form.pregnancyDays} onChange={e => set('pregnancyDays', parseInt(e.target.value) || 150)} />
            <small className="text-gray">الافتراضي: ١٥٠ يوم</small>
          </div>
          <div className="col-md-6">
            <label>تنبيه التحصين قبل (أيام)</label>
            <input type="number" min="1" max="30" value={form.vaccinationAlertDays} onChange={e => set('vaccinationAlertDays', parseInt(e.target.value) || 7)} />
            <small className="text-gray">عدد الأيام قبل الموعد لإرسال تنبيه</small>
          </div>
        </div>
      </SectionCard>

      <div className="d-flex justify-content-end mt-3">
        <button className="action-btn primary" onClick={handleSave} style={{ padding: '10px 28px' }}>
          <i className={`bi ${saved ? 'bi-check-circle-fill' : 'bi-floppy-fill'}`} /> {saved ? 'تم الحفظ بنجاح!' : 'حفظ جميع الإعدادات'}
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="wonder-card animate-in mb-3">
      <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
        <i className={`bi ${icon}`} style={{ color: 'var(--accent-orange)' }} /> {title}
      </h6>
      {children}
    </div>
  );
}
