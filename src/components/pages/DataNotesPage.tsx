import { useState } from 'react';
import { ar } from '@/lib/farm-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Note, Animal, FarmSettings } from '../shared/appTypes';

type Props = {
  notes: Note[];
  animals: Animal[];
  settings: FarmSettings;
  onRefresh: () => void;
};

type BStats = { tarbiyaMale: number; tarbiyaFemale: number; tasmeenMale: number; tasmeenFemale: number; total: number };

type NoteForm = { category: 'goat' | 'sheep' | 'general'; body: string; tag: string };
const EMPTY_NOTE: NoteForm = { category: 'general', body: '', tag: '' };

export default function DataNotesPage({ notes, animals, settings, onRefresh }: Props) {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState<NoteForm>(EMPTY_NOTE);
  const [saving, setSaving] = useState(false);

  const alive = animals.filter(a => a.status === 'alive');

  const breedStats = (breed: string): BStats => {
    const list = alive.filter(a => a.breed === breed);
    const c = (g: 'male' | 'female', p: 'tarbiya' | 'tasmeen') => list.filter(a => a.gender === g && a.purpose === p).length;
    return {
      total: list.length, tarbiyaMale: c('male', 'tarbiya'), tarbiyaFemale: c('female', 'tarbiya'),
      tasmeenMale: c('male', 'tasmeen'), tasmeenFemale: c('female', 'tasmeen'),
    };
  };

  const goatTotals = settings.goatBreeds.reduce((acc, b) => {
    const s = breedStats(b);
    acc.tm += s.tarbiyaMale; acc.tf += s.tarbiyaFemale; acc.sm += s.tasmeenMale; acc.sf += s.tasmeenFemale; acc.t += s.total;
    return acc;
  }, { tm: 0, tf: 0, sm: 0, sf: 0, t: 0 });

  const sheepTotals = settings.sheepBreeds.reduce((acc, b) => {
    const s = breedStats(b);
    acc.tm += s.tarbiyaMale; acc.tf += s.tarbiyaFemale; acc.sm += s.tasmeenMale; acc.sf += s.tasmeenFemale; acc.t += s.total;
    return acc;
  }, { tm: 0, tf: 0, sm: 0, sf: 0, t: 0 });

  const totalGoats = alive.filter(a => a.species === 'goat' && a.purpose !== 'birth').length;
  const totalSheep = alive.filter(a => a.species === 'sheep' && a.purpose !== 'birth').length;
  const goatBirths = alive.filter(a => a.species === 'goat' && a.purpose === 'birth');
  const sheepBirths = alive.filter(a => a.species === 'sheep' && a.purpose === 'birth');

  const sheepNotes = notes.filter(n => n.category === 'sheep');
  const goatNotes = notes.filter(n => n.category === 'goat');
  const generalNotes = notes.filter(n => n.category === 'general');

  const saveNote = async () => {
    if (!noteForm.body.trim()) { toast.error('يرجى كتابة الملاحظة'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('notes').insert({ category: noteForm.category, body: noteForm.body.trim(), tag: noteForm.tag || null });
      if (error) throw error;
      toast.success('تمت إضافة الملاحظة'); setShowNoteModal(false); setNoteForm(EMPTY_NOTE); onRefresh();
    } catch (e: any) { toast.error('خطأ: ' + e.message); }
    finally { setSaving(false); }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الملاحظة؟')) return;
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) toast.error('فشل الحذف'); else { toast.success('تم الحذف'); onRefresh(); }
  };

  const NoteList = ({ items, label }: { items: Note[]; label: string }) => (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">{label} <small className="text-gray fw-normal">({items.length})</small></h5>
      </div>
      {items.length === 0 ? <small className="text-gray">لا توجد ملاحظات</small> : items.map((n, i) => (
        <div key={n.id} className="note-card d-flex gap-3">
          <div className="note-number">{ar(i + 1)}</div>
          <div className="flex-grow-1">
            <div>{n.body}</div>
            {n.tag && <small className="accent-text fw-bold">{n.tag}</small>}
          </div>
          <button onClick={() => deleteNote(n.id)} className="action-btn danger" style={{ padding: '3px 8px', fontSize: '.7rem', flexShrink: 0 }}>
            <i className="bi bi-trash" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Add Note Button */}
      <div className="d-flex justify-content-end mb-3">
        <button className="action-btn primary" onClick={() => setShowNoteModal(true)}>
          <i className="bi bi-plus-lg" /> إضافة ملاحظة
        </button>
      </div>

      {/* Notes Sections */}
      <div className="wonder-card animate-in mb-4">
        <h4 className="fw-bold mb-1"><i className="bi bi-clipboard-data-fill accent-text" /> ملاحظات التوريدات</h4>
        <small className="text-gray">سجل التوريدات والاستلامات والملاحظات العامة</small>
      </div>

      <NoteList items={sheepNotes} label="ملاحظات الأغنام" />
      <NoteList items={goatNotes} label="ملاحظات الماعز" />
      {generalNotes.length > 0 && <NoteList items={generalNotes} label="ملاحظات عامة" />}

      {/* Summary Table */}
      <h5 className="fw-bold mb-3 mt-4 animate-in">جدول ملخص البيانات</h5>
      <div className="wonder-card p-0 animate-in">
        <div className="table-responsive">
          <table className="table table-dark table-bordered mb-0 align-middle text-center" style={{ ['--bs-border-color' as any]: '#2a2a2a', fontSize: '.82rem' }}>
            <thead>
              <tr className="text-gray">
                <th>القسم</th><th>السلالة</th><th>ذكور تربية</th><th>إناث تربية</th><th>ذكور تسمين</th><th>إناث تسمين</th><th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {settings.goatBreeds.map((b, i) => {
                const s = breedStats(b);
                return (
                  <tr key={b}>
                    {i === 0 && <td rowSpan={settings.goatBreeds.length} className="green-text fw-bold">الماعز</td>}
                    <td>{b}</td><td>{ar(s.tarbiyaMale)}</td><td>{ar(s.tarbiyaFemale)}</td><td>{ar(s.tasmeenMale)}</td><td>{ar(s.tasmeenFemale)}</td><td className="fw-bold">{ar(s.total)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: 'rgba(0,230,118,.06)' }}>
                <td colSpan={2} className="green-text fw-bold">إجمالي الماعز</td>
                <td>{ar(goatTotals.tm)}</td><td>{ar(goatTotals.tf)}</td><td>{ar(goatTotals.sm)}</td><td>{ar(goatTotals.sf)}</td><td className="fw-bold green-text">{ar(goatTotals.t)}</td>
              </tr>
              {settings.sheepBreeds.map((b, i) => {
                const s = breedStats(b);
                return (
                  <tr key={b}>
                    {i === 0 && <td rowSpan={settings.sheepBreeds.length} className="fw-bold" style={{ color: '#2196f3' }}>الأغنام</td>}
                    <td>{b}</td><td>{ar(s.tarbiyaMale)}</td><td>{ar(s.tarbiyaFemale)}</td><td>{ar(s.tasmeenMale)}</td><td>{ar(s.tasmeenFemale)}</td><td className="fw-bold">{ar(s.total)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: 'rgba(33,150,243,.06)' }}>
                <td colSpan={2} className="fw-bold" style={{ color: '#2196f3' }}>إجمالي الأغنام</td>
                <td>{ar(sheepTotals.tm)}</td><td>{ar(sheepTotals.tf)}</td><td>{ar(sheepTotals.sm)}</td><td>{ar(sheepTotals.sf)}</td><td className="fw-bold" style={{ color: '#2196f3' }}>{ar(sheepTotals.t)}</td>
              </tr>
              <tr style={{ background: 'rgba(255,193,7,.06)' }}>
                <td colSpan={2} className="fw-bold" style={{ color: '#ffc107' }}>الولدات</td>
                <td colSpan={2}>ذكور: {ar(goatBirths.filter(a => a.gender === 'male').length + sheepBirths.filter(a => a.gender === 'male').length)}</td>
                <td colSpan={2}>إناث: {ar(goatBirths.filter(a => a.gender === 'female').length + sheepBirths.filter(a => a.gender === 'female').length)}</td>
                <td className="fw-bold" style={{ color: '#ffc107' }}>{ar(goatBirths.length + sheepBirths.length)}</td>
              </tr>
              <tr style={{ background: 'rgba(255,107,53,.1)' }}>
                <td colSpan={6} className="accent-text fw-bold">الإجمالي الكلي للمزرعة</td>
                <td className="accent-text fw-bold">{ar(totalGoats + totalSheep + goatBirths.length + sheepBirths.length)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="farm-modal-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h4><i className="bi bi-plus-circle accent-text" /> إضافة ملاحظة جديدة</h4>
            <label>القسم</label>
            <select value={noteForm.category} onChange={e => setNoteForm(f => ({ ...f, category: e.target.value as any }))}>
              <option value="general">عامة</option>
              <option value="goat">ماعز</option>
              <option value="sheep">أغنام</option>
            </select>
            <label>الملاحظة *</label>
            <textarea rows={3} value={noteForm.body} onChange={e => setNoteForm(f => ({ ...f, body: e.target.value }))} placeholder="اكتب الملاحظة هنا..." />
            <label>التصنيف (اختياري)</label>
            <input value={noteForm.tag} onChange={e => setNoteForm(f => ({ ...f, tag: e.target.value }))} placeholder="مثال: توريد جديد، استلام..." />
            <div className="d-flex gap-2 justify-content-end mt-3">
              <button className="action-btn" onClick={() => setShowNoteModal(false)} disabled={saving}>إلغاء</button>
              <button className="action-btn primary" onClick={saveNote} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
