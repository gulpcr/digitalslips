/**
 * Cheque Scanner Modal Component
 * Provides camera capture and file upload for cheque OCR
 * Reusable component - can be used anywhere cheque scanning is needed
 */

import React, { useState, useRef, useCallback } from 'react';
import { FiCamera, FiUpload, FiX, FiRefreshCw, FiCheck, FiAlertCircle, FiCheckCircle, FiXCircle, FiHelpCircle } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import { chequeOcrService, ChequeData } from '../services/chequeOcr.service';

interface ChequeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: ChequeData) => void;
}

type ScanMode = 'select' | 'camera' | 'preview' | 'result';

const ChequeScannerModal: React.FC<ChequeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
}) => {
  const [mode, setMode] = useState<ScanMode>('select');
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ChequeData | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera
  const startCamera = async () => {
    setError(null);
    setMode('camera');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions or use file upload.');
      setMode('select');
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setPreviewImage(imageData);
      stopCamera();
      setMode('preview');
    }
  };

  // Handle file upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large. Maximum size is 10MB');
      return;
    }

    setCapturedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  // Process the image with OCR
  const processImage = async () => {
    if (!previewImage && !capturedFile) return;

    setLoading(true);
    setError(null);

    try {
      let response;

      if (capturedFile) {
        response = await chequeOcrService.scanFromFile(capturedFile);
      } else if (previewImage) {
        response = await chequeOcrService.scanFromBase64(previewImage);
      } else {
        throw new Error('No image to process');
      }

      if (response.success && response.data) {
        setExtractedData(response.data);
        setMode('result');
        toast.success('Cheque scanned successfully!');
      } else {
        setError(response.message || 'Failed to extract cheque data');
        toast.error(response.message || 'Failed to scan cheque');
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to process cheque';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm and use extracted data
  const confirmExtractedData = () => {
    if (extractedData) {
      onScanComplete(extractedData);
      handleClose();
    }
  };

  // Reset to selection mode
  const resetScanner = () => {
    stopCamera();
    setPreviewImage(null);
    setCapturedFile(null);
    setError(null);
    setExtractedData(null);
    setMode('select');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Close modal
  const handleClose = () => {
    stopCamera();
    resetScanner();
    onClose();
  };

  // Render signature status badge
  const renderSignatureStatus = (status: string | null) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <FiCheckCircle className="w-3 h-3" /> Signature Present
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <FiXCircle className="w-3 h-3" /> Signature Missing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <FiHelpCircle className="w-3 h-3" /> Unclear
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card padding="lg" shadow="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-primary">
              {mode === 'result' ? 'Extracted Cheque Data' : 'Scan Cheque'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Selection Mode */}
          {mode === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary text-center mb-4">
                Choose how to scan your cheque. Supports handwritten cheques in English and Urdu.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary-50 transition-all"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiCamera className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-medium text-text-primary">Use Camera</span>
                  <span className="text-xs text-text-secondary text-center">
                    Take a photo of the cheque
                  </span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary-50 transition-all"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiUpload className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-medium text-text-primary">Upload Image</span>
                  <span className="text-xs text-text-secondary text-center">
                    Select from device
                  </span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <p className="text-xs text-text-secondary text-center mt-4">
                Supported formats: JPEG, PNG, WebP (max 10MB)
              </p>
            </div>
          )}

          {/* Camera Mode */}
          {mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg opacity-50 pointer-events-none" />
              </div>

              <p className="text-sm text-text-secondary text-center">
                Position the cheque within the frame and ensure good lighting
              </p>

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={resetScanner}>
                  Cancel
                </Button>
                <Button variant="primary" fullWidth onClick={capturePhoto} leftIcon={<FiCamera />}>
                  Capture
                </Button>
              </div>
            </div>
          )}

          {/* Preview Mode */}
          {mode === 'preview' && previewImage && (
            <div className="space-y-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={previewImage}
                  alt="Cheque preview"
                  className="w-full h-64 object-contain"
                />
              </div>

              <p className="text-sm text-text-secondary text-center">
                {loading
                  ? 'Processing cheque with AI... This may take a moment.'
                  : 'Review the image and click "Scan Cheque" to extract details'}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={resetScanner}
                  disabled={loading}
                  leftIcon={<FiRefreshCw />}
                >
                  Retake
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={processImage}
                  loading={loading}
                  leftIcon={<FiCheck />}
                >
                  Scan Cheque
                </Button>
              </div>
            </div>
          )}

          {/* Result Mode - Show extracted data */}
          {mode === 'result' && extractedData && (
            <div className="space-y-4">
              {/* Cheque Image Preview */}
              {extractedData.cheque_image_base64 && (
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={extractedData.cheque_image_base64}
                    alt="Scanned cheque"
                    className="w-full h-48 object-contain"
                  />
                </div>
              )}

              {/* Confidence Score */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-text-primary">Extraction Confidence</span>
                <span className={`text-sm font-bold ${
                  extractedData.confidence_score >= 0.8 ? 'text-green-600' :
                  extractedData.confidence_score >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {Math.round(extractedData.confidence_score * 100)}%
                </span>
              </div>

              {/* Extracted Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Bank Name</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.bank_name || <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Cheque Date</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.cheque_date || <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Payee Name</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.payee_name || <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Amount (Figures)</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.amount_in_figures
                      ? `PKR ${extractedData.amount_in_figures.toLocaleString()}`
                      : <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg md:col-span-2">
                  <p className="text-xs text-purple-600 font-medium mb-1">Amount (Words)</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.amount_in_words || <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium mb-1">Cheque Number</p>
                  <p className="text-sm text-text-primary font-semibold">
                    {extractedData.cheque_number || <span className="text-text-secondary italic">Not detected</span>}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium mb-1">Signature Status</p>
                  <div className="mt-1">
                    {renderSignatureStatus(extractedData.signature_status)}
                  </div>
                </div>
              </div>

              {/* Language detected */}
              {extractedData.language_detected && (
                <p className="text-xs text-text-secondary text-center">
                  Language detected: {extractedData.language_detected.charAt(0).toUpperCase() + extractedData.language_detected.slice(1)}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={resetScanner}
                  leftIcon={<FiRefreshCw />}
                >
                  Scan Again
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={confirmExtractedData}
                  leftIcon={<FiCheck />}
                >
                  Use This Data
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ChequeScannerModal;
