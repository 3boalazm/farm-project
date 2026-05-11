import { useState } from 'react';
import type { FarmSettings } from '../shared/appTypes';

type Props = {
  settings: FarmSettings;
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

export default function AddAnimalModal({ settings, onClose, onSave }: Props) {
  const [species, setSpecies] = useState<'goat' | 'sheep'>('goat');
  const [breed, setBreed] = useState(settings.goatBreeds[0] || '');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [purpose, setPurpose] = useState<'tarbiya' | 'tasmeen' | 'birth'>('tarbiya');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const currentBreeds = species === 'goat' ? settings.goatBreeds : settings.sheepBreeds;

  const handleSpeciesChange = (v: 'goat' | 'sheep') => {
    setSpecies(v);
    const breeds = v === 'goat' ? settings.goatBreeds : settings.sheepBreeds;
    setBreed(breeds[0] || '');
  };

  const submit = async () => {
    if (quantity > 1 && tag) { /* single mode if tag provided */ }
    setSaving(true);
    try {
      for (let i = 0; i < quantity; i++) {
        await onSave({
          species,
          breed: purpose === 'birth' ? 'مواليد' : breed,
          gender, purpose,
          tag: quantity === 1 ? (tag || undefined) : (tag ? `${tag}-${i + 1}` : undefined),
          notes: notes || undefined,
        });
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="farm-modal-backdrop" onClick={onClose}>
      <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h4><i className="bi bi-plus-circle accent-text" /> إضافة حيوان جديد</h4>

        <label>النوع</label>
        <select value={species} onChange={e => handleSpeciesChange(e.target.value as 'goat' | 'sheep')}>
          <option value="goat">ماعز</option>
          <option value="sheep">أغنام</option>
        </select>

        <label>الغرض</label>
        <select value={purpose} onChange={e => setPurpose(e.target.value as 'tarbiya' | 'tasmeen' | 'birth')}>
          <option value="tarbiya">تربية</option>
          <option value="tasmeen">تسمين</option>
          <option value="birth">مواليد</option>
        </select>

        {purpose !== 'birth' && (
          <>
            <label>السلالة</label>
            <select value={breed} onChange={e => setBreed(e.target.value)}>
              {currentBreeds.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}

        <label>الجنس</label>
        <select value={gender} onChange={e => setGender(e.target.value as 'male' | 'female')}>
          <option value="female">أنثى</option>
          <option value="male">ذكر</option>
        </select>

        <div className="row g-2">
          <div className="col-6">
            <label>رقم الترقيم (اختياري)</label>
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder="مثال: A-123" />
          </div>
          <div className="col-6">
            <label>الكمية</label>
            <input type="number" min="1" max="500" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
          </div>
        </div>

        {quantity > 1 && (
          <div style={{ background: 'rgba(0,230,118,.08)', border: '1px solid rgba(0,230,118,.3)', borderRadius: 10, padding: '8px 12px', fontSize: '.82rem' }}>
            <i className="bi bi-info-circle green-text" style={{ marginLeft: 4 }} />
            سيتم إضافة <strong>{quantity}</strong> حيوانات مرة واحدة
          </div>
        )}

        <label>ملاحظات (اختياري)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="d-flex gap-2 justify-content-end mt-2">
          <button className="action-btn" onClick={onClose} disabled={saving}>إلغاء</button>
          <button className="action-btn primary" onClick={submit} disabled={saving}>
            {saving ? 'جاري الحفظ...' : `حفظ${quantity > 1 ? ` (${quantity})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
