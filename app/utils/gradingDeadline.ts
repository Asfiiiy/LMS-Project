/** 10-calendar-day grading rule from assignment submission date */
export function getGradeByDate(submittedAt: string | null | undefined): Date | null {
  if (!submittedAt) return null;
  const d = new Date(submittedAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 10);
  return d;
}

export function formatDateGB(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}
