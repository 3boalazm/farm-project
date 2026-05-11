import { useState, useEffect } from 'react';
import { ar } from '@/lib/farm-utils';
import { HealthStore, genId } from '../shared/appTypes';
import { toast } from 'sonner';
import type { HealthRecord, FarmSettings, Animal } from '../shared/appTypes';

type Props = { settings: FarmSettings; animals: Animal[] };

type Form = {
  animal_tag: string; animal_breed: string; animal_species: 'goat' | 'sheep';
  date: string; diagnosis: string; medication: string; dosage: string;
  withdrawal_days: string; treatment_end: string; status: 'active' | 'completed'; notes: string;
};

const EMPTY_FORM: Form = {
  animal_tag: '', animal_breed: '', animal_species: 'goat',
  date: new Date().toISOString().slice(0, 10), diagnosis: '', medication: '',
  dosage: '', withdrawal_days: '0', treatment_end: '', status: 'active', notes: '',
};

function calcWithdrawal(treatmentEnd: string, days: number): string {
  if (!treatmentEnd || days <= 0) return '';
  const d = new Date(treatmentEnd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function HealthPage({ settings, animals }: Props) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'withdrawal'>('all');

  useEffect(() => { setRecords(HealthStore.getAll()); }, []);
  const refresh = () => setRecords(HealthStore.getAll());
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const today = new Date().toISOString().slice(0, 10);

  const inWithdrawal = records.filter(r => r.withdrawal_end && r.withdrawal_end >= today && r.status === 'active');
  const active = records.filter(r => r.status === 'active');
  const completed = records.filter(r => r.status === 'completed');

  const filtered = filter === 'all' ? records
    : filter === 'active' ? active
    : filter === 'completed' ? completed
    : inWithdrawal;

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (r: HealthRecord) => {
    setForm({
      animal_tag: r.animal_tag, animal_breed: r.animal_breed, animal_species: r.animal_species,
      date: r.date, diagnosis: r.diagnosis, medication: r.medication, dosage: r.dosage,
      withdrawal_days: String(r.withdrawal_days), treatment_end: r.treatment_end,
      status: r.status, notes: r.notes || '',
    });
    setEditId(r.id); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.diagnosis || !form.medication) { toast.error('يرجى إدخال التشخيص والدواء'); return; }
    const withdrawal_end = calcWithdrawal(form.treatment_end, parseInt(form.withdrawal_days) || 0);
    const record: HealthRecord = {
      id: editId || genId(),
      animal_tag: form.animal_tag, animal_breed: form.animal_breed, animal_species: form.animal_species,
      date: form.date, diagnosis: form.diagnosis, medication: form.medication,
      dosage: form.dosage, withdrawal_days: parseInt(form.withdrawal_days) || 0,
      treatment_end: form.treatment_end, withdrawal_end,
      status: form.status, notes: form.notes || null,
      created_at: editId ? (records.find(r => r.id === editId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };
    if (editId) { HealthStore.update(editId, record); toast.success('تم التحديث'); }
    else { HealthStore.add(record); toast.success('تمت إضافة السجل الصحي'); }
    setShowModal(false); refresh();
  };

  const markComplete = (id: string) => {
    HealthStore.update(id, { status: 'completed' });
    toast.success('تم إكمال العلاج'); refresh();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    HealthStore.delete(id); toast.success('تم الحذف'); refresh();
  };

  return (
    <div>
      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'قيد العلاج', value: active.length, color: 'var(--accent-orange)' },
          { label: 'فترة سحب نشطة', value: inWithdrawal.length, color: '#f44336' },
          { label: 'علاجات مكتملة', value: completed.length, color: 'var(--wonder-green)' },
          { label: 'إجمالي السجلات', value: records.length, color: '#9e9e9e' },
        ].map(s => (
          <div key={s.label} className="col-6 col-md-3">
            <div className="summary-card"><div className="summary-number" style={{ color: s.color }}>{ar(s.value)}</div><small className="text-gray">{s.label}</small></div>
          </div>
        ))}
      </div>

      {/* Withdrawal Alert */}
      {inWithdrawal.length > 0 && (
        <div className="wonder-card animate-in mb-4" style={{ borderColor: 'rgba(244,67,54,.4)', background: 'rgba(244,67,54,.05)' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill" style={{ color: '#f44336', fontSize: '1.2rem' }} />
            <span className="fw-bold" style={{ color: '#f44336' }}>تحذير: حيوانات في فترة سحب</span>
          </div>
          <small className="text-gray">الحيوانات التالية لا يجب بيعها أو ذبحها حتى انتهاء فترة السحب:</small>
          <div className="mt-2">
            {inWithdrawal.map(r => {
              const daysLeft = Math.ceil((new Date(r.withdrawal_end).getTime() - Date.now()) / 86400000);
              return (
                <div key={r.id} className="d-flex align-items-center gap-2 mt-1">
                  <span className="type-badge" style={{ background: 'rgba(244,67,54,.12)', color: '#f44336', border: '1px solid rgba(244,67,54,.25)' }}>
                    {r.animal_tag || r.animal_breed}
                  </span>
                  <small className="text-gray">دواء: {r.medication} — ينتهي {r.withdrawal_end} ({ar(daysLeft)} يوم)</small>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2 flex-wrap">
          {[
            { f: 'all', label: 'الكل', count: records.length },
            { f: 'active', label: 'قيد العلاج', count: active.length },
            { f: 'withdrawal', label: 'فترة سحب', count: inWithdrawal.length },
            { f: 'completed', label: 'مكتملة', count: completed.length },
          ].map(x => (
            <button key={x.f} onClick={() => setFilter(x.f as any)} className="action-btn"
              style={filter === x.f ? { background: 'rgba(0,230,118,.15)', border: '1px solid rgba(0,230,118,.4)', color: 'var(--wonder-green)' } : {}}>
              {x.label} ({x.count})
            </button>
          ))}
        </div>
        <button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> سجل صحي جديد</button>
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="wonder-card text-center py-5 text-gray animate-in">
          <i className="bi bi-heart-pulse d-block mb-2" style={{ fontSize: '2.5rem' }} />
          لا توجد سجلات
          <div className="mt-3"><button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> أضف سجلاً صحياً</button></div>
        </div>
      ) : filtered.map(r => {
        const inW = r.withdrawal_end && r.withdrawal_end >= today;
        const wDays = inW ? Math.ceil((new Date(r.withdrawal_end).getTime() - Date.now()) / 86400000) : 0;
        return (
          <div key={r.id} className="vaccine-card animate-in">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-bold mb-1">
                  <span className={`type-badge ${r.status === 'completed' ? 'badge-tarbiya' : 'badge-tasmeen'}`} style={{ marginLeft: 8 }}>
                    {r.status === 'active' ? 'قيد العلاج' : 'مكتمل'}
                  </span>
                  {r.animal_tag && <span className="text-gray" style={{ fontSize: '.82rem', marginLeft: 8 }}>{r.animal_tag}</span>}
                  {r.animal_breed}
                </div>
                <div className="mb-1">
                  <span className="text-gray">التشخيص:</span> <span className="fw-bold">{r.diagnosis}</span>
                  <span className="text-gray" style={{ margin: '0 8px' }}>|</span>
                  <span className="text-gray">الدواء:</span> <span className="fw-bold">{r.medication}</span>
                  {r.dosage && <span className="text-gray" style={{ marginRight: 8 }}>— {r.dosage}</span>}
                </div>
                {inW && (
                  <small style={{ color: '#f44336' }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ marginLeft: 4 }} />
                    فترة السحب: {r.withdrawal_days} يوم — ينتهي {r.withdrawal_end} (متبقي {ar(wDays)} يوم)
                  </small>
                )}
                <small className="text-gray d-block">{r.date}</small>
              </div>
              <div className="d-flex gap-2">
                {r.status === 'active' && (
                  <button className="action-btn primary" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => markComplete(r.id)}>
                    <i className="bi bi-check-lg" /> إكمال
                  </button>
                )}
                <button className="action-btn" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => openEdit(r)}><i className="bi bi-pencil" /></button>
                <button className="action-btn danger" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => handleDelete(r.id)}><i className="bi bi-trash" /></button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal */}
      {showModal && (
        <div className="farm-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h4><i className="bi bi-heart-pulse-fill accent-text" /> {editId ? 'تعديل السجل الصحي' : 'سجل صحي جديد'}</h4>

            <div className="row g-2">
              <div className="col-6">
                <label>النوع</label>
                <select value={form.animal_species} onChange={e => set('animal_species', e.target.value as any)}>
                  <option value="goat">ماعز</option>
                  <option value="sheep">أغنام</option>
                </select>
              </div>
              <div className="col-6">
                <label>السلالة</label>
                <select value={form.animal_breed} onChange={e => set('animal_breed', e.target.value)}>
                  <option value="">— اختر —</option>
                  {(form.animal_species === 'goat' ? settings.goatBreeds : settings.sheepBreeds).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label>رقم الترقيم</label>
                <input value={form.animal_tag} onChange={e => set('animal_tag', e.target.value)} placeholder="مثال: A-123" />
              </div>
              <div className="col-6">
                <label>تاريخ العلاج *</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
            </div>

            <label>التشخيص *</label>
            <input value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} placeholder="مثال: التهاب رئوي" />

            <div className="row g-2">
              <div className="col-6">
                <label>الدواء *</label>
                <input value={form.medication} onChange={e => set('medication', e.target.value)} placeholder="اسم الدواء" />
              </div>
              <div className="col-6">
                <label>الجرعة</label>
                <input value={form.dosage} onChange={e => set('dosage', e.target.value)} placeholder="مثال: 5 مل" />
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label>تاريخ انتهاء العلاج</label>
                <input type="date" value={form.treatment_end} onChange={e => set('treatment_end', e.target.value)} />
              </div>
              <div className="col-6">
                <label>فترة السحب (أيام)</label>
                <input type="number" min="0" value={form.withdrawal_days} onChange={e => set('withdrawal_days', e.target.value)} />
              </div>
            </div>

            {form.treatment_end && parseInt(form.withdrawal_days) > 0 && (
              <div className="wonder-card mt-2" style={{ background: 'rgba(244,67,54,.05)', borderColor: 'rgba(244,67,54,.3)', padding: '10px 14px' }}>
                <small style={{ color: '#f44336' }}>
                  <i className="bi bi-exclamation-triangle-fill" style={{ marginLeft: 4 }} />
                  لا يجوز الذبح أو البيع قبل: {calcWithdrawal(form.treatment_end, parseInt(form.withdrawal_days) || 0)}
                </small>
              </div>
            )}

            <label>الحالة</label>
            <select value={form.status} onChange={e => set('status', e.target.value as any)}>
              <option value="active">قيد العلاج</option>
              <option value="completed">مكتمل</option>
            </select>

            <label>ملاحظات</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />

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
