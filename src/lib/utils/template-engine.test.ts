import { describe, it, expect } from 'vitest';
import { renderTemplate, extractName, extractEmail } from './template-engine';

describe('renderTemplate', () => {
  it('replaces single variable', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{greeting}} {{name}}, re: {{subject}}', {
      greeting: 'Hi',
      name: 'Bob',
      subject: 'Invoice',
    });
    expect(result).toBe('Hi Bob, re: Invoice');
  });

  it('leaves unknown variables as-is', () => {
    expect(renderTemplate('Hello {{unknown}}', {})).toBe('Hello {{unknown}}');
  });

  it('handles empty string variable values', () => {
    expect(renderTemplate('Hello {{name}}!', { name: '' })).toBe('Hello !');
  });

  it('handles template with no variables', () => {
    expect(renderTemplate('No variables here', { name: 'test' })).toBe('No variables here');
  });

  it('replaces same variable multiple times', () => {
    expect(renderTemplate('{{x}} and {{x}}', { x: 'a' })).toBe('a and a');
  });

  it('handles empty template', () => {
    expect(renderTemplate('', { name: 'test' })).toBe('');
  });

  it('handles multiline templates', () => {
    const tmpl = 'Hi {{name}},\n\nThanks for your message.\n\nBest,\n{{myName}}';
    const result = renderTemplate(tmpl, { name: 'Alice', myName: 'Bob' });
    expect(result).toBe('Hi Alice,\n\nThanks for your message.\n\nBest,\nBob');
  });
});

describe('extractName', () => {
  it('extracts name from "Name <email>" format', () => {
    expect(extractName('Alice Smith <alice@example.com>')).toBe('Alice Smith');
  });

  it('extracts quoted name', () => {
    expect(extractName('"Bob Jones" <bob@example.com>')).toBe('Bob Jones');
  });

  it('falls back to username part of email', () => {
    expect(extractName('charlie@example.com')).toBe('charlie');
  });

  it('handles name with extra spaces', () => {
    expect(extractName('  Alice Smith  <alice@example.com>')).toBe('Alice Smith');
  });
});

describe('extractEmail', () => {
  it('extracts email from angle brackets', () => {
    expect(extractEmail('Alice <alice@example.com>')).toBe('alice@example.com');
  });

  it('returns trimmed input if no angle brackets', () => {
    expect(extractEmail('  alice@example.com  ')).toBe('alice@example.com');
  });

  it('handles "Name <email>" format', () => {
    expect(extractEmail('"Bob Jones" <bob@test.org>')).toBe('bob@test.org');
  });
});
