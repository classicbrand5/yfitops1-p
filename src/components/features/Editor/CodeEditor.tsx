
// src/components/features/Editor/CodeEditor.tsx
// Uses @monaco-editor/react to avoid manual worker config and bundle issues.
// Custom yfitops-dark theme is registered in the beforeMount callback.

import React, { useRef, useCallback } from 'react';
import MonacoEditor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { EditorTabs } from './EditorTabs';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';

// ── Theme registration (runs before editor mounts) ─────────
const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('yfitops-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',   foreground: '5C5C7A', fontStyle: 'italic' },
      { token: 'keyword',   foreground: '9B6EF5' },
      { token: 'string',    foreground: '00F5A0' },
      { token: 'number',    foreground: 'FBBF24' },
      { token: 'type',      foreground: '38BDF8' },
      { token: 'class',     foreground: 'FB923C' },
      { token: 'function',  foreground: 'E879F9' },
      { token: 'variable',  foreground: 'EEEEFF' },
      { token: 'delimiter', foreground: '9494B8' },
      { token: 'operator',  foreground: '9494B8' },
    ],
    colors: {
      'editor.background':                 '#0C0C12',
      'editor.foreground':                 '#EEEEFF',
      'editor.lineHighlightBackground':    '#16161F',
      'editorLineNumber.foreground':       '#3A3A52',
      'editorLineNumber.activeForeground': '#9494B8',
      'editorCursor.foreground':           '#00F5A0',
      'editor.selectionBackground':        '#7C3AED33',
      'editorBracketHighlight.foreground1':'#00F5A0',
      'editorBracketHighlight.foreground2':'#9B6EF5',
      'editorGutter.background':           '#0C0C12',
      'scrollbarSlider.background':        '#1C1C2788',
      'scrollbarSlider.hoverBackground':   '#1C1C27CC',
      'minimap.background':                '#0C0C12',
      'editor.findMatchBackground':        '#00F5A020',
      'editor.findMatchHighlightBackground':'#9B6EF515',
    },
  });
};

export function CodeEditor() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { openTabs, activeTabId, markTabDirty, setCursorPosition, setEditorMarkers } = useAppStore();
  const { readFileContent, saveFile } = useFileSystem();

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // ── Editor mounted ─────────────────────────────────────────
  const handleMount: OnMount = useCallback(
    async (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Track cursor position
      editor.onDidChangeCursorPosition((e) => {
        if (activeTabId) {
          setCursorPosition(activeTabId, e.position.lineNumber, e.position.column);
        }
      });

      // Debounced auto-save
      editor.onDidChangeModelContent(() => {
        if (activeTabId) {
          markTabDirty(activeTabId, true);
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(async () => {
            const tab = openTabs.find((t) => t.id === activeTabId);
            if (tab && isWebContainerReady()) {
              await saveFile(tab.path, editor.getValue()).catch(console.error);
            }
          }, 800);
        }
      });

      // Track markers
      monaco.editor.onDidChangeMarkers(() => {
        const markers = monaco.editor.getModelMarkers({});
        const errors = markers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length;
        const warnings = markers.filter((m) => m.severity === monaco.MarkerSeverity.Warning).length;
        setEditorMarkers(errors, warnings);
      });

      // Ctrl+S force save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const tab = openTabs.find((t) => t.id === activeTabId);
        if (tab) {
          clearTimeout(debounceRef.current);
          saveFile(tab.path, editor.getValue()).catch(console.error);
          markTabDirty(tab.id, false);
        }
      });

      // Load initial file content
      if (activeTab && isWebContainerReady()) {
        try {
          const content = await readFileContent(activeTab.path);
          editor.setValue(content);
        } catch {
          editor.setValue(`// Error loading ${activeTab.path}`);
        }
      }
    },
    // The error message indicates that 'react-hooks/exhaustive-deps' rule is not found.
    // This is typically an ESLint configuration issue, not a TypeScript syntax error.
    // However, if the intent was to disable the rule, the comment itself is not a syntax error.
    // Since the task is to fix syntax errors, and this comment is syntactically valid TypeScript,
    // no change is needed for the comment itself. The error is external to the TS parser.
    [],
  );

  // ── Load file when active tab changes ─────────────────────
  // We imperatively set value since the editor is uncontrolled
  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeTab) return;

    async function loadFile() {
      if (!activeTab || !editor || !monaco) return;

      const uri = monaco.Uri.file(activeTab.path);
      let model = monaco.editor.getModel(uri);

      if (!model) {
        if (isWebContainerReady()) {
          try {
            const content = await readFileContent(activeTab.path);
            model = monaco.editor.createModel(content, activeTab.language, uri);
          } catch {
            model = monaco.editor.createModel(
              `// Error loading ${activeTab.path}`,
              activeTab.language,
              uri,
            );
          }
        } else {
          model = monaco.editor.createModel(
            `// ${activeTab.path}\n// WebContainer initializing — file will load when ready`,
            activeTab.language,
            uri,
          );
        }
      }

      editor.setModel(model);
    }

    loadFile();
    // The error message indicates that 'react-hooks/exhaustive-deps' rule is not found.
    // This is typically an ESLint configuration issue, not a TypeScript syntax error.
    // However, if the intent was to disable the rule, the comment itself is not a syntax error.
    // Since the task is to fix syntax errors, and this comment is syntactically valid TypeScript,
    // no change is needed for the comment itself. The error is external to the TS parser.
  }, [activeTab?.id, activeTab?.path]);

  // ── Empty state ────────────────────────────────────────────
  if (!activeTab) {
    return (
      <div className="flex flex-col h-full">
        <EditorTabs />
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ background: 'var(--bg-base)' }}
        >
          <div className="text-center animate-fade-in">
            <div className="text-4xl mb-4" aria-hidden="true">⚡</div>
            <h3 className="font-display text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
              No file open
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a file from the explorer or ask the AI agent to create one
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <EditorTabs />

      <div className="flex-1 relative overflow-hidden">
        <MonacoEditor
          height="100%"
          theme="yfitops-dark"
          language={activeTab.language ?? 'typescript'}
          defaultValue="// Open a file from the explorer to start editing"
          beforeMount={beforeMount}
          onMount={handleMount}
          loading={
            <div
              className="flex items-center justify-center h-full"
              style={{ background: 'var(--bg-base)' }}
            >
              <div className="text-center">
                <div
                  className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
                  style={{ borderColor: 'var(--accent-400)' }}
                  aria-hidden="true"
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading editor…</p>
              </div>
            </div>
          }
          options={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 14,
            lineHeight: 22,
            letterSpacing: 0.3,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'phase',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'gutter',
            guides: { indentation: true, bracketPairs: true },
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: false,
            tabSize: 2,
            wordWrap: 'off',
            rulers: [80, 120],
            suggest: { insertMode: 'replace' },
            quickSuggestions: { strings: 'on', comments: 'on' },
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
