import { useState, useCallback } from 'react';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export function useGeoLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCoordinates = useCallback((): Promise<LocationCoords> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errMsg = 'متصفحك أو جهازك لا يدعم تحديد الموقع الجغرافي (GPS)';
        setError(errMsg);
        reject(new Error(errMsg));
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (err) => {
          setLoading(false);
          let errMsg = 'فشل في التقاط موقعك الجغرافي';
          if (err.code === err.PERMISSION_DENIED) {
            errMsg = 'يرجى تفعيل صلاحية تحديد الموقع (GPS) في متصفحك وهاتفك للمتابعة';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = 'إشارة الموقع غير متوفرة حالياً، يرجى المحاولة في مكان مفتوح';
          } else if (err.code === err.TIMEOUT) {
            errMsg = 'انتهت مهلة جلب الموقع، يرجى المحاولة مجدداً';
          }
          setError(errMsg);
          reject(new Error(errMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    getCoordinates,
    loading,
    error,
  };
}
