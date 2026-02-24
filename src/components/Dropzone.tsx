import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  isProcessing: boolean;
}

export function Dropzone({ onFileSelect, selectedFile, onClear, isProcessing }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled: isProcessing,
  } as any);

  if (selectedFile) {
    return (
      <div className="relative flex items-center justify-between p-4 border border-zinc-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 rounded-lg">
            <FileText className="w-6 h-6 text-zinc-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 truncate max-w-[200px]">
              {selectedFile.name}
            </p>
            <p className="text-xs text-zinc-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        {!isProcessing && (
          <button
            onClick={onClear}
            className="p-1 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-2xl p-12 transition-all duration-200 ease-in-out flex flex-col items-center justify-center gap-4",
        isDragActive 
          ? "border-zinc-900 bg-zinc-50" 
          : "border-zinc-200 hover:border-zinc-400 bg-zinc-50/50"
      )}
    >
      <input {...getInputProps()} />
      <div className="p-4 bg-white rounded-2xl shadow-sm border border-zinc-100 group-hover:scale-110 transition-transform duration-200">
        <Upload className="w-8 h-8 text-zinc-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-900">
          {isDragActive ? "Drop your PDF here" : "Click or drag PDF to upload"}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Only PDF files are supported
        </p>
      </div>
    </div>
  );
}
