import { useState, useEffect } from 'react';
import { useAttendance } from '../hooks/useAttendance';
import { Company } from '../types';
import { LocationCoords } from '../hooks/useGeoLocation';
import { Clock, MapPin, CheckCircle, Navigation, Plus, Minus, FileText } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
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
  const { language, t } = useTranslation();
  const { checkIn, checkOut, activeRecord, isLoading } = useAttendance();
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [liveHours, setLiveHours] = useState('00:00:00');
  const [checking, setChecking] = useState(false);

  // Live clock states for before check-in
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Update clock & date every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
      setCurrentDate(
        now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

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
        toast.error(t.attendance.gpsRequired);
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
        setShowNotes(false);
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
      setShowNotes(false);
    } catch (err: any) {
      console.error(err);
      toast.error(t.attendance.errorCheckIn);
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
      toast.error(t.attendance.errorCheckOut);
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

    const kmText = language === 'ar' ? 'كم' : 'km';
    const metersText = language === 'ar' ? 'متر' : 'meters';
    const awayText = language === 'ar' ? 'عن مقر العمل' : 'away from workplace';
    const prefix = language === 'ar' ? 'تبعد ' : '';
    distanceToHQText = dist >= 1000 
      ? `${prefix}${(dist / 1000).toFixed(2)} ${kmText} ${awayText}`
      : `${prefix}${Math.round(dist)} ${metersText} ${awayText}`;
  }

  return (
    <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/30 rounded-3xl p-6 shadow-2xl text-white">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-base">{t.attendance.title}</h3>
        </div>
        {!activeRecord && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md text-white/80 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {t.attendance.notCheckedIn}
          </span>
        )}
        {activeRecord && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md text-emerald-400 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            {t.attendance.checkedIn}
          </span>
        )}
      </div>

      {!activeRecord ? (
        <div className="space-y-4">
          {/* Elegant clock & date layout */}
          <div className="py-2 text-center bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs">
            <div className="font-mono text-3xl font-extrabold tracking-wider text-indigo-300 drop-shadow-md select-none">
              {currentTime || '00:00:00'}
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5 font-medium">
              {currentDate}
            </div>
          </div>

          <p className="text-slate-300 text-xs text-center leading-relaxed">
            {t.attendance.description}
          </p>

          {distanceToHQText && (
            <div className={`flex items-center gap-2 text-[10px] px-3 py-2.5 rounded-xl ${isNearHQ ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold leading-snug">
                {distanceToHQText} ({isNearHQ ? (language === 'ar' ? 'داخل النطاق الجغرافي للمقر' : 'Within range') : (language === 'ar' ? 'خارج نطاق مقر العمل' : 'Outside range')})
              </span>
            </div>
          )}

          {/* Toggle note area */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold bg-transparent border-none outline-none cursor-pointer hover:text-indigo-300"
            >
              {showNotes ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showNotes ? t.attendance.hideNote : t.attendance.addNote}</span>
            </button>

            {showNotes && (
              <textarea
                className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-2xl text-white placeholder-white/50 text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all resize-none animate-fadeIn"
                placeholder={t.attendance.notePlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            )}
          </div>

          <button
            onClick={handleCheckIn}
            disabled={checking || isLocating}
            className="w-full relative flex items-center justify-center gap-2 px-6 py-3.5 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 active:scale-98 cursor-pointer border-none text-xs"
          >
            {checking || isLocating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {t.attendance.checkingIn}
              </span>
            ) : (
              <>
                <Navigation className="w-4.5 h-4.5" />
                <span>{t.attendance.checkInBtn}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
            <span className="block text-slate-400 text-[10px] mb-1">{t.attendance.hoursElapsed}</span>
            <span className="font-mono text-3xl font-extrabold tracking-wider text-indigo-300">{liveHours}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="block text-slate-400 mb-1">{t.attendance.checkInTimeLabel}</span>
              <span className="font-bold">
                {new Date(activeRecord.checkInTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <span className="block text-slate-400 mb-1">{t.attendance.statusLabel}</span>
              <span className={`font-bold ${activeRecord.checkInType === 'office' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {activeRecord.checkInType === 'office' ? t.attendance.officeCheckIn : t.attendance.fieldCheckIn}
                {activeRecord.isLate && ` (${t.attendance.late})`}
              </span>
            </div>
          </div>

          {activeRecord.notes && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px]">
              <span className="block text-slate-400 mb-0.5">{t.attendance.noteLabel}</span>
              <p className="text-slate-200 italic m-0">"{activeRecord.notes}"</p>
            </div>
          )}

          <button
            onClick={handleCheckOut}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-linear-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/25 active:scale-98 cursor-pointer border-none text-xs"
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {t.attendance.checkingOut}
              </span>
            ) : (
              <>
                <CheckCircle className="w-4.5 h-4.5" />
                <span>{t.attendance.checkOutBtn}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
