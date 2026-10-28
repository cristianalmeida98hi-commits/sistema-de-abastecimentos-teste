/**
 * Opens a print document in a new tab/window without blocking or freezing the main application event loop.
 * Uses Blob URL with 'noopener,noreferrer' to completely isolate the new window process from the main app thread.
 */
export function openPrintWindow(htmlContent: string): void {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Try opening new window first
    const printWin = window.open(blobUrl, '_blank');

    if (printWin) {
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 180000);
      return;
    }

    // Resilient Fallback for Mobile and iframe sandboxes where window.open returns null
    const existingIframe = document.getElementById('andrade-print-frame');
    if (existingIframe) {
      existingIframe.remove();
    }

    const printFrame = document.createElement('iframe');
    printFrame.id = 'andrade-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '100%';
    printFrame.style.height = '100%';
    printFrame.style.border = 'none';
    printFrame.style.zIndex = '-9999';
    printFrame.src = blobUrl;

    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.warn('Iframe print warning:', e);
      }
      setTimeout(() => {
        printFrame.remove();
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    };

    document.body.appendChild(printFrame);
  } catch (err) {
    console.error('Erro ao abrir janela de impressão:', err);
    alert('Erro ao abrir janela de impressão. Tente novamente.');
  }
}
