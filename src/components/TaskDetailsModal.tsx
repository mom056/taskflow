import { Task, User, statusLabels, statusColors } from '../types';
import { format } from 'date-fns';
import { MapPin, Calendar, Clock, User as UserIcon, FileText, ExternalLink, Image as ImageIcon, Edit2, X } from 'lucide-react';
import { openExternalUrl } from '../lib/nativeServices';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  employees: User[];
  onEditClick: (task: Task) => void;
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return 'أقل من دقيقة';
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays} يوم و ${remainingHours} ساعة`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours} ساعة و ${remainingMins} دقيقة`;
  }
  return `${diffMins} دقيقة`;
}

export default function TaskDetailsModal({ isOpen, onClose, task, employees, onEditClick }: TaskDetailsModalProps) {
  if (!isOpen || !task) return null;

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'غير معروف';

  const hasStartLocation = task.startLatitude && task.startLongitude;
  const hasEndLocation = task.latitude && task.longitude;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" dir="rtl">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop overlay */}
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose}></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-100">
          
          {/* Header */}
          <div className="bg-white px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              تفاصيل المهمة
            </h3>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer outline-none">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Title & Status */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-xl font-bold text-slate-900 leading-snug">{task.title}</h4>
                <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${statusColors[task.status]}`}>
                  {statusLabels[task.status]}
                </span>
              </div>
              {task.description && (
                <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 leading-relaxed border border-slate-100/50">
                  {task.description}
                </p>
              )}
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-slate-100 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">الموظف المسؤول</p>
                  <p className="text-sm font-semibold text-slate-800">{getEmployeeName(task.employeeId)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">المكان / العميل</p>
                  <p className="text-sm font-semibold text-slate-800">{task.location || 'غير محدد'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">تاريخ الاستحقاق</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {task.dueDate ? format(task.dueDate, 'yyyy/MM/dd') : 'غير محدد'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">تاريخ الإسناد</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {format(task.createdAt, 'yyyy/MM/dd - hh:mm a')}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Tracking & Durations */}
            <div className="space-y-4">
              <h5 className="font-bold text-sm text-slate-900">سجل التتبع والموقع الجغرافي</h5>
              
              <div className="space-y-3 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                {/* 1. Start Details */}
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">بدء العمل</p>
                      {hasStartLocation && (
                        <button
                          onClick={() => openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${task.startLatitude},${task.startLongitude}`)}
                          className="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 border-none rounded px-2 py-0.5 font-bold cursor-pointer transition flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          موقع البدء (GPS)
                        </button>
                      )}
                    </div>
                    {task.startLocationVerifiedAt ? (
                      <p className="text-xs text-slate-500">
                        {format(task.startLocationVerifiedAt, 'yyyy/MM/dd - hh:mm:ss a')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">لم يبدأ العمل بعد</p>
                    )}
                  </div>
                </div>

                {/* 2. End Details */}
                <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">إتمام العمل</p>
                      {hasEndLocation && (
                        <button
                          onClick={() => openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`)}
                          className="text-[10px] text-green-600 bg-green-50 hover:bg-green-100 border-none rounded px-2 py-0.5 font-bold cursor-pointer transition flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          موقع الإتمام (GPS)
                        </button>
                      )}
                    </div>
                    {task.locationVerifiedAt ? (
                      <p className="text-xs text-slate-500">
                        {format(task.locationVerifiedAt, 'yyyy/MM/dd - hh:mm:ss a')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">لم يكتمل العمل بعد</p>
                    )}
                  </div>
                </div>

                {/* 3. Duration */}
                {task.startLocationVerifiedAt && task.locationVerifiedAt && (
                  <div className="flex items-center justify-between text-xs bg-white rounded-lg p-2.5 border border-slate-100/50 mt-2">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      المدة المستغرقة:
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatDuration(task.startLocationVerifiedAt, task.locationVerifiedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Images from Employee */}
            {(task.notes || task.imageUrl) && (
              <div className="space-y-4">
                <h5 className="font-bold text-sm text-slate-900">ملاحظات ومرفقات الإتمام</h5>
                <div className="space-y-3">
                  {task.notes && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-1">ملاحظات الموظف:</p>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">{task.notes}</p>
                    </div>
                  )}

                  {task.imageUrl && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">صورة الإتمام الميدانية:</p>
                      <a 
                        href={task.imageUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          openExternalUrl(task.imageUrl!);
                        }}
                        className="block relative overflow-hidden rounded-xl border border-slate-200 group max-w-sm aspect-video bg-slate-100"
                      >
                        <img 
                          src={task.imageUrl} 
                          alt="صورة الإتمام" 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" />
                            عرض كامل الصورة
                          </span>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-row-reverse gap-3">
            <button 
              onClick={() => onEditClick(task)}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-1.5 rounded-xl border border-transparent px-5 py-2.5 bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer border-none"
            >
              <Edit2 className="w-4 h-4" />
              تعديل المهمة
            </button>
            <button 
              onClick={onClose}
              className="w-full sm:w-auto inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-5 py-2.5 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
