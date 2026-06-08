'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties
} from 'react';
import type Quill from 'quill';

/** Matches `Quill.sources.SILENT` without importing quill at module load (SSR-safe). */
const SILENT = 'silent' as const;

export const DEFAULT_QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ['link'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean']
  ]
};

export type NativeQuillEditorHandle = {
  getEditor: () => Quill;
};

export type NativeQuillEditorProps = {
  value: string;
  onChange: (html: string) => void;
  modules?: Record<string, unknown>;
  /** Whitelist of active formats (same idea as react-quill `formats`). */
  formats?: string[];
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
};

function normalizeEmpty(html: string) {
  const t = (html || '').trim();
  if (!t || t === '<p><br></p>' || t === '<p></p>') return '';
  return html;
}

/** Quill 2 via ref + effects — no react-quill (avoids React 19 / findDOMNode). */
const NativeQuillEditor = forwardRef<NativeQuillEditorHandle, NativeQuillEditorProps>(
  function NativeQuillEditor(
    {
      value,
      onChange,
      modules = DEFAULT_QUILL_MODULES,
      formats,
      placeholder,
      style,
      className
    },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const skipEmitRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        getEditor: () => {
          const q = quillRef.current;
          if (!q) throw new Error('Quill not initialized');
          return q;
        }
      }),
      []
    );

    useEffect(() => {
      const mountEl = hostRef.current;
      if (!mountEl) return;

      let cancelled = false;
      let q: Quill | null = null;
      const emit = () => {
        if (skipEmitRef.current || !q) return;
        onChangeRef.current(q.getSemanticHTML());
      };

      (async () => {
        const { default: QuillCtor } = await import('quill');
        if (cancelled || !hostRef.current) return;

        const elNow = hostRef.current;
        q = new QuillCtor(elNow, {
          theme: 'snow',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modules: modules as any,
          ...(formats?.length ? { formats } : {}),
          placeholder: placeholder ?? ''
        });
        if (cancelled) {
          elNow.innerHTML = '';
          q = null;
          return;
        }
        quillRef.current = q;

        const initial = normalizeEmpty(valueRef.current);
        if (initial) {
          q.clipboard.dangerouslyPasteHTML(initial, SILENT);
        }
        q.on('text-change', emit);
      })();

      return () => {
        cancelled = true;
        if (q) {
          q.off('text-change', emit);
        }
        quillRef.current = null;
        if (hostRef.current) hostRef.current.innerHTML = '';
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; modules from first render
    }, []);

    useEffect(() => {
      const q = quillRef.current;
      if (!q) return;
      const next = normalizeEmpty(value);
      const cur = normalizeEmpty(q.getSemanticHTML());
      if (next === cur) return;

      skipEmitRef.current = true;
      const range = q.getSelection();
      q.clipboard.dangerouslyPasteHTML(next || '<p><br></p>', SILENT);
      if (range) {
        try {
          q.setSelection(range.index, range.length, SILENT);
        } catch {
          /* ignore */
        }
      }
      skipEmitRef.current = false;
    }, [value]);

    return (
      <div className={className} style={style}>
        <div ref={hostRef} />
      </div>
    );
  }
);

export default NativeQuillEditor;
