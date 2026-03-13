/**
 * QR Scanner utility — Camera stream → canvas → jsQR decode loop
 * Extracts DRID pattern (DRID-YYYYMMDD-XXXXXX) from QR codes
 */

const DRID_PATTERN = /DRID-\d{8}-[A-Z0-9]{6}/i;

export class QRScanner {
  constructor(videoElement, canvasElement, onResult) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    this.onResult = onResult;
    this.stream = null;
    this.intervalId = null;
    this.scanning = false;
  }

  async start() {
    if (this.scanning) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      this.video.srcObject = this.stream;
      await this.video.play();
      this.scanning = true;

      // Decode loop at ~5fps
      this.intervalId = setInterval(() => this.decode(), 200);
    } catch (err) {
      throw new Error(`Camera access denied: ${err.message}`);
    }
  }

  stop() {
    this.scanning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.video.srcObject = null;
  }

  decode() {
    if (!this.scanning || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return;

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Requires jsQR to be loaded
    if (typeof jsQR === 'undefined') return;

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      const drid = this.extractDRID(code.data);
      if (drid) {
        this.stop();
        this.onResult(drid, code.data);
      }
    }
  }

  extractDRID(data) {
    // Try JSON first (QR may contain { drid: "DRID-..." })
    try {
      const parsed = JSON.parse(data);
      const drid = parsed.drid || parsed.DRID || parsed.id;
      if (drid && DRID_PATTERN.test(drid)) {
        return drid.toUpperCase();
      }
    } catch {
      // Not JSON
    }

    // Try direct pattern match
    const match = data.match(DRID_PATTERN);
    if (match) return match[0].toUpperCase();

    // Try URL parameter
    try {
      const url = new URL(data);
      const dridParam = url.searchParams.get('drid') || url.searchParams.get('DRID');
      if (dridParam && DRID_PATTERN.test(dridParam)) {
        return dridParam.toUpperCase();
      }
    } catch {
      // Not a URL
    }

    return null;
  }
}
