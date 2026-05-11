import type { AppNotification, FarmSettings } from '../shared/appTypes';

export type PageId =
  | 'dash' | 'goats' | 'sheep' | 'vaccine'
  | 'breeding' | 'health' | 'finance'
  | 'data' | 'notifications' | 'settings';

type Props = {
  active: PageId;
  onNav: (p: PageId) => void;
  onClose: () => void;
  notifications: AppNotification[];
  settings: FarmSettings;
  onAddAnimal: () => void;
  onMarkDeath: () => void;
  onExportExcel: () => void;
};

const NAV_ITEMS: { id: PageId; icon: string; label: string; section?: string }[] = [
  { id: 'dash',          icon: 'bi-grid-1x2-fill',        label: 'النظرة العامة',      section: 'القطيع' },
  { id: 'goats',         icon: 'bi-tropical-storm',       label: 'قسم الماعز' },
  { id: 'sheep',         icon: 'bi-cloud-fill',           label: 'قسم الأغنام' },
  { id: 'vaccine',       icon: 'bi-bandaid-fill',         label: 'التحصين',            section: 'الصحة' },
  { id: 'health',        icon: 'bi-heart-pulse-fill',     label: 'السجل الصحي' },
  { id: 'breeding',      icon: 'bi-diagram-2-fill',       label: 'التكاثر والولادة',   section: 'الإدارة' },
  { id: 'finance',       icon: 'bi-wallet2',              label: 'المالية والحسابات' },
  { id: 'data',          icon: 'bi-clipboard-data-fill',  label: 'الملاحظات والبيانات' },
];

export default function Sidebar({ active, onNav, onClose, notifications, settings, onAddAnimal, onMarkDeath, onExportExcel }: Props) {
  const unread = notifications.filter(n => !n.read).length;

  return (
    <>
      <aside className={`sidebar-menu active`}>
        <div className="sidebar-header">
          <div>
            <div className="fw-bold" style={{ fontSize: '1.1rem' }}>{settings.farmName}</div>
            <small className="text-gray">القائمة الرئيسية</small>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="إغلاق">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div key={item.id}>
              {item.section && (
                <div style={{ padding: '10px 22px 4px', fontSize: '0.7rem', color: '#666', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {item.section}
                </div>
              )}
              <button
                className={`sidebar-item ${active === item.id ? 'active' : ''}`}
                onClick={() => { onNav(item.id); onClose(); }}
              >
                <i className={`bi ${item.icon}`} /> {item.label}
              </button>
            </div>
          ))}

          <div className="sidebar-divider" />

          {/* Notifications */}
          <button
            className={`sidebar-item ${active === 'notifications' ? 'active' : ''}`}
            onClick={() => { onNav('notifications'); onClose(); }}
            style={{ position: 'relative' }}
          >
            <i className="bi bi-bell-fill" />
            الإشعارات
            {unread > 0 && (
              <span style={{
                background: '#f44336', color: '#fff', borderRadius: '50%',
                width: 18, height: 18, fontSize: '0.65rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                marginRight: 'auto',
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {/* Settings */}
          <button
            className={`sidebar-item ${active === 'settings' ? 'active' : ''}`}
            onClick={() => { onNav('settings'); onClose(); }}
          >
            <i className="bi bi-gear-fill" /> الإعدادات
          </button>

          <div className="sidebar-divider" />

          {/* Quick Actions */}
          <button className="sidebar-item" onClick={() => { onAddAnimal(); onClose(); }}>
            <i className="bi bi-plus-circle-fill" style={{ color: 'var(--wonder-green)' }} /> إضافة حيوان
          </button>
          <button className="sidebar-item" onClick={() => { onMarkDeath(); onClose(); }}>
            <i className="bi bi-x-octagon-fill" style={{ color: '#f44336' }} /> تسجيل نفوق
          </button>
          <button className="sidebar-item" onClick={() => { onExportExcel(); onClose(); }}>
            <i className="bi bi-file-earmark-excel-fill" style={{ color: '#4caf50' }} /> تصدير Excel
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="d-flex align-items-center gap-3">
            <div className="user-avatar">{settings.ownerName.slice(0, 1)}</div>
            <div>
              <div className="fw-bold">{settings.ownerName}</div>
              <small className="green-text">
                <i className="bi bi-circle-fill" style={{ fontSize: 8 }} /> متصل الآن
              </small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
