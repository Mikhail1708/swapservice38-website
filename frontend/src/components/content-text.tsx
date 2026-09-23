/** Plain service text is escaped by React; blank lines separate paragraphs. */
export function PlainText({ text, preview = false }: { text: string; preview?: boolean }) {
  return (
    <div className={`content-text plain-content${preview ? ' content-preview' : ''}`}>
      {text.split(/\r?\n\s*\r?\n/).filter(Boolean).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

/** Only use with content sanitized by the public article API, including old records. */
export function ArticleContent({ sanitizedHtml }: { sanitizedHtml: string }) {
  // Preserve textarea newlines for plain/inline text. Block HTML already supplies
  // its own layout; preserving its source indentation would add duplicate gaps.
  const hasBlockMarkup = /<\/?(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|figure|hr|br)\b/i.test(sanitizedHtml);
  return <div className={`content-text${hasBlockMarkup ? '' : ' plain-content'}`}
    dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
