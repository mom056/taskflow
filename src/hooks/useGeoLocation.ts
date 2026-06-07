import { useState, useCallback } from 'react';
import { getNativeLocation } from '../lib/nativeServices';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export function useGeoLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCoordinates = useCallback(async (): Promise<LocationCoords> => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getNativeLocation();
      setLoading(false);
      return coords;
    } catch (err: any) {
      setLoading(false);
      const errMsg = err.message || 'فشل في التقاط موقعك الجغرافي';
      setError(errMsg);
      throw err;
    }
  }, []);

  return {
    getCoordinates,
    loading,
    error,
  };
}
