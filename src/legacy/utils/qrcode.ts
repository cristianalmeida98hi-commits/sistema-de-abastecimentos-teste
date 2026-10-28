import QRCode from 'qrcode';

/**
 * Generates a high-definition PNG Data URL (base64) for a given text or URL.
 * Uses Error Correction Level 'M' (15% error recovery) with pure black on white contrast
 * and quiet zone margins for instant scanning in field conditions and high-DPI printing.
 */
export async function generateQRCodeDataUrl(text: string, width = 400): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code Data URL:', err);
    return '';
  }
}

