import { useState, useEffect, useRef } from 'react';
import { Dropzone } from './components/Dropzone';
import { pdfToImages } from './utils/pdfProcessor';
import { convertPdfPageToHtml } from './services/gemini';
import parse from 'html-react-parser';
import { 
  FileText, 
  Code, 
  Eye, 
  Download, 
  CheckCircle2, 
  Loader2, 
  Accessibility,
  ChevronRight,
  ExternalLink,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setGeneratedHtml('');
    setError(null);
  };

  const handleClear = () => {
    setFile(null);
    setGeneratedHtml('');
    setProgress(0);
    setError(null);
  };

  const startConversion = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setProgress(5);
    setError(null);

    try {
      // 1. Convert PDF to Images
      const images = await pdfToImages(file);
      setProgress(20);

      let fullHtml = '';
      const totalPages = images.length;

      // Helper to crop image
      const cropImage = async (pageImage: { dataUrl: string, width: number, height: number }, box: [number, number, number, number]): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve('');
            
            const [ymin, xmin, ymax, xmax] = box;
            
            const sx = (xmin / 1000) * pageImage.width;
            const sy = (ymin / 1000) * pageImage.height;
            const sw = ((xmax - xmin) / 1000) * pageImage.width;
            const sh = ((ymax - ymin) / 1000) * pageImage.height;
            
            canvas.width = sw;
            canvas.height = sh;
            
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          };
          img.src = pageImage.dataUrl;
        });
      };

      // 2. Process each page with Gemini
      for (let i = 0; i < totalPages; i++) {
        const pageImage = images[i];
        // Remove the data URL prefix for Gemini
        const base64Data = pageImage.dataUrl.split(',')[1];
        const result = await convertPdfPageToHtml(base64Data, i + 1);
        
        let pageHtml = result.html;
        
        // 3. Crop and replace images
        if (result.images && result.images.length > 0) {
          for (const imgData of result.images) {
            if (imgData.box && imgData.box.length === 4) {
              const croppedDataUrl = await cropImage(pageImage, imgData.box);
              // Replace the src attribute in the HTML
              // We use a regex to find src="img_id" or src='img_id'
              const regex = new RegExp(`src=["']${imgData.id}["']`, 'g');
              pageHtml = pageHtml.replace(regex, `src="${croppedDataUrl}"`);
            }
          }
        }

        fullHtml += `\n<!-- Page ${i + 1} -->\n<section aria-label="Page ${i + 1}">\n${pageHtml}\n</section>\n`;
        setProgress(20 + Math.floor(((i + 1) / totalPages) * 80));
      }

      setGeneratedHtml(fullHtml);
    } catch (err) {
      console.error(err);
      setError('Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accessible Document - ${file?.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 2rem; max-width: 800px; margin: 0 auto; }
          section { margin-bottom: 4rem; border-bottom: 1px solid #eee; padding-bottom: 2rem; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <main>
          ${generatedHtml}
        </main>
      </body>
      </html>
    `], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name?.replace('.pdf', '')}_accessible.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!generatedHtml) return;
    
    setIsProcessing(true);
    try {
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Accessible Document - ${file?.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 2rem; max-width: 800px; margin: 0 auto; }
            section { margin-bottom: 4rem; border-bottom: 1px solid #eee; padding-bottom: 2rem; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <main>
            ${generatedHtml}
          </main>
        </body>
        </html>
      `;

      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: fullHtml,
          filename: `${file?.name?.replace('.pdf', '')}_accessible.pdf`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name?.replace('.pdf', '')}_accessible.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Accessibility className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">AccessiblePDF</h1>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://www.section508.gov/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
            >
              ADA Guidelines <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-8">
            <section>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Make your PDFs accessible.</h2>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Transform standard PDFs into semantic, ADA-compliant HTML documents using AI-powered visual analysis.
              </p>
            </section>

            <div className="space-y-4">
              <Dropzone 
                onFileSelect={handleFileSelect} 
                selectedFile={file} 
                onClear={handleClear}
                isProcessing={isProcessing}
              />

              {file && !generatedHtml && (
                <button
                  onClick={startConversion}
                  disabled={isProcessing}
                  className="w-full py-4 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing Pages... {progress}%
                    </>
                  ) : (
                    <>
                      Convert to Accessible HTML
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Features Info */}
            <div className="grid grid-cols-2 gap-4 pt-8">
              {[
                { title: 'Semantic Tags', desc: 'Proper use of <main>, <nav>, etc.' },
                { title: 'Heading Hierarchy', desc: 'Logical structure from H1 to H6.' },
                { title: 'AI Alt Text', desc: 'Detailed descriptions for all visual elements.' },
                { title: 'Table Headers', desc: 'Accessible data representation.' },
              ].map((feature, i) => (
                <div key={i} className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">{feature.title}</h3>
                  <p className="text-sm text-zinc-600 leading-snug">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Accessibility className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Accessibility Note</span>
              </div>
              <p className="text-xs text-blue-600 leading-relaxed">
                Images are automatically cropped from the original PDF and embedded in the HTML. AI generates detailed text descriptions (alt-text) for each visual element to ensure compatibility with screen readers.
              </p>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {generatedHtml ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[700px]"
                >
                  {/* Tabs */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex bg-zinc-200/50 p-1 rounded-lg">
                      <button
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                          activeTab === 'preview' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => setActiveTab('code')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                          activeTab === 'code' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                      >
                        <Code className="w-4 h-4" />
                        Code
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadHtml}
                        className="px-4 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2"
                      >
                        <Code className="w-4 h-4" />
                        HTML
                      </button>
                      <button
                        onClick={downloadPdf}
                        className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-auto p-8 bg-white">
                    {activeTab === 'preview' ? (
                      <div ref={previewRef} className="prose prose-zinc max-w-none prose-headings:font-bold prose-a:text-zinc-900 prose-img:rounded-xl">
                        {parse(generatedHtml)}
                      </div>
                    ) : (
                      <pre className="font-mono text-xs text-zinc-600 bg-zinc-50 p-6 rounded-xl border border-zinc-100 whitespace-pre-wrap">
                        {generatedHtml}
                      </pre>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-[700px] border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-zinc-50/30">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 mb-2">No document generated</h3>
                  <p className="text-zinc-500 max-w-sm">
                    Upload a PDF and click convert to see the accessible HTML output here.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Accessibility className="w-4 h-4" />
            <span className="text-sm font-medium">AccessiblePDF Transformer</span>
          </div>
          <p className="text-xs text-zinc-400">
            Powered by Gemini AI Multimodal Vision. Ensuring digital equity for all.
          </p>
        </div>
      </footer>
    </div>
  );
}
