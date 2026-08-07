import { describe, it, expect } from 'vitest';
import { sanitizeInput, sanitizeHtml, sanitizeObject } from '../utils/sanitize.js';

describe('sanitizeInput', () => {
  it('strips all HTML tags including script content', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
  });

  it('strips attributes like onclick', () => {
    expect(sanitizeInput('<a onclick="evil()">Click</a>')).toBe('Click');
  });

  it('removes all HTML tags keeping only text', () => {
    expect(sanitizeInput('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('returns empty string for null input', () => {
    expect(sanitizeInput(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('returns safe plain text unchanged', () => {
    expect(sanitizeInput('Just some plain text')).toBe('Just some plain text');
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('');
  });
});

describe('sanitizeHtml', () => {
  it('preserves allowed tags', () => {
    const result = sanitizeHtml('<p>Hello</p><b>bold</b><i>italic</i>');
    expect(result).toBe('<p>Hello</p><b>bold</b><i>italic</i>');
  });

  it('removes attributes from allowed tags', () => {
    const result = sanitizeHtml('<p class="big" onclick="evil()">text</p>');
    expect(result).toBe('<p>text</p>');
  });

  it('strips disallowed tags like script and their content', () => {
    const result = sanitizeHtml('<p>safe</p><script>alert(1)</script>');
    expect(result).toBe('<p>safe</p>');
  });

  it('returns empty string for null input', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('preserves ul, ol, li, em, strong, br tags', () => {
    const input = '<ul><li>one</li><li>two</li></ul><br><em>emphasized</em><strong>strong</strong>';
    const allowed = sanitizeHtml(input);
    expect(allowed).toContain('<ul>');
    expect(allowed).toContain('<li>');
    expect(allowed).toContain('<br>');
    expect(allowed).toContain('<em>');
    expect(allowed).toContain('<strong>');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes all string properties', () => {
    const obj = {
      name: '<script>alert(1)</script>',
      description: '<p>safe html</p>',
    };
    const result = sanitizeObject(obj);
    expect(result.name).toBe('');
    expect(result.description).toBe('safe html');
  });

  it('leaves non-string properties unchanged', () => {
    const obj = {
      name: 'Alice',
      age: 30,
      isActive: true,
      tags: ['a', 'b', 'c'],
    };
    const result = sanitizeObject(obj);
    expect(result.age).toBe(30);
    expect(result.isActive).toBe(true);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  it('recursively sanitizes nested objects', () => {
    const obj = {
      user: {
        name: '<b>Bob</b>',
        profile: {
          bio: '<script>track()</script>',
        },
      },
    };
    const result = sanitizeObject(obj);
    expect(result.user.name).toBe('Bob');
    expect(result.user.profile.bio).toBe('');
  });

  it('handles empty objects', () => {
    expect(sanitizeObject({})).toEqual({});
  });

  it('returns a new object without mutating the original', () => {
    const original = { name: '<script>x</script>' };
    const sanitized = sanitizeObject(original);
    expect(original.name).toBe('<script>x</script>');
    expect(sanitized.name).toBe('');
    expect(original).not.toBe(sanitized);
  });
});
