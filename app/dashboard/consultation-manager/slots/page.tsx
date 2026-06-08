'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import {
  FiCalendar,
  FiClock,
  FiPlus,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiList,
  FiSettings,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiUsers,
  FiActivity,
  FiInfo,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiSave,
  FiCopy,
  FiEdit,
  FiEye,
  FiDownload,
  FiUpload
} from 'react-icons/fi';

// Constants - KEPT EXACTLY THE SAME
const DURATIONS = [15, 30, 45, 60] as const;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun'
};

/** 08:00–18:00 in 15-minute steps */
const GRID_TIMES: string[] = [];
for (let h = 8; h <= 18; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 18 && m > 0) break;
    GRID_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

// Utility functions - KEPT EXACTLY THE SAME
function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function slotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMins(start1),
    e1 = toMins(end1);
  const s2 = toMins(start2),
    e2 = toMins(end2);
  return s1 < e2 && s2 < e1;
}

function selectionHasOverlaps(times: string[], durationMinutes: number): boolean {
  const sorted = [...new Set(times)].sort();
  for (let i = 0; i < sorted.length; i++) {
    const e1 = addMinutesToTime(sorted[i], durationMinutes);
    for (let j = i + 1; j < sorted.length; j++) {
      const e2 = addMinutesToTime(sorted[j], durationMinutes);
      if (slotsOverlap(sorted[i], e1, sorted[j], e2)) return true;
    }
  }
  return false;
}

// Enhanced Components
const TimeSlotCard = ({ 
  time, 
  isSelected, 
  isDisabled, 
  onToggle 
}: { 
  time: string; 
  isSelected: boolean; 
  isDisabled?: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      className={`
        relative py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all duration-200
        ${isSelected 
          ? 'border-cyan-500 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg transform scale-105' 
          : 'border-gray-200 bg-white text-gray-700 hover:border-cyan-300 hover:shadow-md'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        group
      `}
    >
      <span className="relative z-10">{time}</span>
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl opacity-90" />
      )}
      {isSelected && <FiCheck className="absolute top-1 right-1 w-3 h-3 text-white z-20" />}
    </button>
  );
};

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: any; 
  color: string;
}) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-emerald-500 to-green-500',
    purple: 'from-purple-500 to-pink-500',
    orange: 'from-orange-500 to-red-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[color]} p-2 shadow-md`}>
          <Icon className="w-full h-full text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
    </div>
  );
};

const BulkSlotTemplate = ({ 
  slot, 
  index, 
  onUpdate, 
  onRemove 
}: { 
  slot: { start_time: string; duration_minutes: number }; 
  index: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}) => {
  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 hover:shadow-md transition-all">
      <div className="flex-1 min-w-[120px]">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Start Time</label>
        <select
          value={slot.start_time}
          onChange={(e) => onUpdate(index, 'start_time', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          {GRID_TIMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      
      <div className="flex-1 min-w-[120px]">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Duration</label>
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onUpdate(index, 'duration_minutes', d)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                slot.duration_minutes === d
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-cyan-300'
              }`}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
        title="Remove template"
      >
        <FiTrash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// Main Component
export default function ConsultationManagerSlotsPage() {
  const socket = useSocket();
  const todayIso = new Date().toISOString().slice(0, 10);

  // State - KEPT EXACTLY THE SAME
  const [mainTab, setMainTab] = useState<'create' | 'manage'>('create');
  const [createDate, setCreateDate] = useState('');
  const [createDuration, setCreateDuration] = useState<number>(30);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const [bulkDateFrom, setBulkDateFrom] = useState('');
  const [bulkDateTo, setBulkDateTo] = useState('');
  const [bulkRepeatOn, setBulkRepeatOn] = useState<string[]>([]);
  const [bulkSlots, setBulkSlots] = useState<{ start_time: string; duration_minutes: number }[]>([
    { start_time: '10:00', duration_minutes: 60 }
  ]);
  const [bulkSkipDates, setBulkSkipDates] = useState('');

  const [slots, setSlots] = useState<any[]>([]);
  const [totalSlots, setTotalSlots] = useState(0);
  const [slotsTotalPages, setSlotsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'booked' | 'today'>('all');
  const [tablePage, setTablePage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const fetchDataRef = useRef<() => Promise<void>>(async () => {});

  // Fetch function - KEPT EXACTLY THE SAME
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        status?: string;
        page?: number;
        limit?: number;
        date_from?: string;
        date_to?: string;
      } = { page: tablePage, limit: 20 };
      if (filterStatus === 'available' || filterStatus === 'booked') params.status = filterStatus;
      if (filterStatus === 'today') {
        params.date_from = todayIso;
        params.date_to = todayIso;
      }
      const res = await apiService.getConsultationSlotsAll(params);
      if (res?.success) {
        const rows = res.slots || [];
        setSlots(rows);
        const tot = Number(res.total) || 0;
        setTotalSlots(tot);
        const tp = Number(res.totalPages);
        setSlotsTotalPages(tp > 0 ? tp : Math.max(1, Math.ceil(tot / 20)));
      }
    } catch {
      showToast('Failed to load slots', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, tablePage, todayIso]);

  fetchDataRef.current = fetchData;

  // Effects - KEPT EXACTLY THE SAME
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const onUp = () => fetchDataRef.current();
    socket.on('slot_booked', onUp);
    socket.on('consultation_cancelled', onUp);
    return () => {
      socket.off('slot_booked', onUp);
      socket.off('consultation_cancelled', onUp);
    };
  }, [socket]);

  // Handlers - KEPT EXACTLY THE SAME
  const toggleGridCell = (t: string) => {
    if (!bulkSelectMode) {
      setSelectedSingle((prev) => (prev === t ? null : t));
      return;
    }
    setSelectedMulti((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };

  const handleCreateFromGrid = async () => {
    if (!createDate) {
      showToast('Choose a date', 'warning');
      return;
    }
    if (createDate < todayIso) {
      showToast('Cannot create slots in the past', 'warning');
      return;
    }
    if (!bulkSelectMode) {
      if (!selectedSingle) {
        showToast('Select a start time on the grid', 'warning');
        return;
      }
      setSaving(true);
      try {
        const res = await apiService.createConsultationSlotSingle({
          date: createDate,
          start_time: selectedSingle,
          duration_minutes: createDuration
        });
        if (res?.success) {
          showToast('Slot created', 'success');
          setSelectedSingle(null);
          fetchData();
        } else showToast(res?.message || 'Failed', 'error');
      } catch {
        showToast('Failed', 'error');
      } finally {
        setSaving(false);
      }
      return;
    }

    const times = Array.from(selectedMulti).sort();
    if (times.length === 0) {
      showToast('Select one or more times (bulk mode)', 'warning');
      return;
    }
    if (selectionHasOverlaps(times, createDuration)) {
      showToast('Selected times overlap for this duration — adjust selection', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.createConsultationSlotsDay({
        date: createDate,
        slots: times.map((start_time) => ({ start_time, duration_minutes: createDuration }))
      });
      if (res?.success) {
        showToast(`Created ${res.created?.length ?? 0} slot(s)`, 'success');
        setSelectedMulti(new Set());
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getBulkConflicts = () => {
    const conflicts: number[][] = [];
    const computed = bulkSlots.map((s, i) => ({
      i,
      start: s.start_time,
      end: addMinutesToTime(s.start_time, s.duration_minutes)
    }));
    for (let i = 0; i < computed.length; i++) {
      for (let j = i + 1; j < computed.length; j++) {
        if (slotsOverlap(computed[i].start, computed[i].end, computed[j].start, computed[j].end)) {
          conflicts.push([i, j]);
        }
      }
    }
    return conflicts;
  };

  const estimateBulk = () => {
    if (!bulkDateFrom || !bulkDateTo || bulkRepeatOn.length === 0) return 0;
    const from = new Date(bulkDateFrom);
    const to = new Date(bulkDateTo);
    const skipSet = new Set(bulkSkipDates.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean));
    let days = 0;
    const d = new Date(from);
    while (d <= to) {
      const dateStr = d.toISOString().slice(0, 10);
      if (!skipSet.has(dateStr)) {
        const dayName = DAYS[d.getDay()];
        if (bulkRepeatOn.includes(dayName)) days++;
      }
      d.setDate(d.getDate() + 1);
    }
    return days * bulkSlots.length;
  };

  const handleBulkRange = async () => {
    if (!bulkDateFrom || !bulkDateTo || bulkRepeatOn.length === 0 || bulkSlots.length === 0) {
      showToast('Fill all recurring fields', 'warning');
      return;
    }
    if (bulkDateTo <= bulkDateFrom) {
      showToast('End date must be after start', 'warning');
      return;
    }
    const daysDiff = Math.ceil((new Date(bulkDateTo).getTime() - new Date(bulkDateFrom).getTime()) / 86400000);
    if (daysDiff > 31) {
      showToast('Max 31 days', 'warning');
      return;
    }
    if (getBulkConflicts().length > 0) {
      showToast('Templates overlap', 'error');
      return;
    }
    if (!window.confirm(`Create approximately ${estimateBulk()} slots?`)) return;
    setSaving(true);
    try {
      const skipDates = bulkSkipDates
        .split(/[\s,]+/)
        .map((d) => d.trim())
        .filter(Boolean);
      const res = await apiService.createConsultationSlotsBulk({
        date_from: bulkDateFrom,
        date_to: bulkDateTo,
        repeat_on: bulkRepeatOn,
        slots: bulkSlots,
        skip_dates: skipDates.length ? skipDates : undefined
      });
      if (res?.success) {
        showToast(`Created ${res.created ?? 0} slots`, 'success');
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slotId: number) => {
    if (!window.confirm('Delete this slot?')) return;
    try {
      const res = await apiService.deleteConsultationSlot(slotId);
      if (res?.success) {
        showToast('Deleted', 'success');
        fetchData();
        setSelectedIds((prev) => {
          const n = new Set(prev);
          n.delete(slotId);
          return n;
        });
      } else showToast(res?.message || 'Cannot delete', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast('Select slots', 'warning');
      return;
    }
    if (!window.confirm(`Delete ${ids.length} slot(s)?`)) return;
    try {
      const res = await apiService.deleteConsultationSlotsBulk(ids);
      if (res?.success) {
        showToast('Deleted', 'success');
        setSelectedIds(new Set());
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const slotDateStr = (s: { date: string | Date }) => {
    const d = s.date;
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  };

  const rowStatus = (s: any) => {
    const d = slotDateStr(s);
    if (d < todayIso) return 'past';
    if (s.is_booked) return 'booked';
    if (s.is_active === 0) return 'inactive';
    return 'available';
  };

  const toggleSelect = (id: number, booked: boolean) => {
    if (booked) return;
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      const availableIds = slots
        .filter(s => !s.is_booked && rowStatus(s) !== 'past')
        .map(s => s.id);
      setSelectedIds(new Set(availableIds));
    }
    setSelectAll(!selectAll);
  };

  // Stats calculation
  const availableCount = slots.filter(s => rowStatus(s) === 'available').length;
  const bookedCount = slots.filter(s => rowStatus(s) === 'booked').length;
  const todayCount = slots.filter(s => slotDateStr(s) === todayIso).length;
  const conflicts = getBulkConflicts();

  return (
    <div className="w-full max-w-full 2xl:max-w-[1800px] mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-50 via-blue-50 to-purple-50 rounded-3xl -z-10 opacity-50" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <FiCalendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Consultation Slots
              </h1>
            </div>
            <p className="text-gray-600 ml-14">
              Create and manage your availability for consultations
            </p>
          </div>
          
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMainTab('create')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                mainTab === 'create' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiPlus className="w-4 h-4" />
              Create Slots
            </button>
            <button
              type="button"
              onClick={() => setMainTab('manage')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                mainTab === 'manage' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiList className="w-4 h-4" />
              Manage Slots
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {mainTab === 'manage' && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Available Slots" value={availableCount} icon={FiCheck} color="green" />
          <StatCard title="Booked Slots" value={bookedCount} icon={FiUsers} color="blue" />
          <StatCard title="Today's Slots" value={todayCount} icon={FiCalendar} color="purple" />
        </div>
      )}

      {mainTab === 'create' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Basic Settings */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2 w-4 h-4" />
                  Select Date
                </label>
                <input
                  type="date"
                  min={todayIso}
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  <FiClock className="inline mr-2 w-4 h-4" />
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCreateDuration(d)}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                        createDuration === d
                          ? 'border-cyan-500 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-cyan-300'
                      }`}
                    >
                      {d} minutes
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-cyan-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-700">
                    <FiGrid className="inline mr-2 w-4 h-4" />
                    Selection Mode
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bulkSelectMode}
                    onClick={() => {
                      setBulkSelectMode((v) => !v);
                      setSelectedSingle(null);
                      setSelectedMulti(new Set());
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      bulkSelectMode ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                        bulkSelectMode ? 'translate-x-7' : ''
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {bulkSelectMode 
                    ? '✨ Bulk mode: Select multiple time slots at once' 
                    : '📍 Single mode: Choose one time slot'}
                </p>
              </div>
            </div>
            
            {/* Right Column - Info */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiInfo className="w-5 h-5 text-cyan-600" />
                Quick Guide
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <FiClock className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                  <span>Available times: 08:00 - 18:00 in 15-minute intervals</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiGrid className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                  <span>Toggle bulk mode to create multiple slots at once</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiAlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Overlapping slots are automatically prevented</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiCalendar className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                  <span>Students can book slots at least 48 hours in advance</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Time Grid */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Available Start Times
              {(bulkSelectMode ? selectedMulti.size > 0 : selectedSingle) && (
                <span className="ml-3 text-sm font-normal text-gray-500">
                  {bulkSelectMode 
                    ? `${selectedMulti.size} time${selectedMulti.size !== 1 ? 's' : ''} selected`
                    : `Selected: ${selectedSingle}`
                  }
                </span>
              )}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {GRID_TIMES.map((t) => (
                <TimeSlotCard
                  key={t}
                  time={t}
                  isSelected={bulkSelectMode ? selectedMulti.has(t) : selectedSingle === t}
                  onToggle={() => toggleGridCell(t)}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-200">
            <button
              type="button"
              disabled={saving}
              onClick={handleCreateFromGrid}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  {bulkSelectMode ? 'Create Slots' : 'Create Slot'}
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setSelectedSingle(null);
                setSelectedMulti(new Set());
              }}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <FiX className="w-4 h-4" />
              Clear Selection
            </button>
          </div>

          {/* Advanced Section */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
            >
              <span className="font-bold text-gray-700 flex items-center gap-2">
                <FiSettings className="w-4 h-4" />
                Advanced: Recurring Bulk Creation
              </span>
              {showAdvanced ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
            </button>
            
            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Date Range */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        min={todayIso}
                        value={bulkDateFrom}
                        onChange={(e) => setBulkDateFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="From"
                      />
                      <input
                        type="date"
                        min={bulkDateFrom || todayIso}
                        value={bulkDateTo}
                        onChange={(e) => setBulkDateTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="To"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Repeat On</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.slice(1, 6).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setBulkRepeatOn(prev => 
                            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                          )}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            bulkRepeatOn.includes(d)
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                              : 'bg-white border border-gray-300 text-gray-700 hover:border-cyan-300'
                          }`}
                        >
                          {DAY_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Skip Dates (Optional)</label>
                    <input
                      value={bulkSkipDates}
                      onChange={(e) => setBulkSkipDates(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="YYYY-MM-DD, comma-separated"
                    />
                  </div>
                </div>
                
                {/* Right side - Templates */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Time Templates</label>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {bulkSlots.map((slot, index) => (
                      <BulkSlotTemplate
                        key={index}
                        slot={slot}
                        index={index}
                        onUpdate={(idx, field, value) => {
                          setBulkSlots(prev => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], [field]: value };
                            return updated;
                          });
                        }}
                        onRemove={(idx) => setBulkSlots(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setBulkSlots(prev => [...prev, { start_time: '10:00', duration_minutes: 60 }])}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-cyan-300 hover:text-cyan-600 transition-all flex items-center justify-center gap-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Template
                  </button>
                  
                  {conflicts.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 flex items-center gap-2">
                        <FiAlertCircle className="w-4 h-4" />
                        Templates have overlapping times
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-700">
                      Estimated slots to create: <strong>{estimateBulk()}</strong>
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    disabled={saving || conflicts.length > 0}
                    onClick={handleBulkRange}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FiCalendar className="w-4 h-4" />
                    Create Recurring Slots
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mainTab === 'manage' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <FiList className="w-5 h-5 text-cyan-600" />
                Slot Inventory
              </h2>
              
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all flex items-center gap-2"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Delete {selectedIds.size} Selected
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={fetchData}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
                  title="Refresh"
                >
                  <FiRefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="px-6 py-3 bg-white border-b border-gray-200">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as typeof filterStatus);
                  setTablePage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Slots</option>
                <option value="available">Available Only</option>
                <option value="booked">Booked Only</option>
                <option value="today">Today's Slots</option>
              </select>
              
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
              >
                {selectAll ? 'Deselect All' : 'Select All Available'}
              </button>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-100 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                    <th className="p-4 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Time</th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Duration</th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s, index) => {
                    const d = slotDateStr(s);
                    const st = rowStatus(s);
                    const isPast = d < todayIso;
                    
                    return (
                      <tr 
                        key={s.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        } ${isPast ? 'opacity-50' : ''}`}
                      >
                        <td className="p-4">
                          {!s.is_booked && !isPast && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(s.id)}
                              onChange={() => toggleSelect(s.id, !!s.is_booked)}
                              className="rounded border-gray-300"
                            />
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-gray-900">{d}</span>
                          {d === todayIso && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">Today</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded text-xs">
                            {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-700">{s.duration_minutes ?? '—'} min</span>
                        </td>
                        <td className="p-4">
                          {st === 'past' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                              <FiClock className="w-3 h-3" />
                              Past
                            </span>
                          )}
                          {st === 'available' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                              <FiCheck className="w-3 h-3" />
                              Available
                            </span>
                          )}
                          {st === 'booked' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-semibold">
                              <FiUsers className="w-3 h-3" />
                              Booked
                            </span>
                          )}
                          {st === 'inactive' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                              <FiAlertCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="p-4 max-w-[200px]">
                          {s.student_email ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 text-sm">{s.student_name || '—'}</span>
                              <span className="text-xs text-gray-500 truncate">{s.student_email}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {st === 'available' && !isPast && (
                              <button
                                type="button"
                                onClick={() => handleDelete(s.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete slot"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            )}
                            {st === 'booked' && s.student_id && (
                              <Link
                                href={`/dashboard/consultation-manager/students/${s.student_id}`}
                                className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all"
                                title="View student"
                              >
                                <FiEye className="w-4 h-4" />
                              </Link>
                            )}
                            {st === 'available' && !isPast && (
                              <button
                                type="button"
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                title="Edit slot"
                              >
                                <FiEdit className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            
            {!loading && slots.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <FiCalendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No slots found</h3>
                <p className="text-sm text-gray-500">Try adjusting your filters or create new slots</p>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {slots.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{(tablePage - 1) * 20 + 1}</span> to{' '}
                  <span className="font-semibold">{Math.min(tablePage * 20, totalSlots)}</span> of{' '}
                  <span className="font-semibold">{totalSlots}</span> slots
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePage(p => p - 1)}
                    disabled={tablePage === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="px-4 py-2 text-sm font-medium">
                    Page {tablePage} of {Math.max(1, slotsTotalPages)}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setTablePage(p => p + 1)}
                    disabled={tablePage >= Math.max(1, slotsTotalPages)}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}