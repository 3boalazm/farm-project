import { useState, useEffect } from 'react';
import { ar } from '@/lib/farm-utils';
import { BreedingStore, genId } from '../shared/appTypes';
import { toast } from 'sonner';
import type { BreedingRecord, FarmSettings } from '../shared/appTypes';

type Props = { settings: FarmSettings };

const STATUS_MAP = {
  pregnant: { label: 'حامل', color: '#2196f3', icon: 'bi-heart-fill' },
  born: { label: 'ولادة ناجحة', color: 'var(--wonder-green)', icon: 'bi-stars' },
  failed: { label: 'إجهاض / فشل', color: '#f44336', icon: 'bi-x-circle-fill' },
  pending: { label: 'قيد الانتظار', color: 'var(--accent-orange)', icon: 'bi-hourglass-split' },
};

type Form = {
  female_tag: string; female_breed: string; female_species: 'goat' | 'sheep';
  male_tag: string; male_breed: string;
  mating_date: string; expected_birth: string; actual_birth: string;
  offspring_count: string; male_offspring: string; female_offspring: string;
  status: BreedingRecord['status']; notes: string;
};

const EMPTY_FORM: Form = {
  female_tag: '', female_breed: '', female_species: 'goat',
  male_tag: '', male_breed: '',
  mating_date: new Date().toISOString().slice(0, 10), expected_birth: '', actual_birth: '',
  offspring_count: '', male_offspring: '', female_offspring: '',
  status: 'pending', notes: '',
};

export default function BreedingPage({ settings }: Props) {
  const [records, setRecords] = useState<BreedingRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [filter, setFilter] = useState<BreedingRecord['status'] | 'all'>('all');

  useEffect(() => { setRecords(BreedingStore.getAll()); }, []);

  const refresh = () => setRecords(BreedingStore.getAll());
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calculate expected birth based on mating date
  const handleMatingDateChange = (date: string) => {
    set('mating_date', date);
    if (date) {
      const d = new Date(date);
      d.setDate(d.getDate() + settings.pregnancyDays);
      set('expected_birth', d.toISOString().slice(0, 10));
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (r: BreedingRecord) => {
    setForm({
      female_tag: r.female_tag, female_breed: r.female_breed, female_species: r.female_species,
      male_tag: r.male_tag, male_breed: r.male_breed,
      mating_date: r.mating_date, expected_birth: r.expected_birth,
      actual_birth: r.actual_birth || '', offspring_count: String(r.offspring_count || ''),
      male_offspring: String(r.male_offspring || ''), female_offspring: String(r.female_offspring || ''),
      status: r.status, notes: r.notes || '',
    });
    setEditId(r.id); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.female_tag || !form.mating_date) { toast.error('يرجى تحديد الأنثى وتاريخ التقريع'); return; }
    const record: BreedingRecord = {
      id: editId || genId(),
      female_tag: form.female_tag, female_breed: form.female_breed, female_species: form.female_species,
      male_tag: form.male_tag, male_breed: form.male_breed,
      mating_date: form.mating_date, expected_birth: form.expected_birth,
      actual_birth: form.actual_birth || null,
      offspring_count: form.offspring_count ? parseInt(form.offspring_count) : null,
      male_offspring: form.male_offspring ? parseInt(form.male_offspring) : null,
      female_offspring: form.female_offspring ? parseInt(form.female_offspring) : null,
      status: form.status, notes: form.notes || null,
      created_at: editId ? (records.find(r => r.id === editId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };
    if (editId) { BreedingStore.update(editId, record); toast.success('تم التحديث'); }
    else { BreedingStore.add(record); toast.success('تمت الإضافة'); }
    setShowModal(false); refresh();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    BreedingStore.delete(id); toast.success('تم الحذف'); refresh();
  };

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter);

  const stats = {
    total: records.length,
    pregnant: records.filter(r => r.status === 'pregnant').length,
    born: records.filter(r => r.status === 'born').length,
    totalOffspring: records.reduce((s, r) => s + (r.offspring_count || 0), 0),
  };

  const allBreeds = [...settings.goatBreeds, ...settings.sheepBreeds];

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'إجمالي السجلات', value: stats.total, color: 'var(--accent-orange)' },
          { label: 'حوامل الآن', value: stats.pregnant, color: '#2196f3' },
          { label: 'ولادات ناجحة', value: stats.born, color: 'var(--wonder-green)' },
          { label: 'إجمالي المواليد', value: stats.totalOffspring, color: '#ffc107' },
        ].map(s => (
          <div key={s.label} className="col-6 col-md-3">
            <div className="summary-card"><div className="summary-number" style={{ color: s.color }}>{ar(s.value)}</div><small className="text-gray">{s.label}</small></div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2 flex-wrap">
          {(['all', 'pending', 'pregnant', 'born', 'failed'] as const).map(f => {
            const count = f === 'all' ? records.length : records.filter(r => r.status === f).length;
            return (
              <button key={f} onClick={() => setFilter(f)} className="action-btn"
                style={filter === f ? { background: 'rgba(0,230,118,.15)', border: '1px solid rgba(0,230,118,.4)', color: 'var(--wonder-green)' } : {}}>
                {f === 'all' ? 'الكل' : STATUS_MAP[f].label} ({count})
              </button>
            );
          })}
        </div>
        <button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> تسجيل تقريع</button>
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="wonder-card text-center py-5 text-gray animate-in">
          <i className="bi bi-diagram-2 d-block mb-2" style={{ fontSize: '2.5rem' }} />
          لا توجد سجلات تكاثر
          <div className="mt-3"><button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> سجّل أول تقريع</button></div>
        </div>
      ) : filtered.map(r => {
        const st = STATUS_MAP[r.status];
        const daysLeft = r.expected_birth ? Math.ceil((new Date(r.expected_birth).getTime() - Date.now()) / 86400000) : null;
        return (
          <div key={r.id} className="vaccine-card animate-in">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-bold mb-1">
                  <i className={`bi ${st.icon}`} style={{ color: st.color, marginLeft: 8 }} />
                  <span className="type-badge" style={{ background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44`, marginLeft: 8 }}>{st.label}</span>
                </div>
                <div className="mb-1">
                  <span className="text-gray">الأنثى:</span> <span className="fw-bold">{r.female_tag || '—'}</span>
                  <span className="text-gray" style={{ margin: '0 8px' }}>|</span>
                  <span className="text-gray">الفحل:</span> <span className="fw-bold">{r.male_tag || '—'}</span>
                </div>
                <small className="text-gray">
                  {r.female_breed} • تاريخ التقريع: {r.mating_date}
                  {r.status === 'pregnant' && daysLeft !== null && (
                    <span style={{ color: daysLeft < 7 ? '#f44336' : 'var(--accent-orange)', marginRight: 8 }}>
                      {daysLeft > 0 ? `متبقي ${ar(daysLeft)} يوم` : 'موعد الولادة اليوم!'}
                    </span>
                  )}
                  {r.status === 'born' && r.offspring_count && (
                    <span className="green-text" style={{ marginRight: 8 }}>• {ar(r.offspring_count)} مواليد</span>
                  )}
                </small>
              </div>
              <div className="d-flex gap-2">
                <button className="action-btn" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => openEdit(r)}><i className="bi bi-pencil" /></button>
                <button className="action-btn danger" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => handleDelete(r.id)}><i className="bi bi-trash" /></button>
              </div>
            </div>
            {r.notes && <small className="text-gray d-block mt-2"><i className="bi bi-chat-left-text-fill" style={{ marginLeft: 4 }} />{r.notes}</small>}
          </div>
        );
      })}

      {/* Modal */}
      {showModal && (
        <div className="farm-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h4><i className="bi bi-diagram-2-fill accent-text" /> {editId ? 'تعديل سجل التكاثر' : 'تسجيل تقريع جديد'}</h4>

            <div className="row g-2">
              <div className="col-6">
                <label>النوع</label>
                <select value={form.female_species} onChange={e => set('female_species', e.target.value as any)}>
                  <option value="goat">ماعز</option>
                  <option value="sheep">أغنام</option>
                </select>
              </div>
              <div className="col-6">
                <label>سلالة الأنثى</label>
                <select value={form.female_breed} onChange={e => set('female_breed', e.target.value)}>
                  <option value="">— اختر —</option>
                  {(form.female_species === 'goat' ? settings.goatBreeds : settings.sheepBreeds).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label>رقم ترقيم الأنثى *</label>
                <input value={form.female_tag} onChange={e => set('female_tag', e.target.value)} placeholder="مثال: F-101" />
              </div>
              <div className="col-6">
                <label>رقم ترقيم الفحل</label>
                <input value={form.male_tag} onChange={e => set('male_tag', e.target.value)} placeholder="مثال: M-001" />
              </div>
            </div>

            <label>سلالة الفحل</label>
            <select value={form.male_breed} onChange={e => set('male_breed', e.target.value)}>
              <option value="">— اختر —</option>
              {allBreeds.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <div className="row g-2">
              <div className="col-6">
                <label>تاريخ التقريع *</label>
                <input type="date" value={form.mating_date} onChange={e => handleMatingDateChange(e.target.value)} />
              </div>
              <div className="col-6">
                <label>تاريخ الولادة المتوقع</label>
                <input type="date" value={form.expected_birth} onChange={e => set('expected_birth', e.target.value)} />
              </div>
            </div>

            <label>الحالة</label>
            <select value={form.status} onChange={e => set('status', e.target.value as any)}>
              <option value="pending">قيد الانتظار</option>
              <option value="pregnant">حامل</option>
              <option value="born">ولدت</option>
              <option value="failed">إجهاض / فشل</option>
            </select>

            {form.status === 'born' && (
              <>
                <label>تاريخ الولادة الفعلي</label>
                <input type="date" value={form.actual_birth} onChange={e => set('actual_birth', e.target.value)} />
                <div className="row g-2">
                  <div className="col-4"><label>إجمالي المواليد</label><input type="number" min="0" value={form.offspring_count} onChange={e => set('offspring_count', e.target.value)} /></div>
                  <div className="col-4"><label>ذكور</label><input type="number" min="0" value={form.male_offspring} onChange={e => set('male_offspring', e.target.value)} /></div>
                  <div className="col-4"><label>إناث</label><input type="number" min="0" value={form.female_offspring} onChange={e => set('female_offspring', e.target.value)} /></div>
                </div>
              </>
            )}

            <label>ملاحظات</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="أي ملاحظات..." />

            <div className="d-flex gap-2 justify-content-end mt-3">
              <button className="action-btn" onClick={() => setShowModal(false)}>إلغاء</button>
              <button className="action-btn primary" onClick={handleSave}>حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
