import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ar, todayAr } from '@/lib/farm-utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import Sidebar, { type PageId } from './layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import SpeciesPage from './pages/SpeciesPage';
import VaccinationsPage from './pages/VaccinationsPage';
import BreedingPage from './pages/BreedingPage';
import HealthPage from './pages/HealthPage';
import FinancePage from './pages/FinancePage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import DataNotesPage from './pages/DataNotesPage';
import AddAnimalModal from './modals/AddAnimalModal';
import MarkDeathModal from './modals/MarkDeathModal';
import {
  NotificationStore, SettingsStore, HealthStore, BreedingStore,
  type AppNotification, type FarmSettings,
} from './shared/appTypes';
import type { Animal, Vaccination, Note } from './shared/appTypes';

const PAGE_TITLES: Record<PageId, string> = {
  dash: 'النظرة العامة', goats: 'قسم الماعز', sheep: 'قسم الأغنام',
  vaccine: 'التحصين', breeding: 'التكاثر والولادة', health: 'السجل الصحي',
  finance: 'المالية والحسابات', data: 'الملاحظات والبيانات',
  notifications: 'الإشعارات', settings: 'الإعدادات',
};

export default function FarmDashboard() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PageId>('dash');
  const [sidebar, setSidebar] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<FarmSettings>(SettingsStore.get());

  useEffect(() => {
    document.body.classList.add('farm-body');
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    return () => { document.body.classList.remove('farm-body'); };
  }, []);

  const refresh = useCallback(async () => {
    const [a, v, n] = await Promise.all([
      supabase.from('animals').select('*').limit(2000),
      supabase.from('vaccinations').select('*').order('scheduled_date', { ascending: true }),
      supabase.from('notes').select('*').order('created_at'),
    ]);
    if (a.data) setAnimals(a.data as Animal[]);
    if (v.data) setVaccinations(v.data as Vaccination[]);
    if (n.data) setNotes(n.data as Note[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshNotifications = useCallback(() => {
    setNotifications(NotificationStore.getAll());
  }, []);

  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  useEffect(() => {
    if (loading) return;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const existing = new Set(NotificationStore.getAll().map(n => n.id));

    vaccinations.forEach(v => {
      if (v.status === 'overdue') {
        const id = `vacc-overdue-${v.id}`;
        if (!existing.has(id)) {
          NotificationStore.add({ id, type: 'danger', title: 'تحصين متأخر', message: `تحصين "${v.name}" لـ ${v.target_section} متأخر عن موعده`, date: todayStr, read: false, source: 'vaccination' });
        }
      }
      if (v.status === 'pending' && v.scheduled_date) {
        const daysLeft = Math.ceil((new Date(v.scheduled_date).getTime() - today.getTime()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= settings.vaccinationAlertDays) {
          const id = `vacc-due-${v.id}-${v.scheduled_date}`;
          if (!existing.has(id)) {
            NotificationStore.add({ id, type: 'warning', title: 'موعد تحصين قريب', message: `تحصين "${v.name}" لـ ${v.target_section} بعد ${ar(daysLeft)} يوم`, date: todayStr, read: false, source: 'vaccination' });
          }
        }
      }
    });

    BreedingStore.getAll().filter(r => r.status === 'pregnant' && r.expected_birth).forEach(r => {
      const daysLeft = Math.ceil((new Date(r.expected_birth!).getTime() - today.getTime()) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 7) {
        const id = `birth-due-${r.id}`;
        if (!existing.has(id)) {
          NotificationStore.add({ id, type: daysLeft <= 2 ? 'danger' : 'warning', title: 'موعد ولادة قريب', message: `الأنثى ${r.female_tag || r.female_breed} موعد ولادتها بعد ${ar(Math.max(0, daysLeft))} يوم`, date: todayStr, read: false, source: 'breeding' });
        }
      }
    });

    HealthStore.getAll().filter(r => r.status === 'active' && r.withdrawal_end >= todayStr).forEach(r => {
      const id = `withdrawal-${r.id}`;
      if (!existing.has(id)) {
        NotificationStore.add({ id, type: 'danger', title: 'تحذير: فترة سحب نشطة', message: `${r.animal_tag || r.animal_breed} على دواء ${r.medication} — لا يجوز البيع حتى ${r.withdrawal_end}`, date: todayStr, read: false, source: 'health' });
      }
    });

    refreshNotifications();
  }, [vaccinations, loading, settings.vaccinationAlertDays, refreshNotifications]);

  const alive = useMemo(() => animals.filter(a => a.status === 'alive'), [animals]);

  const stats = useMemo(() => {
    const totalGoats = alive.filter(a => a.species === 'goat' && a.purpose !== 'birth').length;
    const totalSheep = alive.filter(a => a.species === 'sheep' && a.purpose !== 'birth').length;
    const goatBirths = alive.filter(a => a.species === 'goat' && a.purpose === 'birth');
    const sheepBirths = alive.filter(a => a.species === 'sheep' && a.purpose === 'birth');
    return {
      total: totalGoats + totalSheep, totalGoats, totalSheep, dead: animals.filter(a => a.status === 'dead').length,
      goatBirths: { total: goatBirths.length, male: goatBirths.filter(a => a.gender === 'male').length, female: goatBirths.filter(a => a.gender === 'female').length },
      sheepBirths: { total: sheepBirths.length, male: sheepBirths.filter(a => a.gender === 'male').length, female: sheepBirths.filter(a => a.gender === 'female').length },
    };
  }, [alive, animals]);

  const breedStats = (breed: string) => {
    const list = alive.filter(a => a.breed === breed);
    const c = (g: 'male' | 'female', p: 'tarbiya' | 'tasmeen') => list.filter(a => a.gender === g && a.purpose === p).length;
    return { total: list.length, tarbiyaMale: c('male', 'tarbiya'), tarbiyaFemale: c('female', 'tarbiya'), tasmeenMale: c('male', 'tasmeen'), tasmeenFemale: c('female', 'tasmeen'), tarbiya: c('male', 'tarbiya') + c('female', 'tarbiya'), tasmeen: c('male', 'tasmeen') + c('female', 'tasmeen') };
  };

  const handleAdd = async (data: { species: 'goat' | 'sheep'; breed: string; gender: 'male' | 'female'; purpose: 'tarbiya' | 'tasmeen' | 'birth'; tag?: string; notes?: string }) => {
    const { error } = await supabase.from('animals').insert({ ...data, status: 'alive' });
    if (error) toast.error('فشل الإضافة: ' + error.message);
    else { toast.success('تمت إضافة الحيوان'); refresh(); }
  };

  const handleDeath = async (id: string) => {
    const { error } = await supabase.from('animals').update({ status: 'dead', died_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error('فشل التسجيل: ' + error.message);
    else { toast.success('تم تسجيل النفوق'); refresh(); }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = [['القسم','السلالة','ذكور تربية','إناث تربية','ذكور تسمين','إناث تسمين','الإجمالي'], ...settings.goatBreeds.map(b => { const s = breedStats(b); return ['الماعز',b,s.tarbiyaMale,s.tarbiyaFemale,s.tasmeenMale,s.tasmeenFemale,s.total]; }), ...settings.sheepBreeds.map(b => { const s = breedStats(b); return ['الأغنام',b,s.tarbiyaMale,s.tarbiyaFemale,s.tasmeenMale,s.tasmeenFemale,s.total]; }), [], ['إجمالي الماعز','','','','','',stats.totalGoats], ['إجمالي الأغنام','','','','','',stats.totalSheep], ['الإجمالي الكلي','','','','','',stats.total+stats.goatBirths.total+stats.sheepBirths.total], ['نفوق','','','','','',stats.dead]];
    const ws1 = XLSX.utils.aoa_to_sheet(summary); ws1['!cols'] = Array(7).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, ws1, 'الملخص');
    XLSX.writeFile(wb, `farm-report-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('تم تصدير التقرير');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0b0b0' }}>جاري التحميل...</div>;
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <>
      <div className={`sidebar-overlay ${sidebar ? 'active' : ''}`} onClick={() => setSidebar(false)} />
      {sidebar && (
        <Sidebar active={tab} onNav={t => { setTab(t); setSidebar(false); }} onClose={() => setSidebar(false)}
          notifications={notifications} settings={settings}
          onAddAnimal={() => { setShowAdd(true); setSidebar(false); }}
          onMarkDeath={() => { setShowDeath(true); setSidebar(false); }}
          onExportExcel={() => { exportExcel(); setSidebar(false); }} />
      )}

      <nav className="navbar-wonder">
        <div className="container d-flex justify-content-between align-items-center">
          <a href="#" className="navbar-brand" onClick={e => { e.preventDefault(); setTab('dash'); }}>
            <span style={{ fontSize: '1.6rem' }}>🐐</span> {settings.farmName}
          </a>
          <div className="d-flex align-items-center gap-2">
            <span className="date-badge"><i className="bi bi-calendar3" /> {todayAr()}</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: '1.2rem', cursor: 'pointer', position: 'relative', padding: '6px 10px' }} onClick={() => setTab('notifications')}>
              <i className="bi bi-bell-fill" />
              {unread > 0 && <span style={{ position: 'absolute', top: 2, left: 2, background: '#f44336', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button className="menu-btn" onClick={() => setSidebar(true)} aria-label="القائمة"><i className="bi bi-list" /></button>
          </div>
        </div>
      </nav>

      <main className="container py-4">
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h4 className="fw-bold mb-0">{PAGE_TITLES[tab]}</h4>
            <small className="text-gray">{ar(stats.total + stats.goatBirths.total + stats.sheepBirths.total)} حيوان إجمالي{stats.dead > 0 && <span style={{ color: '#f44336', marginRight: 8 }}>• {ar(stats.dead)} نافق</span>}</small>
          </div>
          <ul className="nav nav-pills flex-nowrap overflow-auto" style={{ maxWidth: '100%' }}>
            {([{id:'dash',label:'الرئيسية'},{id:'goats',label:'ماعز'},{id:'sheep',label:'أغنام'},{id:'vaccine',label:'تحصين'},{id:'breeding',label:'تكاثر'},{id:'health',label:'صحة'},{id:'finance',label:'مالية'},{id:'data',label:'ملاحظات'}] as {id:PageId;label:string}[]).map(t => (
              <li className="nav-item" key={t.id}><button className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button></li>
            ))}
          </ul>
        </div>

        {tab === 'dash' && <DashboardPage animals={animals} settings={settings} onAddAnimal={() => setShowAdd(true)} onMarkDeath={() => setShowDeath(true)} />}
        {tab === 'goats' && <SpeciesPage species="goat" breeds={settings.goatBreeds} animals={animals} onAddAnimal={() => setShowAdd(true)} onMarkDeath={() => setShowDeath(true)} />}
        {tab === 'sheep' && <SpeciesPage species="sheep" breeds={settings.sheepBreeds} animals={animals} onAddAnimal={() => setShowAdd(true)} onMarkDeath={() => setShowDeath(true)} />}
        {tab === 'vaccine' && <VaccinationsPage vaccinations={vaccinations} onRefresh={refresh} />}
        {tab === 'breeding' && <BreedingPage settings={settings} />}
        {tab === 'health' && <HealthPage settings={settings} animals={animals} />}
        {tab === 'finance' && <FinancePage settings={settings} />}
        {tab === 'data' && <DataNotesPage notes={notes} animals={animals} settings={settings} onRefresh={refresh} />}
        {tab === 'notifications' && <NotificationsPage notifications={notifications} onRefresh={refreshNotifications} />}
        {tab === 'settings' && <SettingsPage settings={settings} onSave={s => setSettings(s)} />}

        <footer className="text-center text-gray mt-5 pt-4 pb-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          © {ar(new Date().getFullYear())} {settings.farmName} — جميع الحقوق محفوظة
        </footer>
      </main>

      {showAdd && <AddAnimalModal settings={settings} onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {showDeath && <MarkDeathModal animals={animals} onClose={() => setShowDeath(false)} onConfirm={handleDeath} />}
    </>
  );
}
