const ID_KEYS = /^(?:_?id|uuid|user_?id|owner_?id|created_?at|updated_?at)$/i;
const TASK_KEYS = /^(?:tasks?|todos?)$/i;
const REMINDER_KEYS = /^reminders?$/i;
const CALENDAR_KEYS = /^(?:calendar|events?|appointments?)$/i;
const NOTE_KEYS = /^notes?$/i;
const NEWS_KEYS = /^(?:news|articles?|headlines)$/i;

const stripMarkdown = (value) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_~>#]/g, '')
    .replace(/(?:^|\s)(?:[-*]|\d+[.)])\s+/g, ' ')
    .replace(/\b(?:id|uuid)\s*[:=]\s*[a-f\d-]{8,}\b/gi, ' ')
    .replace(/\b[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\b/gi, ' ')
    .replace(/\b[a-f\d]{24}\b/gi, ' ')
    .replace(/[|{}[\]"]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

const numberWord = (number) =>
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][number] ||
  String(number);

const formatDate = (value) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!dateOnly) return stripMarkdown(value);

  const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDiff = Math.round((date - todayStart) / 86400000);
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff === -1) return 'yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => {
  const time = /(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/.exec(value);
  if (!time) return stripMarkdown(value);
  const hours = Number(time[1]);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${time[2]} ${suffix}`;
};

const fieldValue = (record, expression) => {
  const entry = Object.entries(record).find(([key, value]) =>
    expression.test(key.toLowerCase().replace(/[\s-]+/g, '_')) && value != null && value !== '');
  return entry ? String(entry[1]).trim() : '';
};

const describeRecord = (record, kind) => {
  const title = fieldValue(record, /^(?:title|name|task|task_title|event|subject|headline)$/i);
  if (!title) return '';

  const parts = [stripMarkdown(title)];
  const due = fieldValue(record, /^(?:due|due_date|date|event_date|start_date|datetime)$/i);
  const time = fieldValue(record, /^(?:time|start_time|event_time)$/i) ||
    (/\d{4}-\d{2}-\d{2}T/.test(due) ? due : '');
  const priority = fieldValue(record, /^priority$/i);
  const description = fieldValue(record, /^(?:description|details|note|content|summary|excerpt)$/i);
  const status = fieldValue(record, /^status$/i);

  if (due) {
    const dateText = formatDate(due);
    parts.push(kind === 'calendar' ? `on ${dateText}` : `due ${dateText}`);
  }
  if (time) parts.push(`at ${formatTime(time)}`);
  if (priority) parts.push(`with ${stripMarkdown(priority).toLowerCase()} priority`);
  if (description) parts.push(`Description: ${stripMarkdown(description)}`);
  if (status) parts.push(`Status: ${stripMarkdown(status)}`);
  return parts.join(', ');
};

const formatRecords = (records, kind) => {
  const descriptions = records.map((record) => describeRecord(record, kind)).filter(Boolean);
  if (!descriptions.length) return '';

  const label = kind === 'calendar' ? 'calendar event'
    : kind === 'news' ? 'news article' : kind;
  const plural = descriptions.length === 1 ? label : `${label}s`;
  const opening = kind === 'news'
    ? `Here ${descriptions.length === 1 ? 'is one' : `are ${numberWord(descriptions.length)}`} ${plural}.`
    : descriptions.length === 1
      ? `You have one ${label}.`
      : `You have ${numberWord(descriptions.length)} ${plural}.`;
  const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
  return `${opening} ${descriptions.map((description, index) =>
    `${ordinals[index] || `Number ${index + 1}`}, ${description}.`).join(' ')}`;
};

const parseJson = (text) => {
  const candidate = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

const fromStructuredData = (data) => {
  if (Array.isArray(data)) {
    const result = formatRecords(data, 'task');
    if (result) return result;
    return data.map((item) => typeof item === 'string' ? stripMarkdown(item) : fromStructuredData(item))
      .filter(Boolean).join('. ');
  }
  if (!data || typeof data !== 'object') return stripMarkdown(String(data ?? ''));

  for (const [key, kind] of [
    [TASK_KEYS, 'task'],
    [REMINDER_KEYS, 'reminder'],
    [CALENDAR_KEYS, 'calendar'],
    [NOTE_KEYS, 'note'],
    [NEWS_KEYS, 'news'],
  ]) {
    const entry = Object.entries(data).find(([name, value]) => key.test(name) && Array.isArray(value));
    if (entry) {
      const result = formatRecords(entry[1], kind);
      if (result) return result;
    }
  }

  return Object.entries(data)
    .filter(([key, value]) => !ID_KEYS.test(key) && value != null)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const result = formatRecords(value, 'item');
        return result || value.map((item) => fromStructuredData(item)).filter(Boolean).join('. ');
      }
      if (typeof value === 'object') return fromStructuredData(value);
      return `${stripMarkdown(key.replace(/[_-]/g, ' '))}: ${stripMarkdown(String(value))}`;
    })
    .filter(Boolean)
    .join('. ');
};

const fromMarkdownTable = (text) => {
  const rows = text.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line.includes('|') && !/^\|?[\s:|-]+\|?$/.test(line));
  if (rows.length < 2) return '';

  const splitRow = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(stripMarkdown);
  const headers = splitRow(rows[0]);
  if (!headers.some(Boolean)) return '';

  const records = rows.slice(1).map((line) => {
    const values = splitRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
  const context = text.slice(0, text.indexOf(rows[0])).toLowerCase();
  const kind = /reminder/.test(context) ? 'reminder'
    : /calendar|event|appointment/.test(context) ? 'calendar'
      : 'task';
  return formatRecords(records, kind);
};

export const cleanVoiceResponse = (response) => {
  const original = typeof response === 'string' ? response : String(response ?? '');
  const structured = parseJson(original);
  if (structured !== null) {
    const speech = fromStructuredData(structured);
    if (speech) return speech;
  }

  const tableSpeech = fromMarkdownTable(original);
  if (tableSpeech) return tableSpeech;

  const withoutCodeBlocks = original.replace(/```[\s\S]*?```/g, ' ');
  const cleaned = stripMarkdown(withoutCodeBlocks)
    .replace(/-{3,}/g, ' ')
    .replace(/[=+\\]/g, ' ')
    .replace(/\s*[•·]\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
};
