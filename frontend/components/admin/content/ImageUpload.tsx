'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  images: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
}

export function ImageUpload({ images, onChange, maxCount = 10 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    const remaining = maxCount - images.length;
    const toUpload = fileArray.slice(0, remaining);

    if (toUpload.length === 0) {
      alert(`Максимум ${maxCount} изображений`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const newUrls: string[] = [];
    let uploaded = 0;

    for (const file of toUpload) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Ошибка загрузки');
        }

        const data = await response.json();
        if (data.url) {
          newUrls.push(data.url);
        }
      } catch (err) {
        console.error('Ошибка загрузки файла:', err);
        alert(`Ошибка загрузки: ${err}`);
      }

      uploaded++;
      setUploadProgress(Math.round((uploaded / toUpload.length) * 100));
    }

    onChange([...images, ...newUrls]);
    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group border border-gray-200">
              <Image
                src={url}
                alt={`Фото ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length < maxCount && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer
            hover:border-gray-400 hover:bg-gray-50 transition
            ${uploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="hidden"
          />
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Загрузка... {uploadProgress}%</p>
              <div className="w-full max-w-xs mx-auto h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">
                Нажмите чтобы загрузить фото
              </p>
              <p className="text-xs text-gray-400">
                {images.length} из {maxCount} загружено
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}