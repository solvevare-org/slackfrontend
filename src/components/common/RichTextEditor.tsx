import { useEditor, EditorContent } from '@tiptap/react';
import React from 'react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, List, ListOrdered, Code, FileCode } from 'lucide-react';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  rightButtons?: React.ReactNode;
}

const RichTextEditor = ({ content, onChange, onSubmit, placeholder, disabled, rightButtons }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-400 underline hover:text-purple-300',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[80px] max-h-[180px] overflow-y-auto px-4 py-3 text-white',
        'data-placeholder': placeholder || 'Type a message...',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
    editable: !disabled,
  });

  // Clear editor when content prop changes to empty
  React.useEffect(() => {
    if (content === '' && editor && editor.getHTML() !== '<p></p>') {
      editor.commands.setContent('');
    }
  }, [content, editor]);

  const setLink = () => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div className="flex-1 bg-[#2b2f36] border border-purple-500/20 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-purple-500/10 bg-[#1f2329] flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('bold') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('italic') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('underline') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('strike') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>
        <div className="w-px h-5 bg-purple-500/20 mx-1"></div>
        <button
          type="button"
          onClick={setLink}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('link') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Add Link"
        >
          <LinkIcon size={16} />
        </button>
        <div className="w-px h-5 bg-purple-500/20 mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('bulletList') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('orderedList') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-5 bg-purple-500/20 mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('code') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Inline Code"
        >
          <Code size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={disabled}
          className={`p-1.5 rounded-lg transition hover:bg-purple-500/20 ${editor.isActive('codeBlock') ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'}`}
          title="Code Block"
        >
          <FileCode size={16} />
        </button>
        {rightButtons && (
          <>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              {rightButtons}
            </div>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
