// WordPad — rich-text editor z eksportem .docx (TipTap)
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Quote, Undo, Redo, Download, Save, Link as LinkIcon, Eraser,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { saveAs } from "file-saver";
import { toast } from "sonner";

const STORAGE_KEY = "groua-wordpad-content";

export const WordPadPanel = () => {
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) || `<h1>📝 WordPad — Twój edytor dokumentów</h1>
<p>Pisz, formatuj, zapisuj. Wszystko działa offline w Twojej przeglądarce. Eksportuj do <strong>.docx</strong> jednym kliknięciem.</p>
<p><em>Auto-zapis co kilka sekund w localStorage.</em></p>
<ul>
  <li>Pełne formatowanie (bold, italic, underline, listy)</li>
  <li>Nagłówki H1, H2, cytaty</li>
  <li>Linki, undo/redo</li>
  <li>Eksport do Word (.docx) i tekst (.txt)</li>
</ul>` : "",
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none min-h-[400px] focus:outline-none px-4 py-3",
      },
    },
  });

  // Auto-save do localStorage
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      try { localStorage.setItem(STORAGE_KEY, editor.getHTML()); } catch {}
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor]);

  const exportDocx = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${editor.getHTML()}</body></html>`;
      const mod = await import("html-to-docx-buffer");
      const fn: any = (mod as any).default || mod;
      const buf = await fn(html, undefined, { table: { row: { cantSplit: true } }, footer: false });
      const blob = buf instanceof Blob ? buf : new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      saveAs(blob, `dokument-${Date.now()}.docx`);
      toast.success("Eksport .docx gotowy");
    } catch (e: any) {
      toast.error("Błąd eksportu .docx", { description: e?.message });
    }
    setSaving(false);
  };

  const exportTxt = () => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `dokument-${Date.now()}.txt`);
  };

  if (!editor) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">📝 WordPad</CardTitle>
            <CardDescription>Profesjonalny edytor dokumentów z eksportem do .docx — działa offline, auto-zapis</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportTxt} className="gap-1">
              <Download className="w-3 h-3" /> .txt
            </Button>
            <Button size="sm" onClick={exportDocx} disabled={saving} className="gap-1">
              <Save className="w-3 h-3" /> {saving ? "Eksportuję…" : "Eksportuj .docx"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-y bg-muted/40 flex-wrap">
          <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></Toggle>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></Toggle>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></Toggle>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
            const url = window.prompt("URL linku:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}><LinkIcon className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-3.5 h-3.5" /></Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
            if (confirm("Wyczyścić cały dokument?")) {
              editor.chain().focus().clearContent().run();
              localStorage.removeItem(STORAGE_KEY);
            }
          }}><Eraser className="w-3.5 h-3.5" /></Button>
        </div>
        {/* Editor */}
        <div className="bg-background min-h-[450px] max-h-[70vh] overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
};
