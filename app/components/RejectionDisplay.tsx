'use client'
import { useState } from 'react'

interface RejectionDisplayProps {
  feedback: string
  previewLength?: number
  showLabel?: boolean
  variant?: 'card' | 'inline' | 'modal'
}

export default function RejectionDisplay({
  feedback,
  previewLength = 200,
  showLabel = true,
  variant = 'card'
}: RejectionDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  if (!feedback) return null
  const hasHtml = /<[^>]+>/.test(feedback)

  const isLong = feedback.length > previewLength
  const displayText = expanded || !isLong
    ? feedback
    : feedback.substring(0, previewLength) + '...'

  if (variant === 'inline') {
    return (
      <span style={{
        fontSize: '12px',
        color: '#dc2626',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {hasHtml ? (
          <span
            dangerouslySetInnerHTML={{
              __html: expanded || !isLong ? feedback : feedback.replace(/<[^>]*>/g, '').substring(0, previewLength) + '...'
            }}
          />
        ) : (
          displayText
        )}
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(p => !p)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              marginLeft: '4px',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </span>
    )
  }

  return (
    <div style={{
      marginTop: variant === 'card' ? '10px' : '0',
      border: '1px solid #fecaca',
      borderRadius: '10px',
      overflow: 'hidden',
      background: '#fff'
    }}>
      {/* Header bar */}
      <div
        onClick={() => isLong && setExpanded(p => !p)}
        style={{
          padding: '8px 12px',
          background: '#fee2e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isLong ? 'pointer' : 'default'
        }}
      >
        {showLabel && (
          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#dc2626',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            📋 Rejection Reason
          </span>
        )}
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(p => !p)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 'auto'
            }}
          >
            {expanded ? '▲ Show less' : '▼ Read more'}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px' }}>
        {hasHtml ? (
          <div
            style={{
              fontSize: '13px',
              color: '#374151',
              lineHeight: 1.7,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            dangerouslySetInnerHTML={{
              __html: expanded || !isLong ? feedback : feedback.replace(/<[^>]*>/g, '').substring(0, previewLength) + '...'
            }}
          />
        ) : (
          <p style={{
            fontSize: '13px',
            color: '#374151',
            lineHeight: 1.7,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {displayText}
          </p>
        )}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '6px 0 0',
              display: 'block',
              textDecoration: 'underline'
            }}
          >
            Read full feedback ▼
          </button>
        )}
      </div>
    </div>
  )
}
