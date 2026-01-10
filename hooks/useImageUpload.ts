import { useState, useCallback } from 'react';
import { uploadToImgBB, getImageFromClipboard } from '../services/imgbbService';
import { ImageUploadState } from '../types';

interface UseImageUploadProps {
  apiKey: string;
  onImageUploaded: (imageUrl: string) => void;
}

export function useImageUpload({ apiKey, onImageUploaded }: UseImageUploadProps) {
  const [uploadState, setUploadState] = useState<ImageUploadState>({
    isUploading: false,
    progress: 0,
    error: null
  });

  const handleUpload = useCallback(async (file: File | Blob) => {
    if (!apiKey) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: 'imgBB API Key가 설정되지 않았습니다. 설정에서 API Key를 입력해주세요.'
      });
      return;
    }

    setUploadState({ isUploading: true, progress: 0, error: null });

    try {
      const response = await uploadToImgBB(apiKey, file, (progress) => {
        setUploadState(prev => ({ ...prev, progress }));
      });

      onImageUploaded(response.data.display_url);

      setUploadState({ isUploading: false, progress: 100, error: null });

      // Reset state after 2 seconds
      setTimeout(() => {
        setUploadState({ isUploading: false, progress: 0, error: null });
      }, 2000);
    } catch (error: any) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: error.message || '이미지 업로드 실패'
      });
    }
  }, [apiKey, onImageUploaded]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input value to allow uploading the same file again
    event.target.value = '';
  }, [handleUpload]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const file = getImageFromClipboard(event);
    if (file) {
      event.preventDefault();
      handleUpload(file);
    }
  }, [handleUpload]);

  const clearError = useCallback(() => {
    setUploadState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    uploadState,
    handleFileSelect,
    handleDrop,
    handlePaste,
    clearError
  };
}
