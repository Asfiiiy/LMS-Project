'use client';

export const C = {
  cyan: '#11CCEF',
  pink: '#E51791',
  green: '#61CE70',
  dark: '#0A0F1E',
  card: '#FFFFFF',
  muted: '#64748B',
  light: '#F1F5F9',
};

export function SectionCard({
  icon,
  title,
  accent = C.cyan,
  children,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: C.card,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{
          borderBottom: `1px solid rgba(0,0,0,0.06)`,
          background: `linear-gradient(135deg, ${accent}08 0%, ${accent}04 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)` }}
          >
            <span className="text-white w-4 h-4 flex items-center justify-center">{icon}</span>
          </div>
          <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: '#1E293B', letterSpacing: '0.08em' }}>
            {title}
          </h2>
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function StatusPill({
  status,
  dueDate,
  paidAtFormatted,
}: {
  status: 'paid' | 'due' | 'overdue';
  dueDate?: string | null;
  paidAtFormatted?: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = dueDate ? new Date(dueDate) : null;
  due?.setHours(0, 0, 0, 0);
  const daysUntilDue = due ? Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) : 0;
  const isOverdue = status === 'overdue' || (status === 'due' && due && due < today);
  const isDueSoon = status === 'due' && due && daysUntilDue >= 0 && daysUntilDue <= 7;
  const map = {
    paid: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: '✅ Paid' },
    due: {
      bg: isOverdue ? '#FEF2F2' : isDueSoon ? '#FFFBEB' : '#F1F5F9',
      color: isOverdue ? '#DC2626' : isDueSoon ? '#D97706' : '#64748B',
      border: isOverdue ? '#FECACA' : isDueSoon ? '#FDE68A' : '#E2E8F0',
      label: isOverdue ? '🔴 Overdue' : isDueSoon ? '🟡 Due' : '⚪ Upcoming',
    },
    overdue: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: '🔴 Overdue' },
  };
  const s = status === 'paid' ? map.paid : isOverdue ? { ...map.due, label: '🔴 Overdue' } : map.due;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isOverdue ? 'animate-pulse' : ''}`}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status === 'paid' && paidAtFormatted ? `${s.label} ${paidAtFormatted}` : s.label}
    </span>
  );
}
