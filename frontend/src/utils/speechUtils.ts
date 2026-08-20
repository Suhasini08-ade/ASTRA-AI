/**
 * Formats ISO dates and timestamps into natural conversational English.
 * e.g. "2026-08-15T08:00:00" -> "tomorrow at 8 AM"
 */
function formatNaturalDates(text: string): string {
  let res = text;

  // Replace full ISO timestamp: 2026-08-15T08:00:00 / 2026-08-15T08:00:00Z
  res = res.replace(/\b(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?\b/g, (_m, y, m, d, hh, mm) => {
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10));
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    let dayStr = "";
    if (diffDays === 0) dayStr = "today";
    else if (diffDays === 1) dayStr = "tomorrow";
    else if (diffDays === -1) dayStr = "yesterday";
    else dayStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let hours = parseInt(hh, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = mm === '00' ? `${hours} ${ampm}` : `${hours}:${mm} ${ampm}`;

    return `${dayStr} at ${timeStr}`;
  });

  // Replace YYYY-MM-DD
  res = res.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_m, y, m, d) => {
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "tomorrow";
    if (diffDays === -1) return "yesterday";
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return res;
}

/**
 * Extracts 1-2 short sentences from the response text for fast, natural TTS.
 */
function limitToShortSentences(text: string, maxSentences: number = 2): string {
  if (!text) return "";
  
  // Split into sentences ending with . ! or ?
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    const selection = sentences.slice(0, maxSentences).join(' ').trim();
    if (selection) return selection;
  }
  
  return text.length > 140 ? text.substring(0, 140) + '.' : text;
}

/**
 * Sanitizes AI response text for clean, human-readable UI display in the Voice Assistant panel.
 * Converts markdown tables into readable bullet text and strips raw Markdown syntax, code blocks,
 * headers, dividers, and tool metadata.
 */
export function cleanTextForDisplay(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // 1. Process markdown tables (| Col 1 | Col 2 |) into bullet items
  const lines = cleaned.split('\n');
  const processedLines: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);

      // Check if it's separator row like |---|---|
      if (cells.every(c => /^[-:]+$/.test(c))) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        // Table header line
        tableHeaders = cells.map(h => h.replace(/[*#_]/g, ''));
      } else {
        // Data row
        const rowPairs: string[] = [];
        cells.forEach((cell, idx) => {
          const header = tableHeaders[idx] || `Field ${idx + 1}`;
          if (cell && cell !== '#' && header.toLowerCase() !== '#') {
            rowPairs.push(`${header}: ${cell}`);
          }
        });
        if (rowPairs.length > 0) {
          processedLines.push(`• ${rowPairs.join(', ')}`);
        }
      }
    } else {
      if (inTable) {
        inTable = false;
        tableHeaders = [];
      }
      processedLines.push(lines[i]);
    }
  }
  cleaned = processedLines.join('\n');

  // 2. Remove fenced code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  // 3. Remove inline code (`...`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 4. Remove horizontal rule lines / separators (---, ===, ***, ___)
  cleaned = cleaned.replace(/^[\s\-_*=#]{3,}\s*$/gm, '');

  // 5. Remove Markdown headers (# Header, ## Header, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 6. Remove Markdown bold/italic/strikethrough (**text**, *text*, __text__, _text_, ~~text~~)
  cleaned = cleaned.replace(/(\*\*|__|\*|_|~~)(.*?)\1/g, '$2');

  // 7. Remove Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 8. Remove JSON structures
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');

  // 9. Remove key-value metadata blocks if raw tool output (e.g. "Tool: ...", "Action: ...", "ID: ...")
  cleaned = cleaned.replace(/^(Tool|Result|Action|ID):\s*.*$/gim, '');

  // 10. Consolidate excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Sanitizes AI response text into a concise, natural, 1-2 sentence spoken response.
 * Strips code blocks, markdown, technical metadata, IDs, URLs, and converts dates naturally.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // 1. Remove fenced code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  // 2. Remove inline code (`...`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 3. Remove URLs (http://..., https://...)
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, '');

  // 4. Remove UUIDs & ObjectIDs
  cleaned = cleaned.replace(/\b[0-9a-f]{24}\b/gi, '');
  cleaned = cleaned.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');

  // 5. Remove horizontal rule lines / separators (---, ===, ***, ___)
  cleaned = cleaned.replace(/^[\s\-_*=#]{3,}\s*$/gm, '');

  // 6. Remove Markdown headers (# Header, ## Header, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 7. Remove Markdown bold/italic/strikethrough (**text**, *text*, __text__, _text_, ~~text~~)
  cleaned = cleaned.replace(/(\*\*|__|\*|_|~~)(.*?)\1/g, '$2');

  // 8. Remove Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 9. Remove bullet points (* , - , + , • , 1. , etc.)
  cleaned = cleaned.replace(/^[\s]*[*\-+•]\s+/gm, '');
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

  // 10. Remove JSON structures
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');

  // 11. Remove key-value metadata blocks (e.g. "Task: Complete DAA", "Status: Created", "Tool: ...")
  cleaned = cleaned.replace(/^(Task|Status|Priority|Due Date|Category|Location|Tool|Result|ID|Action):\s*.*$/gim, '');

  // 12. Format raw ISO dates to natural words ("tomorrow at 8 AM")
  cleaned = formatNaturalDates(cleaned);

  // 13. Replace multiple newlines/tabs with period-separated sentences
  cleaned = cleaned.replace(/[\r\n]+/g, '. ');

  // 14. Clean up stray formatting symbols (*, #, _, ~, =, |, `, >, ~)
  cleaned = cleaned.replace(/[*#_~=`|><]/g, '');

  // 15. Consolidate multiple dots and whitespace
  cleaned = cleaned.replace(/\s*\.\s*\./g, '.');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 16. Extract 1-2 short conversational sentences for fast TTS
  cleaned = limitToShortSentences(cleaned, 2);

  // Fallback if stripped completely
  if (!cleaned) {
    cleaned = text.replace(/[*#_~=`|><\-]/g, ' ').replace(/\s+/g, ' ').trim();
    cleaned = limitToShortSentences(cleaned, 2);
  }

  return cleaned;
}
