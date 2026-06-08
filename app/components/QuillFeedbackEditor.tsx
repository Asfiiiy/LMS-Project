'use client';

import NativeQuillEditor from '@/app/components/NativeQuillEditor';

type Props = {
  value: string;
  onChange: (html: string) => void;
  height?: number;
  placeholder?: string;
};

/** Tutor feedback — Quill 2 without react-quill (React 19 safe). */
export default function QuillFeedbackEditor({
  value,
  onChange,
  height = 400,
  placeholder = 'Write feedback here...'
}: Props) {
  return (
    <div className="quill-feedback-editor">
      <NativeQuillEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ height: `${height}px`, marginBottom: '50px' }}
      />
    </div>
  );
}
