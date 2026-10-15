import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline || !match && !codeContent.includes('\n')) {
    return (
      <code
        className="px-1.5 py-0.5 rounded font-mono text-[13px] bg-slate-200/80 dark:bg-slate-700/80 text-purple-600 dark:text-purple-300 font-medium"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-lg text-slate-100 font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 border-b border-slate-700/50 text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-purple-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed text-slate-200 selection:bg-purple-900/60">
        <code>{codeContent}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="markdown-content text-inherit leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-3 mb-1.5 text-slate-800 dark:text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2.5 mb-1 text-slate-800 dark:text-slate-200">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2 pl-1 text-slate-700 dark:text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 pl-1 text-slate-700 dark:text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500/70 pl-3 py-1 my-2 italic text-slate-600 dark:text-slate-400 bg-purple-50/30 dark:bg-purple-950/20 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
              <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700 text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-800/80">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 underline underline-offset-2 hover:text-purple-500 font-medium"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="my-3 border-slate-300 dark:border-slate-800" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
