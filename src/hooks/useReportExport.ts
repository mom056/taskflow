import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task } from '../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Capacitor } from '@capacitor/core';

interface ExportReportProps {
  tasks: Task[];
  getEmployeeName: (id: string) => string;
}

export function useReportExport({ tasks, getEmployeeName }: ExportReportProps) {
  
  // A helper to check if a string contains Arabic characters
  const hasArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  // Helper to shape Arabic text for basic jsPDF rendering (reversing letters for RTL fallback)
  const formatArabicText = (text: string) => {
    if (!text) return '';
    if (!hasArabic(text)) return text;
    // Reverse characters for basic PDF viewers that do not support RTL shaping
    return text.split('').reverse().join('');
  };

  // 1. Export PDF using jsPDF and jspdf-autotable
  const exportPDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Try to load Cairo font from jsdelivr for high-quality Arabic support
    try {
      const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Regular.ttf';
      const response = await fetch(fontUrl);
      if (!response.ok) throw new Error('Font load failed');
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert ArrayBuffer to Base64
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Font = window.btoa(binary);

      // Register font in jsPDF
      doc.addFileToVFS('Cairo-Regular.ttf', base64Font);
      doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
      doc.setFont('Cairo');
    } catch (err) {
      console.warn('[PDF Export] Failed to load Cairo font, falling back to Helvetica:', err);
      doc.setFont('Helvetica');
    }

    const title = 'تقرير المهام الميدانية - TaskFlow';
    const dateStr = `تاريخ التصدير: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`;

    // Header
    doc.setFontSize(18);
    doc.text(formatArabicText(title), 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(formatArabicText(dateStr), 105, 22, { align: 'center' });

    // Table Columns
    const headers = ['الحالة', 'تاريخ التنفيذ', 'الموقع الجغرافي', 'الموقع المكتبي', 'الموظف المسند', 'عنوان المهمة'];
    const formattedHeaders = headers.map(h => formatArabicText(h));

    // Table Data
    const tableData = tasks.map((task) => {
      const empName = getEmployeeName(task.employeeId);
      const dueDateStr = task.dueDate ? format(task.dueDate, 'yyyy/MM/dd') : 'بدون تاريخ';
      const statusAr = task.status === 'completed' ? 'مكتملة' : task.status === 'in_progress' ? 'جاري العمل' : task.status === 'pending' ? 'معلقة' : 'جديدة';
      
      let gpsStr = 'غير متوفر';
      if (task.latitude && task.longitude) {
        gpsStr = `${Number(task.latitude).toFixed(4)}, ${Number(task.longitude).toFixed(4)}`;
      }

      return [
        formatArabicText(statusAr),
        formatArabicText(dueDateStr),
        formatArabicText(gpsStr),
        formatArabicText(task.location || 'ميداني'),
        formatArabicText(empName),
        formatArabicText(task.title),
      ];
    });

    // Generate table
    autoTable(doc, {
      startY: 30,
      head: [formattedHeaders],
      body: tableData,
      theme: 'striped',
      styles: {
        font: doc.getFont().fontName === 'Cairo' ? 'Cairo' : 'Helvetica',
        halign: 'right',
        fontSize: doc.getFont().fontName === 'Cairo' ? 9 : 8,
      },
      headStyles: {
        fillColor: [37, 99, 235], // Blue-600
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
        5: { cellWidth: 50 },
      },
    });

    // Save File
    const filename = `TaskFlow_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        // Output as base64 string
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // Write file to Cache directory so it can be shared
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: pdfBase64,
          directory: Directory.Cache
        });

        // Share native file
        await Share.share({
          title: 'تقرير المهام الميدانية',
          text: 'تقرير المهام والزيارات الميدانية من تطبيق TaskFlow',
          url: writeResult.uri,
          dialogTitle: 'تصدير التقرير'
        });
      } catch (err: any) {
        console.error('[PDF Export Native] Error:', err);
      }
    } else {
      doc.save(filename);
    }
  };

  // 2. High-Fidelity Native Print View (HTML formatting with charts & Arabic shaping)
  const printReportHTML = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share');
        // Shape summary text for mobile sharing sheet
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const progressCount = tasks.filter(t => t.status === 'in_progress').length;
        
        const summaryText = `تقرير المهام والزيارات الميدانية - TaskFlow\n\n` + 
          `إجمالي المهام: ${tasks.length}\n` + 
          `المكتملة: ${completedCount}\n` +
          `جاري العمل: ${progressCount}\n\n` +
          tasks.map(t => `- ${t.title} (${t.status === 'completed' ? 'مكتملة' : 'جاري العمل'})`).join('\n');

        await Share.share({
          title: 'ملخص التقرير الميداني',
          text: summaryText,
          dialogTitle: 'مشاركة ملخص التقرير'
        });
      } catch (err) {
        console.error('[Print Native] Error:', err);
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const taskRows = tasks.map(t => {
      const empName = getEmployeeName(t.employeeId);
      const dueDateStr = t.dueDate ? format(t.dueDate, 'yyyy/MM/dd') : '-';
      const statusAr = t.status === 'completed' ? 'مكتملة' : t.status === 'in_progress' ? 'جاري العمل' : t.status === 'pending' ? 'معلقة' : 'جديدة';
      const statusBadge = t.status === 'completed' ? 'badge-completed' : t.status === 'in_progress' ? 'badge-progress' : t.status === 'pending' ? 'badge-pending' : 'badge-new';
      
      let gpsStr = '-';
      if (t.latitude && t.longitude) {
        gpsStr = `📌 ${Number(t.latitude).toFixed(5)}, ${Number(t.longitude).toFixed(5)}`;
      }

      return `
        <tr>
          <td><strong>${t.title}</strong></td>
          <td>${empName}</td>
          <td>${t.location || 'ميداني'}</td>
          <td>${gpsStr}</td>
          <td>${dueDateStr}</td>
          <td><span class="badge ${statusBadge}">${statusAr}</span></td>
        </tr>
        ${t.notes ? `
          <tr class="notes-row">
            <td colspan="6">
              <strong>ملاحظات الموظف:</strong> ${t.notes}
              ${t.imageUrl ? `<span style="margin-right: 15px; color: #2563eb;">[تم إرفاق صورة ميدانية]</span>` : ''}
            </td>
          </tr>
        ` : ''}
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير المهام والزيارات الميدانية</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            margin: 40px;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 700;
            color: #2563eb;
          }
          .report-meta {
            text-align: left;
            font-size: 13px;
            color: #64748b;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .stat-card {
            border: 1px solid #f1f5f9;
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 12px;
            text-align: center;
          }
          .stat-card h4 {
            margin: 0;
            font-size: 12px;
            color: #64748b;
          }
          .stat-card p {
            margin: 5px 0 0 0;
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            padding: 12px 15px;
            text-align: right;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          th {
            background-color: #f8fafc;
            font-weight: 600;
            color: #475569;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
          }
          .badge-completed { background-color: #dcfce7; color: #15803d; }
          .badge-progress { background-color: #fef3c7; color: #b45309; }
          .badge-pending { background-color: #fca5a5; color: #b91c1c; }
          .badge-new { background-color: #dbeafe; color: #1d4ed8; }
          
          .notes-row td {
            background-color: #fdfdfd;
            font-size: 12px;
            color: #64748b;
            padding: 8px 25px;
            border-bottom: 2px solid #f1f5f9;
          }
          
          @media print {
            body { margin: 20px; }
            button { display: none; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">TaskFlow</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 5px;">نظام إدارة العمليات والزيارات الميدانية</div>
          </div>
          <div class="report-meta">
            <div>تاريخ التقرير: ${format(new Date(), 'dd MMMM yyyy', { locale: ar })}</div>
            <div>مصدر التقرير: لوحة تحكم المدير</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <h4>إجمالي المهام</h4>
            <p>${tasks.length}</p>
          </div>
          <div class="stat-card">
            <h4>المكتملة</h4>
            <p>${tasks.filter(t => t.status === 'completed').length}</p>
          </div>
          <div class="stat-card">
            <h4>جاري تنفيذها</h4>
            <p>${tasks.filter(t => t.status === 'in_progress').length}</p>
          </div>
          <div class="stat-card">
            <h4>الزيارات الميدانية</h4>
            <p>${tasks.filter(t => t.location).length}</p>
          </div>
        </div>

        <h3>تفاصيل المهام</h3>
        <table>
          <thead>
            <tr>
              <th>عنوان المهمة</th>
              <th>الموظف المسؤول</th>
              <th>المكان</th>
              <th>التحقق الجغرافي GPS</th>
              <th>تاريخ الاستحقاق</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>

        <div style="margin-top: 50px; text-align: center;" class="no-print">
          <button onclick="window.print()" style="padding: 10px 25px; font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: bold; background-color: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);">
            طباعة أو حفظ كـ PDF 🖨️
          </button>
        </div>

        <script>
          // Auto trigger window print for native saving
          window.onload = () => {
            // Optional: window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return {
    exportPDF,
    printReportHTML,
  };
}
