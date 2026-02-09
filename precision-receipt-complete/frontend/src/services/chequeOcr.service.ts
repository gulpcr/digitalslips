/**
 * Cheque OCR Service
 * Handles cheque image scanning via OpenAI Vision API
 */

import api from './api';

export interface ChequeData {
  cheque_number: string | null;
  cheque_date: string | null;
  bank_name: string | null;
  branch_name: string | null;
  amount_in_words: string | null;
  amount_in_figures: number | null;
  payee_name: string | null;
  account_holder_name: string | null;  // Cheque owner/drawer name (printed on cheque)
  account_number: string | null;
  micr_code: string | null;
  signature_status: string | null;  // 'present', 'missing', 'unclear'
  signature_verified: boolean;
  confidence_score: number;
  language_detected: string | null;
  cheque_image_base64: string | null;  // Original image for teller view
}

export interface ChequeOCRResponse {
  success: boolean;
  message: string;
  data: ChequeData | null;
}

export const chequeOcrService = {
  /**
   * Scan cheque from uploaded file
   */
  async scanFromFile(file: File): Promise<ChequeOCRResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ChequeOCRResponse>(
      '/cheque-ocr/scan',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for OCR processing
      }
    );

    return response.data;
  },

  /**
   * Scan cheque from base64 image (camera capture)
   */
  async scanFromBase64(imageData: string, filename?: string): Promise<ChequeOCRResponse> {
    const response = await api.post<ChequeOCRResponse>(
      '/cheque-ocr/scan-base64',
      {
        image_data: imageData,
        filename: filename || 'camera-capture.jpg',
      },
      {
        timeout: 60000, // 60 seconds for OCR processing
      }
    );

    return response.data;
  },
};

export default chequeOcrService;
