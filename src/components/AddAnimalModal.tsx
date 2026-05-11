import { useState } from 'react';

type Props = {
  onClose: () => void;
  onSave: (data: {
    species: 'goat' | 'sheep';
    breed: string;
    gender: 'male' | 'female';
    purpose: 'tarbiya' | 'tasmeen' | 'birth';
    tag?: string;
    notes?: string;
  }) => Promise<void>;
};

const breeds = {
  goat: ['شامي', 'بور', 'بلدي'],
  sheep: ['برقي', 'دوربر', 'ميت ماستر'],
};

export default function AddAnimalModal({ onClose, onSave }: Props) {
  const [species, setSpecies] = useState<'goat' | 'sheep'>('goat');
  const [breed, setBreed] = useState('شامي');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [purpose, setPurpose] = useState<'tarbiya' | 'tasmeen' | 'birth'>('tarbiya');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ species, breed: purpose === 'birth' ? 'مواليد' : breed, gender, purpose, tag: tag || undefined, notes: notes || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="farm-modal-backdrop" onClick={onClose}>
      <div className="farm-modal" onClick={(e) => e.stopPropagation()}>
        <h4><i className="bi bi-plus-circle accent-text"></i> إضافة حيوان جديد</h4>

        <label>النوع</label>
        <select value={species} onChange={(e) => { const v = e.target.value as 'goat' | 'sheep'; setSpecies(v); setBreed(breeds[v][0]); }}>
          <option value="goat">ماعز</option>
          <option value="sheep">أغنام</option>
        </select>

        <label>الغرض</label>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as 'tarbiya' | 'tasmeen' | 'birth')}>
          <option value="tarbiya">تربية</option>
          <option value="tasmeen">تسمين</option>
          <option value="birth">مواليد</option>
        </select>

        {purpose !== 'birth' && (
          <>
            <label>السلالة</label>
            <select value={breed} onChange={(e) => setBreed(e.target.value)}>
              {breeds[species].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}

        <label>الجنس</label>
        <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
          <option value="female">أنثى</option>
          <option value="male">ذكر</option>
        </select>

        <label>رقم الترقيم (اختياري)</label>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="مثال: A-123" />

        <label>ملاحظات (اختياري)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="d-flex gap-2 justify-content-end mt-2">
          <button className="action-btn" onClick={onClose} disabled={saving}>إلغاء</button>
          <button className="action-btn primary" onClick={submit} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
