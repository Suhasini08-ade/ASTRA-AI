import React from 'react';
import DocumentUploader from '../components/DocumentUploader';

export default function Documents() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Document Assistant</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Upload PDF documents, extract text, and ask interactive AI queries</p>
      </div>

      <DocumentUploader />
    </div>
  );
}
