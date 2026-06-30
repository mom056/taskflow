import { useState, useMemo } from 'react';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { useTranslation } from '../contexts/LanguageContext';
import { Clock, CheckCircle2, XCircle, Search, HelpCircle, MessageSquare } from 'lucide-react';
import AppLoader from './AppLoader';

export default function LeaveRequestsPanel() {
  const { requests, isLoading, isError, reviewRequest, isReviewing } = useLeaveRequests();
  const { language } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'excuse' | 'sick' | 'annual' | 'emergency'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Review notes indexed by request ID
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const empName = req.employeeName || '';
      const empEmail = req.employeeEmail || '';
      const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            empEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesType = typeFilter === 'all' || req.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const note = reviewNotes[id] || '';
    try {
      await reviewRequest({ id, status, reviewNote: note });
      // Clear note
      setReviewNotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      excuse: language === 'ar' ? 'إذن مغادرة / مغادرة مؤقتة' : 'Hourly Excuse',
      sick: language === 'ar' ? 'إجازة مرضية' : 'Sick Leave',
      annual: language === 'ar' ? 'إجازة سنوية' : 'Annual Leave',
      emergency: language === 'ar' ? 'إجازة طارئة' : 'Emergency Leave'
    };
    return labels[type] || type;
  };

  const getLeaveTypeStyle = (type: string) => {
    const styles: Record<string, string> = {
      excuse: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      sick: 'bg-rose-50 text-rose-700 border-rose-100',
      annual: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      emergency: 'bg-amber-50 text-amber-700 border-amber-100'
    };
    return styles[type] || 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
        {language === 'ar' ? 'حدث خطأ أثناء تحميل طلبات الإجازات' : 'Error loading leave requests.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
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

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending Approval'}</option>
            <option value="approved">{language === 'ar' ? 'تمت الموافقة' : 'Approved Requests'}</option>
            <option value="rejected">{language === 'ar' ? 'المرفوضة' : 'Rejected Requests'}</option>
            <option value="all">{language === 'ar' ? 'جميع الطلبات' : 'All Statuses'}</option>
          </select>

          {/* Type Filter */}
          <select
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs focus:outline-hidden text-slate-700 transition"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">{language === 'ar' ? 'كافة أنواع الإجازات' : 'All Leave Types'}</option>
            <option value="excuse">{language === 'ar' ? 'إذن مغادرة' : 'Excuse'}</option>
            <option value="sick">{language === 'ar' ? 'مرضية' : 'Sick'}</option>
            <option value="annual">{language === 'ar' ? 'سنوية' : 'Annual'}</option>
            <option value="emergency">{language === 'ar' ? 'طارئة' : 'Emergency'}</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
            {language === 'ar' ? 'لا توجد طلبات إجازة مطابقة حالياً.' : 'No leave requests matched your filters.'}
          </div>
        ) : (
          filteredRequests.map(req => (
            <div
              key={req.id}
              className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                req.status === 'pending'
                  ? 'border-indigo-100'
                  : req.status === 'approved'
                    ? 'border-emerald-100'
                    : 'border-rose-100'
              }`}
            >
              {/* Employee Info & Type Tag */}
              <div className="flex items-start justify-between gap-2">
                <div className="overflow-hidden">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{req.employeeName || req.employeeEmail?.split('@')[0]}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{req.employeeEmail}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getLeaveTypeStyle(req.type)} shrink-0`}>
                  {getLeaveTypeLabel(req.type)}
                </span>
              </div>

              {/* Period / Reason */}
              <div className="my-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {req.endDate ? (
                    <span>
                      {language === 'ar' ? 'الفترة:' : 'Period:'} {formatDate(req.startDate)} - {formatDate(req.endDate)}
                    </span>
                  ) : (
                    <span>
                      {language === 'ar' ? 'تاريخ الإذن:' : 'Excuse Date:'} {formatDate(req.startDate)}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/60 text-xs text-slate-600 leading-relaxed font-medium">
                  {req.reason}
                </div>
              </div>

              {/* Action buttons (Pending status) */}
              {req.status === 'pending' ? (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  {/* Review note input */}
                  <div className="relative">
                    <MessageSquare className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-[11px] focus:outline-hidden text-slate-700 transition"
                      placeholder={language === 'ar' ? 'أضف ملاحظة إدارية (اختياري)...' : 'Add manager note (optional)...'}
                      value={reviewNotes[req.id] || ''}
                      onChange={(e) => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(req.id, 'approved')}
                      disabled={isReviewing}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-none py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'موافقة' : 'Approve'}</span>
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'rejected')}
                      disabled={isReviewing}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white border-none py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'رفض' : 'Reject'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Audit log (Approved / Rejected) */
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    {req.status === 'approved' ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        {language === 'ar' ? 'مقبول' : 'Approved'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                        <XCircle className="w-3 h-3" />
                        {language === 'ar' ? 'مرفوض' : 'Rejected'}
                      </span>
                    )}
                    <span>• {language === 'ar' ? 'تمت المراجعة في' : 'Reviewed on'} {req.reviewedAt ? formatDate(req.reviewedAt) : ''}</span>
                  </div>

                  {req.reviewNote && (
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-500 italic mt-1 border border-slate-100">
                      {language === 'ar' ? 'ملاحظة الإدارة:' : 'Management Note:'} {req.reviewNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
