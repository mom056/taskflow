import { useState } from 'react';
import { useVisits } from '../hooks/useVisits';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LocationCoords } from '../hooks/useGeoLocation';
import { takeNativePhoto } from '../lib/nativeServices';
import { X, MapPin, Camera, AlertCircle, Sparkles } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords: LocationCoords | null;
  isLocating: boolean;
  getCoordinates: () => Promise<LocationCoords>;
  isOnline: boolean;
  addToQueue: (type: any, payload: any) => Promise<void>;
}

export default function VisitModal({
  isOpen,
  onClose,
  userCoords,
  isLocating,
  getCoordinates,
  isOnline,
  addToQueue
}: VisitModalProps) {
  const { createVisit, isCreating } = useVisits();
  const { profile } = useAuth();
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('30');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCapturePhoto = async () => {
    try {
      const file = await takeNativePhoto();
      if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn('Native camera failed, falling back to standard input:', err);
      // Trigger click on fallback input
      document.getElementById('fallback-camera-input')?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !location.trim() || submitting) return;

    setSubmitting(true);
    let coords = userCoords;
    
    try {
      if (!coords) {
        coords = await getCoordinates();
      }
    } catch (gpsErr) {
      toast.error('يجب تفعيل نظام تحديد المواقع GPS لتسجيل الزيارة.');
      setSubmitting(false);
      return;
    }

    try {
      let finalImageUrl: string | null = null;

      // Handle Image compression & upload if online
      if (imageFile) {
        if (isOnline) {
          setUploadingImage(true);
          try {
            const options = {
              maxSizeMB: 0.4,
              maxWidthOrHeight: 1000,
              useWebWorker: true,
              fileType: 'image/jpeg'
            };
            const compressed = await imageCompression(imageFile, options);
            const fileToUpload = new File([compressed], `visit_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            const filePath = `avatars/${profile?.id}_visit_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, fileToUpload, { upsert: true, contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            finalImageUrl = data.publicUrl;
          } catch (uploadErr: any) {
            console.error('Image upload failed:', uploadErr);
            toast.error('فشل رفع الصورة المرفقة، جاري المحاولة بدون صورة');
          } finally {
            setUploadingImage(false);
          }
        } else {
          // If offline, store image preview (base64 data URL) in the queue payload
          finalImageUrl = imagePreview;
        }
      }

      const timestamp = Date.now();
      const visitPayload = {
        location,
        notes: notes || null,
        clientName: clientName,
        client_name: clientName, // mapped for DB insert directly in queue
        employee_id: profile?.id,
        company_id: profile?.company_id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        imageUrl: finalImageUrl,
        image_url: finalImageUrl, // mapped for DB insert directly in queue
        durationMinutes: duration ? Number(duration) : undefined,
        duration_minutes: duration ? Number(duration) : undefined,
        checkInTime: timestamp,
        check_in_time: timestamp
      };

      if (!isOnline) {
        await addToQueue('create_visit', visitPayload);
        onClose();
        return;
      }

      await createVisit({
        location,
        notes,
        clientName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        imageUrl: finalImageUrl || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
        checkInTime: timestamp
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء تسجيل الزيارة');
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">تسجيل زيارة ميدانية جديدة</h3>
              <p className="text-slate-400 text-xs">توثيق زيارة عميل أو موقع خارجي ذاتياً</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Client Name */}
          <div>
            <label className="block text-slate-700 font-semibold text-sm mb-1.5">اسم العميل / الجهة</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="مثال: شركة الراجحي العقارية"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          {/* Location details */}
          <div>
            <label className="text-slate-700 font-semibold text-sm mb-1.5 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>العنوان الوصفي للموقع</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="مثال: طريق الملك فهد - الدور الثالث"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Duration & Notes Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-slate-700 font-semibold text-sm mb-1.5">المدة (دقيقة)</label>
              <select
                className="w-full px-3 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">ساعة</option>
                <option value="120">ساعتين</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-slate-700 font-semibold text-sm mb-1.5">ملاحظات الزيارة</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="تفاصيل المقابلة والهدف..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Photo Capture */}
          <div>
            <label className="block text-slate-700 font-semibold text-sm mb-1.5">صورة إثبات الزيارة (اختياري)</label>
            <input
              type="file"
              id="fallback-camera-input"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 h-40 flex items-center justify-center">
                <img src={imagePreview} alt="Visit Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-slate-900/80 rounded-full text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="w-full h-24 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-all gap-1.5 bg-slate-50/50"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs font-semibold">اضغط لالتقاط صورة للزيارة</span>
              </button>
            )}
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>أنت أوفلاين. سيتم حفظ كافة تفاصيل الزيارة والصورة محلياً ورفعها فور الاتصال.</span>
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
              disabled={submitting || uploadingImage || isLocating}
              className="flex-1 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-colors text-sm text-center flex items-center justify-center gap-2"
            >
              {submitting || uploadingImage || isLocating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري تسجيل الزيارة...
                </>
              ) : (
                'تسجيل الزيارة'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
