import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { apiSummarizeDocument } from '../services/api';

export default function DocsPage() {
  const location = useLocation();
  const isInsideApp = location.pathname.startsWith('/app');
  const { showSuccess, showError } = useToast();

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTextContent, setFileTextContent] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeSummary, setActiveSummary] = useState(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files || e.target?.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isBinaryDoc = ['pdf', 'docx', 'doc'].includes(ext);

      // Read binary documents as Data URL (base64) and plain text documents as text
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileTextContent(event.target.result || '');
      };

      if (isBinaryDoc) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }

      if (showSuccess) showSuccess(`Selected ${file.name}`);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedFile) return;
    setIsSummarizing(true);

    try {
      const contentToSummarize = fileTextContent || `Content of file ${selectedFile.name}`;
      const ext = selectedFile.name.split('.').pop() || 'text';

      const res = await apiSummarizeDocument(contentToSummarize, selectedFile.name, ext);
      const summaryData = res?.data?.summary;

      if (summaryData) {
        const newSummary = {
          id: Date.now(),
          fileName: selectedFile.name,
          fileSize: (selectedFile.size / 1024).toFixed(0) + ' KB',
          date: new Date().toISOString().split('T')[0],
          executiveSummary: summaryData.executiveSummary,
          keyPoints: summaryData.keyPoints || [],
          actionableInsights: summaryData.actionableInsights || [],
          readingTime: summaryData.readingTime || '2 mins read',
          sentimentOrCategory: summaryData.sentimentOrCategory || 'General',
        };

        setActiveSummary(newSummary);
        if (showSuccess) showSuccess(`Summary generated for ${selectedFile.name}!`);
      }
    } catch (e) {
      if (showError) showError('Summarization error: ' + e.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileTextContent('');
    setActiveSummary(null);
  };

  return (
    <div className={`min-h-screen ${isInsideApp ? '' : 'bg-background dark:bg-slate-950 text-on-background dark:text-slate-100 flex flex-col'}`}>
      {!isInsideApp && (
        <header className="border-b border-outline-variant/30 dark:border-slate-800 py-4 px-8 flex justify-between items-center max-w-7xl mx-auto w-full">
          <Link to="/" className="font-headline text-2xl font-extrabold text-primary dark:text-blue-400">ASTRA AI</Link>
          <Link to="/app" className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl">Launch App</Link>
        </header>
      )}

      <main className={`max-w-4xl mx-auto w-full ${isInsideApp ? 'pt-2 pb-10' : 'px-8 py-12 flex-1'}`}>
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">summarize</span>
            AI Document Summarizer
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Upload PDFs, Markdown, or text files for instant AI extraction, executive summaries, and action items
          </p>
        </div>

        <div className="space-y-6">
          {/* Drag and Drop File Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-outline-variant/50 dark:border-slate-700 bg-surface dark:bg-slate-800'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100">
              {selectedFile ? selectedFile.name : 'Upload Document to Summarize'}
            </h3>
            <p className="font-body text-xs text-on-surface-variant dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Drag and drop PDF, DOCX, TXT, or Markdown files here, or browse from your device
            </p>

            <input
              type="file"
              id="doc-upload-input"
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileDrop}
              className="hidden"
            />

            <div className="mt-6 flex justify-center gap-3">
              <label
                htmlFor="doc-upload-input"
                className="px-5 py-2.5 bg-surface-container-high dark:bg-slate-700 text-on-surface dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-surface-container-highest cursor-pointer transition-colors"
              >
                Select File
              </label>
              {selectedFile && (
                <>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isSummarizing}
                    className="px-6 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSummarizing ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span>Analyzing &amp; Summarizing...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        <span>Generate AI Summary</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2.5 text-on-surface-variant dark:text-slate-400 text-xs font-semibold rounded-xl hover:bg-surface-container-high dark:hover:bg-slate-700 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Active Generated Summary Card */}
          {activeSummary && (
            <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-8 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl">picture_as_pdf</span>
                  <div>
                    <h4 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">
                      {activeSummary.fileName}
                    </h4>
                    <span className="text-xs text-on-surface-variant dark:text-slate-400">
                      {activeSummary.fileSize} • {activeSummary.readingTime} • Category: {activeSummary.sentimentOrCategory}
                    </span>
                  </div>
                </div>
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 text-xs font-bold px-3.5 py-1.5 rounded-full w-fit">
                  AI Synthesis Complete
                </span>
              </div>

              <div>
                <h5 className="font-headline text-xs font-bold text-on-surface dark:text-slate-200 uppercase tracking-wider mb-2">
                  Executive Summary
                </h5>
                <p className="font-body text-sm text-on-surface dark:text-slate-200 leading-relaxed bg-surface-container-low dark:bg-slate-700/50 p-5 rounded-2xl">
                  {activeSummary.executiveSummary}
                </p>
              </div>

              {activeSummary.keyPoints && activeSummary.keyPoints.length > 0 && (
                <div>
                  <h5 className="font-headline text-xs font-bold text-on-surface dark:text-slate-200 uppercase tracking-wider mb-2">
                    Key Takeaways
                  </h5>
                  <ul className="space-y-2">
                    {activeSummary.keyPoints.map((pt, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-on-surface dark:text-slate-200"
                      >
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeSummary.actionableInsights && activeSummary.actionableInsights.length > 0 && (
                <div>
                  <h5 className="font-headline text-xs font-bold text-on-surface dark:text-slate-200 uppercase tracking-wider mb-2">
                    Actionable Insights
                  </h5>
                  <ul className="space-y-2">
                    {activeSummary.actionableInsights.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-on-surface dark:text-slate-200"
                      >
                        <span className="material-symbols-outlined text-amber-500 text-base">lightbulb</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
