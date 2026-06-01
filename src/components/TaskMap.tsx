import { useEffect, useRef, useState } from 'react';
import { Task } from '../types';

interface TaskMapProps {
  tasks: Task[];
  getEmployeeName: (id: string) => string;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function TaskMap({ tasks, getEmployeeName }: TaskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Filter tasks with valid GPS coordinates
  const geoTasks = tasks.filter(
    (t) => t.latitude !== undefined && t.latitude !== null && 
           t.longitude !== undefined && t.longitude !== null
  );

  // Load Leaflet JS & CSS dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Clean up script/css links if desired, or leave them cached
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    // If map already initialized, clear markers
    if (mapRef.current) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    } else {
      // Average center or Riyadh as default [24.7136, 46.6753]
      let center: [number, number] = [24.7136, 46.6753];
      let zoom = 6;

      if (geoTasks.length > 0) {
        const sumLat = geoTasks.reduce((acc, t) => acc + Number(t.latitude), 0);
        const sumLng = geoTasks.reduce((acc, t) => acc + Number(t.longitude), 0);
        center = [sumLat / geoTasks.length, sumLng / geoTasks.length];
        zoom = geoTasks.length === 1 ? 13 : 10;
      }

      mapRef.current = window.L.map(mapContainerRef.current, {
        center,
        zoom,
        scrollWheelZoom: true,
      });

      // Add OpenStreetMap layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Add markers
    geoTasks.forEach((task) => {
      const lat = Number(task.latitude);
      const lng = Number(task.longitude);
      const empName = getEmployeeName(task.employeeId);
      
      const statusAr = task.status === 'completed' ? 'مكتملة' : 'جاري العمل';
      const statusColor = task.status === 'completed' ? '#10b981' : '#f59e0b';

      // Define custom popup HTML with styling, Arabic texts, thumbnail and Google Maps Link
      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; text-align: right; direction: rtl; min-width: 200px;">
          <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #1e293b;">${task.title}</h4>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">الموظف: <b>${empName}</b></p>
          
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background-color: ${statusColor}; border-radius: 50%;"></span>
            <span style="font-size: 11px; font-weight: bold; color: ${statusColor};">${statusAr}</span>
          </div>

          ${task.imageUrl ? `
            <div style="margin-bottom: 8px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <img src="${task.imageUrl}" style="width: 100%; height: 80px; object-cover: cover; display: block;" />
            </div>
          ` : ''}

          ${task.notes ? `
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #475569; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #f1f5f9;">
              ${task.notes}
            </p>
          ` : ''}

          <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer" 
             style="display: block; text-align: center; background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none; transition: background 0.2s;">
            فتح في خرائط Google ↗
          </a>
        </div>
      `;

      const marker = window.L.marker([lat, lng])
        .addTo(mapRef.current)
        .bindPopup(popupHtml);

      markersRef.current.push(marker);
    });

  }, [leafletLoaded, geoTasks.length]);

  return (
    <div className="relative w-full h-[500px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
      {!leafletLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-3 z-10">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">جاري تحميل خريطة الزيارات الميدانية...</span>
        </div>
      )}
      {leafletLoaded && geoTasks.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center z-10">
          <MapPin className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-semibold">لا تتوفر إحداثيات GPS مسجلة لأي مهمة حتى الآن</p>
          <p className="text-slate-400 text-xs mt-1">تأكد من إتمام الموظفين للمهام من هواتفهم وتفعيل الـ GPS</p>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}

// Icon wrapper for React
function MapPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}
