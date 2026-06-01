import { useState } from 'react';
import { supabase } from '../lib/supabase';
import imageCompression from 'browser-image-compression';

interface UploadResult {
  url: string | null;
  error: string | null;
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const uploadImage = async (file: File, taskId: string): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setStatusText('جاري التحقق من الصورة...');

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return { url: null, error: 'الملف المحدد ليس صورة' };
      }

      let fileToUpload = file;
      setStatusText('جاري ضغط وتحسين جودة الصورة...');
      setProgress(15);

      try {
        const options = {
          maxSizeMB: 0.5,             // Compress to < 500KB
          maxWidthOrHeight: 1200,    // Max resolution 1200px
          useWebWorker: true,
          fileType: 'image/jpeg',    // Output as JPEG
        };
        const compressedFile = await imageCompression(file, options);
        
        // Wrap compressed file in a new File object with a clean name/type
        const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
        fileToUpload = new File([compressedFile], `${originalName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });

        const reduction = ((file.size - fileToUpload.size) / file.size * 100).toFixed(0);
        console.log(`[ImageUpload] Compressed from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(fileToUpload.size / 1024).toFixed(0)}KB (Reduced by ${reduction}%)`);
        setStatusText(`تم ضغط الصورة بنجاح (وفرت ${reduction}%)`);
      } catch (compErr) {
        console.warn('Image compression failed, uploading original:', compErr);
        // Fallback to original if compression fails, but enforce 5MB limit
        if (file.size > 5 * 1024 * 1024) {
          return { url: null, error: 'حجم الصورة كبير جداً، يرجى اختيار صورة أصغر' };
        }
      }

      setProgress(40);
      setStatusText('جاري رفع الصورة إلى خوادم السحابة...');

      // Build a unique path
      const ext = 'jpg';
      const filePath = `task-images/${taskId}/${Date.now()}.${ext}`;

      setProgress(60);

      const { error: uploadError } = await supabase.storage
        .from('task-images')
        .upload(filePath, fileToUpload, { 
          upsert: true, 
          contentType: 'image/jpeg' 
        });

      if (uploadError) {
        return { url: null, error: uploadError.message };
      }

      setProgress(90);
      setStatusText('جاري إنهاء الرفع واستخراج الرابط...');

      const { data } = supabase.storage
        .from('task-images')
        .getPublicUrl(filePath);

      setProgress(100);
      setStatusText('تم الرفع بنجاح ✓');
      return { url: data.publicUrl, error: null };

    } catch (err: any) {
      return { url: null, error: err.message || 'حدث خطأ أثناء الرفع' };
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setProgress(0);
        setStatusText('');
      }, 2000);
    }
  };

  return { uploadImage, isUploading, progress, statusText };
}
