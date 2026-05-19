/**
 * Lightweight markdown-to-HTML renderer for AI chat responses.
 * Supports: headers (# ## ###), **bold**, *italic*, `inline code`,
 * ```fenced code blocks```, bullet lists (- / *), numbered lists (1.),
 * and line breaks.
 *
 * Security: HTML is escaped BEFORE markdown processing, so {@html} usage is safe.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Apply inline formatting: bold, italic, inline code */
function applyInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function closeList(output: string[], type: 'ul' | 'ol' | null) {
  if (type === 'ul') output.push('</ul>');
  if (type === 'ol') output.push('</ol>');
}

export function renderMarkdown(text: string): string {
  // Escape HTML entities first (prevents XSS)
  let html = escapeHtml(text);

  // Handle fenced code blocks (```...```)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // Process line-by-line for block elements
  const lines = html.split('\n');
  const output: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Code block placeholder - insert directly
    const cbMatch = trimmed.match(/^\x00CODEBLOCK_(\d+)\x00$/);
    if (cbMatch) {
      closeList(output, inList);
      inList = null;
      output.push(codeBlocks[parseInt(cbMatch[1])]);
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      closeList(output, inList); inList = null;
      output.push(`<h4>${applyInline(trimmed.slice(4))}</h4>`);
    } else if (trimmed.startsWith('## ')) {
      closeList(output, inList); inList = null;
      output.push(`<h3>${applyInline(trimmed.slice(3))}</h3>`);
    } else if (trimmed.startsWith('# ')) {
      closeList(output, inList); inList = null;
      output.push(`<h3>${applyInline(trimmed.slice(2))}</h3>`);
    }
    // Bullet lists: - or *
    else if (/^[-*]\s/.test(trimmed)) {
      if (inList !== 'ul') {
        closeList(output, inList);
        output.push('<ul>');
        inList = 'ul';
      }
      output.push(`<li>${applyInline(trimmed.slice(2))}</li>`);
    }
    // Numbered lists: 1. 2. etc
    else if (/^\d+\.\s/.test(trimmed)) {
      if (inList !== 'ol') {
        closeList(output, inList);
        output.push('<ol>');
        inList = 'ol';
      }
      output.push(`<li>${applyInline(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
    }
    // Empty line
    else if (trimmed === '') {
      closeList(output, inList);
      inList = null;
      // Only add break between content, not at start
      if (output.length > 0) output.push('<br>');
    }
    // Regular paragraph
    else {
      closeList(output, inList);
      inList = null;
      output.push(`<p>${applyInline(trimmed)}</p>`);
    }
  }

  closeList(output, inList);
  return output.join('');
}
