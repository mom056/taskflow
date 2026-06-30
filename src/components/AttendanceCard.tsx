import { useState, useEffect } from 'react';
import { useAttendance } from '../hooks/useAttendance';
import { Company } from '../types';
import { LocationCoords } from '../hooks/useGeoLocation';
import { Clock, MapPin, CheckCircle, Navigation, AlertCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttendanceCardProps {
  company?: Company;
  userCoords: LocationCoords | null;
  isLocating: boolean;
  getCoordinates: () => Promise<LocationCoords>;
  isOnline: boolean;
  addToQueue: (type: any, payload: any) => Promise<void>;
}

// Haversine formula to calculate distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export default function AttendanceCard({
  company,
  userCoords,
  isLocating,
  getCoordinates,
  isOnline,
  addToQueue
}: AttendanceCardProps) {
  const { checkIn, checkOut, activeRecord, isLoading } = useAttendance();
  const [notes, setNotes] = useState('');
  const [liveHours, setLiveHours] = useState('00:00:00');
  const [checking, setChecking] = useState(false);

  // Live Timer for checked-in shift duration
  useEffect(() => {
    if (!activeRecord) return;

    const timer = setInterval(() => {
      const diffMs = Date.now() - Number(activeRecord.checkInTime);
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      setLiveHours(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRecord]);

  const handleCheckIn = async () => {
    if (checking) return;
    setChecking(true);

    try {
      let coords = userCoords;
      if (!coords) {
        coords = await getCoordinates();
      }

      if (!coords) {
        toast.error('عذراً، يجب تفعيل خدمة تحديد الموقع الجغرافي GPS لتسجيل الحضور.');
        setChecking(false);
        return;
      }

      // Proximity determination
      let checkInType: 'office' | 'field' = 'field';
      let distance = 0;

      if (company?.hqLatitude && company?.hqLongitude) {
        distance = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          company.hqLatitude,
          company.hqLongitude
        );
        const radius = company.hqRadiusMeters || 200;
        if (distance <= radius) {
          checkInType = 'office';
        }
      }

      if (!isOnline) {
        // Save to offline queue
        const checkInPayload = {
          employee_id: null, // Resolves at sync
          company_id: null, // Resolves at sync
          check_in_time: Date.now(),
          check_in_lat: coords.latitude,
          check_in_lng: coords.longitude,
          check_in_type: checkInType,
          notes: notes || null,
          created_at: Date.now()
        };
        await addToQueue('check_in', checkInPayload);
        setNotes('');
        setChecking(false);
        return;
      }

      await checkIn({
        latitude: coords.latitude,
        longitude: coords.longitude,
        type: checkInType,
        notes: notes || undefined
      });
      setNotes('');
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء تسجيل الحضور');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckOut = async () => {
    if (checking || !activeRecord) return;
    setChecking(true);

    try {
      let coords = userCoords;
      try {
        coords = await getCoordinates();
      } catch (e) {
        // Fallback if location fails on check out, allow checking out
        console.warn('GPS failed for checkout, proceeding with null coords');
      }

      if (!isOnline) {
        // Save to offline queue
        const checkOutPayload = {
          id: activeRecord.id,
          data: {
            check_out_time: Date.now(),
            check_out_lat: coords?.latitude || null,
            check_out_lng: coords?.longitude || null
          }
        };
        await addToQueue('check_out', checkOutPayload);
        setChecking(false);
        return;
      }

      await checkOut({
        id: activeRecord.id,
        latitude: coords?.latitude,
        longitude: coords?.longitude
      });
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء تسجيل الانصراف');
    } finally {
      setChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-6 shadow-xl animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded mb-4"></div>
        <div className="h-12 w-full bg-slate-100 rounded-2xl"></div>
      </div>
    );
  }

  // Calculate distance to HQ for live visual help
  let distanceToHQText = '';
  let isNearHQ = false;
  if (userCoords && company?.hqLatitude && company?.hqLongitude) {
    const dist = calculateDistanceMeters(
      userCoords.latitude,
      userCoords.longitude,
      company.hqLatitude,
      company.hqLongitude
    );
    isNearHQ = dist <= (company.hqRadiusMeters || 200);
    distanceToHQText = dist >= 1000 
      ? `تبعد ${(dist / 1000).toFixed(2)} كم عن مقر العمل`
      : `تبعد ${Math.round(dist)} متر عن مقر العمل`;
  }

  return (
    <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/30 rounded-3xl p-6 shadow-2xl text-white">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-lg">تحضير الدوام اليومي</h3>
        </div>
        {!activeRecord && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md text-white/80 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            غير محضر
          </span>
        )}
        {activeRecord && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md text-emerald-400 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            على رأس العمل
          </span>
        )}
      </div>

      {!activeRecord ? (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">
            يرجى تسجيل الحضور للبدء في توثيق ساعات الدوام الرسمي.
          </p>

          {distanceToHQText && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-2xl ${isNearHQ ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{distanceToHQText} ({isNearHQ ? 'داخل النطاق الجغرافي للمقر' : 'خارج نطاق مقر العمل'})</span>
            </div>
          )}

          {/* Notes area */}
          <div>
            <textarea
              className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-2xl text-white placeholder-white/50 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all resize-none"
              placeholder="إضافة ملاحظة عند الحضور (اختياري)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <button
            onClick={handleCheckIn}
            disabled={checking || isLocating}
            className="w-full relative flex items-center justify-center gap-2 px-6 py-4 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 active:scale-98"
          >
            {checking || isLocating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري تحديد الموقع وتسجيل الحضور...
              </span>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                <span>تسجيل حضور العمل</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <span className="block text-slate-400 text-xs mb-1">وقت العمل المنقضي اليوم</span>
            <span className="font-mono text-3xl font-bold tracking-wider text-indigo-300">{liveHours}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="block text-slate-400 mb-1">توقيت الحضور</span>
              <span className="font-semibold">
                {new Date(activeRecord.checkInTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="block text-slate-400 mb-1">حالة التحضير</span>
              <span className={`font-semibold ${activeRecord.checkInType === 'office' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {activeRecord.checkInType === 'office' ? 'حضور بالمقر' : 'حضور ميداني'}
                {activeRecord.isLate && ' (متأخر)'}
              </span>
            </div>
          </div>

          {activeRecord.notes && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
              <span className="block text-slate-400 mb-1">ملاحظة الحضور:</span>
              <p className="text-slate-200 italic">"{activeRecord.notes}"</p>
            </div>
          )}

          <button
            onClick={handleCheckOut}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-linear-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/25 active:scale-98"
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري تسجيل الانصراف...
              </span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>تسجيل انصراف العمل</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
