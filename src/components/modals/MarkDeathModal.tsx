import { useState, useMemo } from 'react';
import type { Animal } from '../shared/appTypes';

type Props = {
  animals: Animal[];
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
};

export default function MarkDeathModal({ animals, onClose, onConfirm }: Props) {
  const [species, setSpecies] = useState<'goat' | 'sheep'>('goat');
  const [breed, setBreed] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const breeds = useMemo(() => {
    const set = new Set(animals.filter(a => a.species === species && a.status === 'alive').map(a => a.breed));
    return Array.from(set);
  }, [animals, species]);

  const candidates = useMemo(() => {
    return animals.filter(a => a.species === species && a.status === 'alive' && (!breed || a.breed === breed));
  }, [animals, species, breed]);

  const submit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await onConfirm(selectedId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="farm-modal-backdrop" onClick={onClose}>
      <div className="farm-modal" onClick={(e) => e.stopPropagation()}>
        <h4 style={{ color: '#ff8a8a' }}><i className="bi bi-exclamation-triangle"></i> تسجيل نفوق حيوان</h4>

        <label>النوع</label>
        <select value={species} onChange={(e) => { setSpecies(e.target.value as 'goat' | 'sheep'); setBreed(''); setSelectedId(''); }}>
          <option value="goat">ماعز</option>
          <option value="sheep">أغنام</option>
        </select>

        <label>السلالة</label>
        <select value={breed} onChange={(e) => { setBreed(e.target.value); setSelectedId(''); }}>
          <option value="">— الكل —</option>
          {breeds.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <label>اختر الحيوان (المتاح: {candidates.length})</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— اختر —</option>
          {candidates.slice(0, 200).map(a => (
            <option key={a.id} value={a.id}>
              {a.breed} • {a.gender === 'male' ? 'ذكر' : 'أنثى'} • {a.purpose === 'tarbiya' ? 'تربية' : a.purpose === 'tasmeen' ? 'تسمين' : 'مواليد'}{a.tag ? ` • ${a.tag}` : ''}
            </option>
          ))}
        </select>

        <div className="d-flex gap-2 justify-content-end mt-2">
          <button className="action-btn" onClick={onClose} disabled={saving}>إلغاء</button>
          <button className="action-btn danger" onClick={submit} disabled={saving || !selectedId}>
            {saving ? 'جاري الحفظ...' : 'تأكيد النفوق'}
          </button>
        </div>
      </div>
    </div>
  );
}
