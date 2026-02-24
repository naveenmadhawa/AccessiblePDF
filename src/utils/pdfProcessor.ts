import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

// Set worker path using unpkg which is more reliable for specific npm versions
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function pdfToImages(file: File): Promise<PageImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const images: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR/Vision
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      // @ts-ignore - Some versions require canvas element explicitly
      canvas: canvas,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    images.push({
      dataUrl,
      width: canvas.width,
      height: canvas.height
    });
  }

  return images;
}
