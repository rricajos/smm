import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  describe('HTML escaping', () => {
    it('escapes HTML tags', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes ampersands', () => {
      const result = renderMarkdown('A & B');
      expect(result).toContain('&amp;');
    });

    it('escapes quotes', () => {
      const result = renderMarkdown('Say "hello"');
      expect(result).toContain('&quot;');
    });
  });

  describe('inline formatting', () => {
    it('renders bold text', () => {
      const result = renderMarkdown('This is **bold** text');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('renders italic text', () => {
      const result = renderMarkdown('This is *italic* text');
      expect(result).toContain('<em>italic</em>');
    });

    it('renders inline code', () => {
      const result = renderMarkdown('Use `console.log()` here');
      expect(result).toContain('<code>console.log()</code>');
    });

    it('renders mixed inline formatting', () => {
      const result = renderMarkdown('**bold** and *italic* and `code`');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<code>code</code>');
    });
  });

  describe('headers', () => {
    it('renders # as h3', () => {
      const result = renderMarkdown('# Title');
      expect(result).toContain('<h3>Title</h3>');
    });

    it('renders ## as h3', () => {
      const result = renderMarkdown('## Subtitle');
      expect(result).toContain('<h3>Subtitle</h3>');
    });

    it('renders ### as h4', () => {
      const result = renderMarkdown('### Section');
      expect(result).toContain('<h4>Section</h4>');
    });

    it('applies inline formatting in headers', () => {
      const result = renderMarkdown('## **Bold** Header');
      expect(result).toContain('<h3><strong>Bold</strong> Header</h3>');
    });
  });

  describe('lists', () => {
    it('renders unordered list with -', () => {
      const result = renderMarkdown('- Item 1\n- Item 2\n- Item 3');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
      expect(result).toContain('</ul>');
    });

    it('renders unordered list with *', () => {
      const result = renderMarkdown('* A\n* B');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>A</li>');
      expect(result).toContain('<li>B</li>');
    });

    it('renders ordered list', () => {
      const result = renderMarkdown('1. First\n2. Second\n3. Third');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
      expect(result).toContain('<li>Second</li>');
      expect(result).toContain('</ol>');
    });

    it('closes list when switching type', () => {
      const result = renderMarkdown('- Bullet\n1. Number');
      expect(result).toContain('</ul>');
      expect(result).toContain('<ol>');
    });
  });

  describe('code blocks', () => {
    it('renders fenced code block', () => {
      const result = renderMarkdown('```js\nconst x = 1;\n```');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('const x = 1;');
      expect(result).toContain('</code></pre>');
    });

    it('renders code block without language', () => {
      const result = renderMarkdown('```\nhello\n```');
      expect(result).toContain('<pre><code>hello</code></pre>');
    });
  });

  describe('paragraphs and line breaks', () => {
    it('wraps plain text in <p>', () => {
      const result = renderMarkdown('Hello world');
      expect(result).toBe('<p>Hello world</p>');
    });

    it('inserts <br> for empty lines', () => {
      const result = renderMarkdown('Para 1\n\nPara 2');
      expect(result).toContain('<p>Para 1</p>');
      expect(result).toContain('<br>');
      expect(result).toContain('<p>Para 2</p>');
    });
  });

  describe('complex documents', () => {
    it('renders a mixed markdown document', () => {
      const md = [
        '# Title',
        '',
        'Some **bold** text.',
        '',
        '- Item A',
        '- Item B',
        '',
        '```',
        'code here',
        '```',
      ].join('\n');
      const result = renderMarkdown(md);
      expect(result).toContain('<h3>Title</h3>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<pre><code>');
    });
  });
});
