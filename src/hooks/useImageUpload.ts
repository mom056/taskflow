import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface UploadResult {
  url: string | null;
  error: string | null;
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = async (file: File, taskId: string): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(10);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return { url: null, error: 'الملف المحدد ليس صورة' };
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return { url: null, error: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' };
      }

      setProgress(30);

      // Build a unique path
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `task-images/${taskId}/${Date.now()}.${ext}`;

      setProgress(50);

      const { error: uploadError } = await supabase.storage
        .from('task-images')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        return { url: null, error: uploadError.message };
      }

      setProgress(90);

      const { data } = supabase.storage
        .from('task-images')
        .getPublicUrl(filePath);

      setProgress(100);
      return { url: data.publicUrl, error: null };

    } catch (err: any) {
      return { url: null, error: err.message || 'حدث خطأ أثناء الرفع' };
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  return { uploadImage, isUploading, progress };
}
