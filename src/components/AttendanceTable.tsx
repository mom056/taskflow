import { useState, useMemo } from 'react';
import { useAttendance } from '../hooks/useAttendance';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { Search, MapPin, Calendar, Clock, Download, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import AppLoader from './AppLoader';

// Helper to format timestamps
function formatTime(timestamp?: number) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: number, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Distance in meters
}

export default function AttendanceTable() {
  const { company } = useAuth();
  const { records, isLoading, isError } = useAttendance();
  const { language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'office' | 'field'>('all');
  const [latenessFilter, setLatenessFilter] = useState<'all' | 'late' | 'ontime'>('all');

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Search term (employee name or email)
      const empName = record.employeeName || '';
      const empEmail = record.employeeEmail || '';
      const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            empEmail.toLowerCase().includes(searchTerm.toLowerCase());

      // Date filter
      let matchesDate = true;
      if (dateFilter) {
        const recordDateStr = new Date(record.checkInTime).toISOString().split('T')[0];
        matchesDate = recordDateStr === dateFilter;
      }

      // Check-in type
      let matchesType = true;
      if (typeFilter !== 'all') {
        matchesType = record.checkInType === typeFilter;
      }

      // Lateness
      let matchesLateness = true;
      if (latenessFilter === 'late') {
        matchesLateness = record.isLate;
      } else if (latenessFilter === 'ontime') {
        matchesLateness = !record.isLate;
      }

      return matchesSearch && matchesDate && matchesType && matchesLateness;
    });
  }, [records, searchTerm, dateFilter, typeFilter, latenessFilter]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    
    // Headers
    const headers = [
      language === 'ar' ? 'الموظف' : 'Employee',
      language === 'ar' ? 'التاريخ' : 'Date',
      language === 'ar' ? 'الحالة' : 'Status',
      language === 'ar' ? 'نوع الحضور' : 'Location Type',
      language === 'ar' ? 'وقت الحضور' : 'Check In',
      language === 'ar' ? 'مسافة الحضور (متر)' : 'Check In Distance (m)',
      language === 'ar' ? 'وقت الانصراف' : 'Check Out',
      language === 'ar' ? 'ساعات العمل' : 'Hours worked',
      language === 'ar' ? 'ملاحظات' : 'Notes'
    ];

    const rows = filteredRecords.map(r => {
      const distance = (r.checkInLat && r.checkInLng && company?.hqLatitude && company?.hqLongitude)
        ? Math.round(calculateDistance(r.checkInLat, r.checkInLng, company.hqLatitude, company.hqLongitude))
        : '-';

      return [
        r.employeeName || r.employeeEmail || '-',
        new Date(r.checkInTime).toLocaleDateString(),
        r.isLate ? (language === 'ar' ? 'متأخر' : 'Late') : (language === 'ar' ? 'منضبط' : 'On Time'),
        r.checkInType === 'office' ? (language === 'ar' ? 'مكتبي' : 'Office') : (language === 'ar' ? 'ميداني' : 'Field'),
        formatTime(r.checkInTime),
        distance,
        formatTime(r.checkOutTime),
        r.totalHours ? r.totalHours.toFixed(2) : '-',
        r.notes || ''
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <AppLoader size={40} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-2xl text-center font-semibold text-sm">
        {language === 'ar' ? 'حدث خطأ أثناء تحميل سجل الحضور والغياب' : 'Error loading attendance data.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            placeholder={language === 'ar' ? 'ابحث عن موظف بالاسم أو البريد...' : 'Search employee by name/email...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          {/* Type Filter */}
          <select
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">{language === 'ar' ? 'كافة المواقع' : 'All Locations'}</option>
            <option value="office">{language === 'ar' ? 'مكتبي فقط' : 'Office Only'}</option>
            <option value="field">{language === 'ar' ? 'ميداني فقط' : 'Field Only'}</option>
          </select>

          {/* Lateness Filter */}
          <select
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            value={latenessFilter}
            onChange={(e) => setLatenessFilter(e.target.value as any)}
          >
            <option value="all">{language === 'ar' ? 'حالة الانضباط (الكل)' : 'All Punctuality'}</option>
            <option value="ontime">{language === 'ar' ? 'منضبط فقط' : 'On Time Only'}</option>
            <option value="late">{language === 'ar' ? 'متأخر فقط' : 'Late Only'}</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors border-none cursor-pointer text-xs font-bold disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {language === 'ar' ? 'لا توجد سجلات حضور مطابقة للفلاتر المحددة.' : 'No attendance logs matched your filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                  <th className="px-5 py-4 text-start">{language === 'ar' ? 'الموظف' : 'Employee'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'الموقع' : 'Location'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'الحضور' : 'Check In'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'الانصراف' : 'Check Out'}</th>
                  <th className="px-4 py-4">{language === 'ar' ? 'المدة' : 'Hours'}</th>
                  <th className="px-5 py-4">{language === 'ar' ? 'تفاصيل / إحداثيات' : 'Details / Coords'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                {filteredRecords.map((r) => {
                  const checkInDistance = (r.checkInLat && r.checkInLng && company?.hqLatitude && company?.hqLongitude)
                    ? Math.round(calculateDistance(r.checkInLat, r.checkInLng, company.hqLatitude, company.hqLongitude))
                    : null;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-4 text-start">
                        <div>
                          <div className="font-bold text-slate-800">{r.employeeName || r.employeeEmail?.split('@')[0]}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{r.employeeEmail}</div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 text-slate-500 whitespace-nowrap">
                        {formatDate(r.checkInTime, language)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {r.isLate ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            {language === 'ar' ? 'متأخر' : 'Late'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <CheckCircle className="w-3 h-3" />
                            {language === 'ar' ? 'منضبط' : 'On Time'}
                          </span>
                        )}
                      </td>

                      {/* Check-in type */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          r.checkInType === 'office'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {r.checkInType === 'office' ? (language === 'ar' ? 'مكتب' : 'Office') : (language === 'ar' ? 'ميداني' : 'Field')}
                        </span>
                      </td>

                      {/* Check In time */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTime(r.checkInTime)}</span>
                        </div>
                      </td>

                      {/* Check Out time */}
                      <td className="px-4 py-4 text-slate-600">
                        {formatTime(r.checkOutTime)}
                      </td>

                      {/* Total hours */}
                      <td className="px-4 py-4 font-bold text-slate-800">
                        {r.totalHours ? `${r.totalHours.toFixed(1)} ${language === 'ar' ? 'س' : 'h'}` : '-'}
                      </td>

                      {/* Coords distance / map link */}
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {checkInDistance !== null ? (
                            <span className="text-[10px] block text-slate-400">
                              {language === 'ar' ? `على بعد ${checkInDistance}م` : `${checkInDistance}m away`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                          
                          {r.checkInLat && r.checkInLng && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${r.checkInLat},${r.checkInLng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer decoration-none"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {language === 'ar' ? 'عرض الموقع' : 'View Map'}
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
