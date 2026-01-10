import { ImgBBUploadResponse } from '../types';

/**
 * Converts File or Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (data:image/png;base64,)
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validates image file type
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. (지원: JPG, PNG, GIF, WebP, BMP)`
    };
  }

  return { valid: true };
}

/**
 * Uploads image to imgBB
 * @param apiKey - imgBB API key
 * @param file - Image file to upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns Promise with imgBB response containing image URL
 */
export async function uploadToImgBB(
  apiKey: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<ImgBBUploadResponse> {
  if (!apiKey) {
    throw new Error('imgBB API Key가 설정되지 않았습니다. 설정 메뉴에서 API Key를 입력해주세요.');
  }

  // Validate file type (only if it's a File object with type property)
  if (file instanceof File) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  try {
    onProgress?.(10);

    // Convert file to base64
    const base64Image = await fileToBase64(file);

    onProgress?.(30);

    // Prepare form data
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Image);

    onProgress?.(50);

    // Upload to imgBB
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });

    onProgress?.(80);

    const data: ImgBBUploadResponse = await response.json();

    onProgress?.(100);

    if (!response.ok || !data.success) {
      throw new Error(data.status === 400
        ? 'imgBB API Key가 올바르지 않습니다.'
        : `이미지 업로드 실패: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('imgBB Upload Error:', error);
    throw new Error(error.message || '이미지 업로드 중 오류가 발생했습니다.');
  }
}

/**
 * Extracts image from clipboard paste event
 */
export function getImageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      return items[i].getAsFile();
    }
  }

  return null;
}
