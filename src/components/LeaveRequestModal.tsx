import { useState } from 'react';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { X, FileText, Calendar, AlertCircle } from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  addToQueue: (type: any, payload: any) => Promise<void>;
}

export default function LeaveRequestModal({ isOpen, onClose, isOnline, addToQueue }: LeaveRequestModalProps) {
  const { createRequest, isCreating } = useLeaveRequests();
  const [type, setType] = useState<'excuse' | 'sick' | 'annual' | 'emergency'>('excuse');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !startDate || submitting) return;

    setSubmitting(true);
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = endDate ? new Date(endDate).getTime() : undefined;

    try {
      if (!isOnline) {
        // Save to offline queue
        const leavePayload = {
          employee_id: null,
          company_id: null,
          type,
          reason,
          start_date: startTimestamp,
          end_date: endTimestamp || null,
          status: 'pending',
          created_at: Date.now()
        };
        await addToQueue('create_leave_request', leavePayload);
        onClose();
        return;
      }

      await createRequest({
        type,
        reason,
        startDate: startTimestamp,
        endDate: endTimestamp
      });
      
      // Reset form
      setReason('');
      setStartDate('');
      setEndDate('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-100 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scaleIn">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">تقديم طلب إذن أو إجازة</h3>
              <p className="text-slate-400 text-xs">سيتم إرسال الطلب للمدير للمراجعة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-slate-700 font-semibold text-sm mb-2">نوع الطلب</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'excuse', label: 'إذن مغادرة (ساعات)' },
                { value: 'sick', label: 'إجازة مرضية' },
                { value: 'annual', label: 'إجازة سنوية' },
                { value: 'emergency', label: 'إجازة طارئة' }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value as any)}
                  className={`px-4 py-3 rounded-2xl border text-sm font-semibold transition-all ${
                    type === item.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 font-semibold text-sm mb-1.5 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>تاريخ البدء</span>
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-sm mb-1.5 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>تاريخ الانتهاء (اختياري)</span>
              </label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-slate-700 font-semibold text-sm mb-1.5">السبب / التفاصيل</label>
            <textarea
              required
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="اكتب سبب طلب الإجازة أو تفاصيل المغادرة بالتفصيل..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>أنت غير متصل بالإنترنت حالياً، سيتم حفظ الطلب محلياً وإرساله تلقائياً فور الاتصال.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors text-sm text-center"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isCreating || submitting}
              className="flex-1 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-colors text-sm text-center flex items-center justify-center gap-2"
            >
              {isCreating || submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري التقديم...
                </>
              ) : (
                'تقديم الطلب'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
