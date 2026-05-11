import { ar } from '@/lib/farm-utils';
import { NotificationStore } from '../shared/appTypes';
import { toast } from 'sonner';
import type { AppNotification } from '../shared/appTypes';

type Props = {
  notifications: AppNotification[];
  onRefresh: () => void;
};

const TYPE_CONFIG = {
  danger: { color: '#f44336', bg: 'rgba(244,67,54,.08)', border: 'rgba(244,67,54,.3)', icon: 'bi-exclamation-triangle-fill' },
  warning: { color: 'var(--accent-orange)', bg: 'rgba(255,107,53,.08)', border: 'rgba(255,107,53,.3)', icon: 'bi-exclamation-circle-fill' },
  info: { color: '#2196f3', bg: 'rgba(33,150,243,.08)', border: 'rgba(33,150,243,.3)', icon: 'bi-info-circle-fill' },
  success: { color: 'var(--wonder-green)', bg: 'rgba(0,230,118,.08)', border: 'rgba(0,230,118,.3)', icon: 'bi-check-circle-fill' },
};

const SOURCE_LABEL: Record<string, string> = {
  vaccination: 'التحصين', breeding: 'التكاثر', health: 'الصحة', finance: 'المالية', system: 'النظام',
};

export default function NotificationsPage({ notifications, onRefresh }: Props) {
  const unread = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => { NotificationStore.markRead(id); onRefresh(); };
  const markAll = () => { NotificationStore.markAllRead(); toast.success('تم تحديد الكل كمقروء'); onRefresh(); };
  const clearAll = () => { if (!confirm('هل تريد حذف جميع الإشعارات؟')) return; NotificationStore.clearAll(); toast.success('تم مسح الإشعارات'); onRefresh(); };

  return (
    <div>
      {/* Header */}
      <div className="wonder-card animate-in mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-1"><i className="bi bi-bell-fill accent-text" /> الإشعارات</h5>
            <small className="text-gray">
              {unread > 0 ? <span className="accent-text fw-bold">{ar(unread)} غير مقروء</span> : 'لا توجد إشعارات جديدة'}
            </small>
          </div>
          <div className="d-flex gap-2">
            {unread > 0 && <button className="action-btn" onClick={markAll}><i className="bi bi-check2-all" /> تحديد الكل كمقروء</button>}
            {notifications.length > 0 && <button className="action-btn danger" onClick={clearAll}><i className="bi bi-trash" /> مسح الكل</button>}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length === 0 ? (
        <div className="wonder-card text-center py-5 text-gray animate-in">
          <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: '2.5rem' }} />
          لا توجد إشعارات حالياً
          <div className="mt-2"><small>ستظهر هنا تنبيهات التحصينات والولادات وفترات السحب</small></div>
        </div>
      ) : notifications.map(n => {
        const cfg = TYPE_CONFIG[n.type];
        return (
          <div key={n.id}
            className="animate-in"
            onClick={() => !n.read && markRead(n.id)}
            style={{
              background: n.read ? 'linear-gradient(135deg,#1a1a1a,#222)' : cfg.bg,
              border: `1px solid ${n.read ? '#2a2a2a' : cfg.border}`,
              borderRadius: 16, padding: '16px 20px', marginBottom: 10,
              cursor: n.read ? 'default' : 'pointer', transition: '.3s',
              borderRight: `4px solid ${cfg.color}`,
              opacity: n.read ? .7 : 1,
            }}>
            <div className="d-flex align-items-start gap-3">
              <i className={`bi ${cfg.icon} flex-shrink-0 mt-1`} style={{ color: cfg.color, fontSize: '1.1rem' }} />
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="fw-bold mb-1">{n.title}</div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="type-badge" style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44`, fontSize: '.65rem' }}>
                      {SOURCE_LABEL[n.source] || n.source}
                    </span>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />}
                  </div>
                </div>
                <div className="text-gray" style={{ fontSize: '.85rem' }}>{n.message}</div>
                <small className="text-gray" style={{ fontSize: '.72rem', opacity: .7 }}>{n.date}</small>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
