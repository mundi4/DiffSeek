import { useCallback } from 'react';
import { handlePasteWithImageConversion } from '@/utils/imageConverter';

/**
 * 이미지 경로 변환이 포함된 붙여넣기 기능을 제공하는 React Hook
 */
export function usePasteWithImageConversion() {
  const handlePaste = useCallback(async (
    event: ClipboardEvent,
    onPaste?: (content: string) => void
  ) => {
    // 기본 붙여넣기 동작 방지
    event.preventDefault();
    
    try {
      // 클립보드 데이터를 처리하여 이미지 경로를 data URL로 변환
      const convertedContent = await handlePasteWithImageConversion(event);
      
      if (convertedContent && onPaste) {
        onPaste(convertedContent);
      }
    } catch (error) {
      console.error('Error handling paste:', error);
      
      // 실패 시 기본 텍스트로 폴백
      const fallbackText = event.clipboardData?.getData('text/plain') || '';
      if (fallbackText && onPaste) {
        onPaste(fallbackText);
      }
    }
  }, []);

  return { handlePaste };
}
