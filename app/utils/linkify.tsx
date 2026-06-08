'use client';

/**
 * Converts plain text with URLs and newlines
 * into safe HTML with clickable links.
 */

export function linkifyText(text: string, linkColor = '#11CCEF'): string {
  if (!text) return '';

  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const linked = escaped.replace(urlRegex, (url) => {
    const href = url.startsWith('www.') ? `https://${url}` : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${linkColor};text-decoration:underline;word-break:break-all;">${url}</a>`;
  });

  return linked.replace(/\n/g, '<br>');
}

export function LinkifiedText({
  text,
  className = '',
  linkColor,
}: {
  text: string;
  className?: string;
  linkColor?: string;
}) {
  if (!text) return null;

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{
        __html: linkifyText(text, linkColor),
      }}
      style={{ wordBreak: 'break-word' }}
    />
  );
}
