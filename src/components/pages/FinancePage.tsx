import { useState, useEffect, useMemo } from 'react';
import { ar } from '@/lib/farm-utils';
import { FinanceStore, genId } from '../shared/appTypes';
import { toast } from 'sonner';
import type { FinanceRecord, FarmSettings } from '../shared/appTypes';

type Props = { settings: FarmSettings };

const INCOME_CATS = ['بيع حيوانات', 'بيع ألبان', 'بيع صوف', 'إيراد آخر'];
const EXPENSE_CATS = ['أعلاف', 'أدوية وبيطرة', 'عمالة', 'كهرباء ومياه', 'معدات', 'نقل', 'مصروف آخر'];

type Form = { date: string; type: 'income' | 'expense'; category: string; amount: string; description: string; notes: string };
const EMPTY: Form = { date: new Date().toISOString().slice(0, 10), type: 'income', category: '', amount: '', description: '', notes: '' };

export default function FinancePage({ settings }: Props) {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => { setRecords(FinanceStore.getAll()); }, []);
  const refresh = () => setRecords(FinanceStore.getAll());
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const curr = settings.currency;

  const filtered = useMemo(() => {
    let r = records;
    if (filter !== 'all') r = r.filter(x => x.type === filter);
    if (monthFilter) r = r.filter(x => x.date.startsWith(monthFilter));
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [records, filter, monthFilter]);

  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    records.filter(r => r.type === 'expense').forEach(r => { map[r.category] = (map[r.category] || 0) + r.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const handleSave = () => {
    if (!form.amount || !form.category) { toast.error('يرجى إدخال المبلغ والفئة'); return; }
    const record: FinanceRecord = {
      id: genId(), date: form.date, type: form.type, category: form.category,
      amount: parseFloat(form.amount) || 0, description: form.description,
      notes: form.notes || null, created_at: new Date().toISOString(),
    };
    FinanceStore.add(record);
    toast.success('تمت الإضافة'); setShowModal(false); refresh();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل تريد حذف هذه المعاملة؟')) return;
    FinanceStore.delete(id); toast.success('تم الحذف'); refresh();
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="summary-card">
            <div className="summary-number green-text">{totalIncome.toLocaleString('ar-EG')} {curr}</div>
            <small className="text-gray">إجمالي الإيرادات</small>
          </div>
        </div>
        <div className="col-md-4">
          <div className="summary-card">
            <div className="summary-number accent-text">{totalExpense.toLocaleString('ar-EG')} {curr}</div>
            <small className="text-gray">إجمالي المصروفات</small>
          </div>
        </div>
        <div className="col-md-4">
          <div className="summary-card">
            <div className="summary-number" style={{ color: netProfit >= 0 ? 'var(--wonder-green)' : '#f44336' }}>
              {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString('ar-EG')} {curr}
            </div>
            <small className="text-gray">{netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</small>
          </div>
        </div>
      </div>

      {/* Expense breakdown */}
      {byCat.length > 0 && (
        <div className="wonder-card mb-4 animate-in">
          <h6 className="fw-bold mb-3"><i className="bi bi-pie-chart-fill accent-text" /> توزيع المصروفات</h6>
          {byCat.map(([cat, amt]) => {
            const pct = totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0;
            return (
              <div key={cat} className="mb-2">
                <div className="d-flex justify-content-between mb-1">
                  <small className="text-gray">{cat}</small>
                  <small className="fw-bold accent-text">{amt.toLocaleString('ar-EG')} {curr} ({pct}٪)</small>
                </div>
                <div className="progress-wonder">
                  <div className="progress-bar-wonder" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent-orange), #ff8a65)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="action-btn"
              style={filter === f ? { background: 'rgba(0,230,118,.15)', border: '1px solid rgba(0,230,118,.4)', color: 'var(--wonder-green)' } : {}}>
              {f === 'all' ? 'الكل' : f === 'income' ? 'إيرادات' : 'مصروفات'}
            </button>
          ))}
          <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '6px 12px', color: '#e8e8e8', fontSize: '.82rem' }}
            title="تصفية بالشهر" />
        </div>
        <button className="action-btn primary" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg" /> إضافة معاملة</button>
      </div>

      {/* Transactions */}
      {filtered.length === 0 ? (
        <div className="wonder-card text-center py-5 text-gray animate-in">
          <i className="bi bi-wallet2 d-block mb-2" style={{ fontSize: '2.5rem' }} />
          لا توجد معاملات مالية
          <div className="mt-3"><button className="action-btn primary" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg" /> أضف أول معاملة</button></div>
        </div>
      ) : (
        <div className="wonder-card p-0 animate-in">
          <div className="table-responsive">
            <table className="table table-dark table-bordered mb-0 align-middle" style={{ ['--bs-border-color' as any]: '#2a2a2a', fontSize: '.82rem' }}>
              <thead>
                <tr className="text-gray"><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="text-gray">{r.date}</td>
                    <td>
                      <span className={`type-badge ${r.type === 'income' ? 'badge-tarbiya' : 'badge-tasmeen'}`}>
                        {r.type === 'income' ? 'إيراد' : 'مصروف'}
                      </span>
                    </td>
                    <td>{r.category}</td>
                    <td>{r.description || <span className="text-gray">—</span>}</td>
                    <td className={`fw-bold ${r.type === 'income' ? 'green-text' : 'accent-text'}`}>
                      {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString('ar-EG')} {curr}
                    </td>
                    <td>
                      <button className="action-btn danger" style={{ padding: '3px 8px', fontSize: '.7rem' }} onClick={() => handleDelete(r.id)}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  <td colSpan={4} className="fw-bold text-gray">الإجمالي (الفترة المعروضة)</td>
                  <td colSpan={2} className="fw-bold">
                    <span className="green-text">+{filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0).toLocaleString('ar-EG')}</span>
                    {' / '}
                    <span className="accent-text">-{filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0).toLocaleString('ar-EG')}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="farm-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="farm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h4><i className="bi bi-wallet2 accent-text" /> إضافة معاملة مالية</h4>

            <div className="row g-2">
              <div className="col-6">
                <label>التاريخ</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="col-6">
                <label>النوع</label>
                <select value={form.type} onChange={e => { set('type', e.target.value); set('category', ''); }}>
                  <option value="income">إيراد</option>
                  <option value="expense">مصروف</option>
                </select>
              </div>
            </div>

            <label>الفئة *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">— اختر —</option>
              {(form.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="row g-2">
              <div className="col-6">
                <label>المبلغ ({curr}) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
              </div>
              <div className="col-6">
                <label>الوصف</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="تفاصيل المعاملة" />
              </div>
            </div>

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
