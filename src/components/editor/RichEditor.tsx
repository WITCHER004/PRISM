"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"
import Highlight from "@tiptap/extension-highlight"
import { useCallback, useEffect, useRef, useState } from "react"
import { EditorToolbar, type UrlMode } from "./EditorToolbar"
import { SlashMenu } from "./SlashMenu"

interface RichEditorProps {
  /** HTML to start from (an existing draft). Read once on mount. */
  initialContent?: string
  onChange?: (html: string, text: string) => void
  /** Receives the editor instance once it exists (e.g. to focus it from the title) */
  onReady?: (editor: Editor) => void
}

export default function RichEditor({ initialContent, onChange, onReady }: RichEditorProps) {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const [urlMode, setUrlMode] = useState<UrlMode>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading"
          return "Tell your story… (type / for blocks)"
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
    ],
    content: initialContent || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor prose-prism focus:outline-none",
        "aria-label": "Story body",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getHTML(), editor.getText())
    },
  })

  useEffect(() => {
    if (editor) onReady?.(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const requestImage = useCallback(() => setUrlMode("image"), [])

  if (!editor) {
    return <div className="h-[50vh] rounded-[var(--radius-card)] bg-[var(--surface)]/40 animate-pulse" aria-hidden />
  }

  return (
    <div className="relative">
      <EditorToolbar editor={editor} urlMode={urlMode} onUrlModeChange={setUrlMode} />
      <SlashMenu editor={editor} onRequestImage={requestImage} />
      <EditorContent editor={editor} />
    </div>
  )
}
