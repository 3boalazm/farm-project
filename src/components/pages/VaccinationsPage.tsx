import { useState } from 'react';
import { ar } from '@/lib/farm-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Vaccination } from '../shared/appTypes';

type Props = {
  vaccinations: Vaccination[];
  onRefresh: () => void;
};

type VaccForm = {
  name: string; target_section: string; count: string;
  scheduled_date: string; done_date: string; status: 'pending' | 'done' | 'overdue'; progress: string;
};

const EMPTY: VaccForm = { name: '', target_section: '', count: '', scheduled_date: '', done_date: '', status: 'pending', progress: '0' };

export default function VaccinationsPage({ vaccinations, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VaccForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'done' | 'pending' | 'overdue'>('all');

  const done = vaccinations.filter(v => v.status === 'done').reduce((s, v) => s + v.count, 0);
  const pending = vaccinations.filter(v => v.status === 'pending').reduce((s, v) => s + v.count, 0);
  const overdue = vaccinations.filter(v => v.status === 'overdue').reduce((s, v) => s + v.count, 0);
  const total = done + pending + overdue || 1;

  const filtered = filter === 'all' ? vaccinations : vaccinations.filter(v => v.status === filter);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (v: Vaccination) => {
    setForm({ name: v.name, target_section: v.target_section, count: String(v.count), scheduled_date: v.scheduled_date || '', done_date: v.done_date || '', status: v.status, progress: String(v.progress) });
    setEditId(v.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.target_section) { toast.error('يرجى ملء الاسم والقسم'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, target_section: form.target_section, count: parseInt(form.count) || 0, scheduled_date: form.scheduled_date || null, done_date: form.done_date || null, status: form.status, progress: parseInt(form.progress) || 0 };
      if (editId) {
        const { error } = await supabase.from('vaccinations').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('تم تحديث التحصين');
      } else {
        const { error } = await supabase.from('vaccinations').insert(payload);
        if (error) throw error;
        toast.success('تمت إضافة التحصين');
      }
      setShowModal(false); onRefresh();
    } catch (e: any) { toast.error('خطأ: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا التحصين؟')) return;
    const { error } = await supabase.from('vaccinations').delete().eq('id', id);
    if (error) toast.error('فشل الحذف'); else { toast.success('تم الحذف'); onRefresh(); }
  };

  const markDone = async (v: Vaccination) => {
    const { error } = await supabase.from('vaccinations').update({ status: 'done', done_date: new Date().toISOString().slice(0, 10), progress: 100 }).eq('id', v.id);
    if (error) toast.error('فشل التحديث'); else { toast.success('تم تسجيل التحصين كمنجز'); onRefresh(); }
  };

  const set = (k: keyof VaccForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      {/* Summary */}
      <div className="row g-3 mb-4">
        {[
          { label: 'تم التحصين', value: done, pct: Math.round(done / total * 100), color: 'var(--wonder-green)', clr: 'green-text' },
          { label: 'قيد الانتظار', value: pending, pct: Math.round(pending / total * 100), color: 'var(--accent-orange)', clr: 'accent-text' },
          { label: 'متأخر', value: overdue, pct: Math.round(overdue / total * 100), color: '#f44336', clr: '' },
        ].map(s => (
          <div key={s.label} className="col-md-4">
            <div className="summary-card">
              <div className="summary-number" style={{ color: s.color }}>{ar(s.value)}</div>
              <div className="text-gray">{s.label}</div>
              <small className={`fw-bold ${s.clr}`} style={!s.clr ? { color: '#f44336' } : {}}>{ar(s.pct)}٪ من الإجمالي</small>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2 flex-wrap">
          {(['all', 'pending', 'overdue', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="action-btn" style={filter === f ? { background: 'rgba(0,230,118,.15)', border: '1px solid rgba(0,230,118,.4)', color: 'var(--wonder-green)' } : {}}>
              {f === 'all' ? 'الكل' : f === 'done' ? 'منجز' : f === 'pending' ? 'قيد الانتظار' : 'متأخر'}
              <span style={{ marginRight: 6, opacity: .7 }}>({vaccinations.filter(v => f === 'all' || v.status === f).length})</span>
            </button>
          ))}
        </div>
        <button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> تحصين جديد</button>
      </div>

      {/* Vaccination Cards */}
      {filtered.length === 0 ? (
        <div className="wonder-card text-center py-5 text-gray animate-in">
          <i className="bi bi-bandaid d-block mb-2" style={{ fontSize: '2.5rem' }} />
          لا توجد تحصينات في هذه الفئة
          <div className="mt-3"><button className="action-btn primary" onClick={openAdd}><i className="bi bi-plus-lg" /> أضف تحصيناً</button></div>
        </div>
      ) : filtered.map(v => (
        <div key={v.id} className="vaccine-card animate-in">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="fw-bold mb-1">
                <span className={`vaccine-status status-${v.status}`} style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', marginLeft: 8, background: v.status === 'done' ? 'var(--wonder-green)' : v.status === 'overdue' ? '#f44336' : 'var(--accent-orange)' }} />
                {v.name}
              </div>
              <small className="text-gray">{v.target_section} • {ar(v.count)} رأس{v.scheduled_date ? ` • ${v.scheduled_date}` : ''}</small>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <div className={`fw-bold ${v.status === 'done' ? 'green-text' : v.status === 'overdue' ? '' : 'accent-text'}`}
                style={v.status === 'overdue' ? { color: '#f44336' } : {}}>
                {v.status === 'done' ? 'تم التنفيذ' : v.status === 'overdue' ? 'متأخر' : 'قيد الانتظار'}
              </div>
              {v.status !== 'done' && (
                <button className="action-btn primary" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => markDone(v)}>
                  <i className="bi bi-check-lg" /> تنفيذ
                </button>
              )}
              <button className="action-btn" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => openEdit(v)}><i className="bi bi-pencil" /></button>
              <button className="action-btn danger" style={{ padding: '4px 10px', fontSize: '.75rem' }} onClick={() => handleDelete(v.id)}><i className="bi bi-trash" /></button>
            </div>
          </div>
          <div className="progress-wonder">
            <div className="progress-bar-wonder" style={{ width: `${v.progress}%`, ...(v.status === 'overdue' ? { background: 'linear-gradient(90deg,#f44336,#ff8a65)' } : {}) }} />
          </div>
          <small className="text-gray" style={{ fontSize: '.7rem' }}>{ar(v.progress)}٪</small>
        </div>
      ))}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="farm-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h4><i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-circle'} accent-text`} /> {editId ? 'تعديل التحصين' : 'إضافة تحصين جديد'}</h4>

            <label>اسم التحصين *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: تحصين الجدري" />

            <label>القسم المستهدف *</label>
            <input value={form.target_section} onChange={e => set('target_section', e.target.value)} placeholder="مثال: جميع الماعز" />

            <div className="row g-2">
              <div className="col-6">
                <label>عدد الرؤوس</label>
                <input type="number" min="0" value={form.count} onChange={e => set('count', e.target.value)} placeholder="0" />
              </div>
              <div className="col-6">
                <label>الحالة</label>
                <select value={form.status} onChange={e => set('status', e.target.value as any)}>
                  <option value="pending">قيد الانتظار</option>
                  <option value="done">تم التنفيذ</option>
                  <option value="overdue">متأخر</option>
                </select>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label>تاريخ الموعد</label>
                <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
              </div>
              <div className="col-6">
                <label>تاريخ التنفيذ</label>
                <input type="date" value={form.done_date} onChange={e => set('done_date', e.target.value)} />
              </div>
            </div>

            <label>نسبة الإنجاز (٪)</label>
            <input type="range" min="0" max="100" value={form.progress} onChange={e => set('progress', e.target.value)} />
            <small className="text-gray">{form.progress}٪</small>

            <div className="d-flex gap-2 justify-content-end mt-3">
              <button className="action-btn" onClick={() => setShowModal(false)} disabled={saving}>إلغاء</button>
              <button className="action-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
