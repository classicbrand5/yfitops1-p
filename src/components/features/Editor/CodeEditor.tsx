// src/components/features/Editor/CodeEditor.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { EditorTabs } from './EditorTabs';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';

// Lazy Monaco load
let monacoInstance: typeof import('monaco-editor') | null = null;

async function getMonaco() {
  if (monacoInstance) return monacoInstance;
  const monaco = await import('monaco-editor');
  monacoInstance = monaco;
  return monaco;
}

function defineYFitOpsTheme(monaco: typeof import('monaco-editor')) {
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
      'editor.background':              '#0C0C12',
      'editor.foreground':              '#EEEEFF',
      'editor.lineHighlightBackground': '#16161F',
      'editorLineNumber.foreground':    '#3A3A52',
      'editorLineNumber.activeForeground': '#9494B8',
      'editorCursor.foreground':        '#00F5A0',
      'editor.selectionBackground':     '#7C3AED33',
      'editorBracketHighlight.foreground1': '#00F5A0',
      'editorBracketHighlight.foreground2': '#9B6EF5',
      'editorGutter.background':        '#0C0C12',
      'scrollbarSlider.background':     '#1C1C2788',
      'scrollbarSlider.hoverBackground':'#1C1C27CC',
      'minimap.background':             '#0C0C12',
      'editor.findMatchBackground':     '#00F5A020',
      'editor.findMatchHighlightBackground': '#9B6EF515',
    },
  });
}

export function CodeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const [isMonacoLoading, setIsMonacoLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { openTabs, activeTabId, markTabDirty, setCursorPosition, setEditorMarkers } = useAppStore();
  const { readFileContent, saveFile } = useFileSystem();

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  // Boot Monaco
  useEffect(() => {
    let disposed = false;

    async function initMonaco() {
      if (!containerRef.current) return;
      const monaco = await getMonaco();
      if (disposed || !containerRef.current) return;

      defineYFitOpsTheme(monaco);
      monaco.editor.setTheme('yfitops-dark');

      const editor = monaco.editor.create(containerRef.current, {
        theme: 'yfitops-dark',
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
        value: '// Open a file from the explorer to start editing',
        language: 'typescript',
      });

      editorRef.current = editor;
      setIsMonacoLoading(false);

      // Track cursor position
      editor.onDidChangeCursorPosition((e) => {
        if (activeTabId) {
          setCursorPosition(activeTabId, e.position.lineNumber, e.position.column);
        }
      });

      // Track dirty state with debounce
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

      // Track markers (errors/warnings)
      monaco.editor.onDidChangeMarkers(() => {
        const markers = monaco.editor.getModelMarkers({});
        const errors = markers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length;
        const warnings = markers.filter((m) => m.severity === monaco.MarkerSeverity.Warning).length;
        setEditorMarkers(errors, warnings);
      });

      // Ctrl+S save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const tab = openTabs.find((t) => t.id === activeTabId);
        if (tab) {
          clearTimeout(debounceRef.current);
          saveFile(tab.path, editor.getValue()).catch(console.error);
        }
      });
    }

    initMonaco();

    return () => {
      disposed = true;
      clearTimeout(debounceRef.current);
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  // Load file content when active tab changes
  useEffect(() => {
    if (!activeTab || !editorRef.current) return;

    async function loadFile() {
      if (!activeTab) return;
      const monaco = await getMonaco();

      if (isWebContainerReady()) {
        try {
          const content = await readFileContent(activeTab.path);
          const model = monaco.editor.createModel(
            content,
            activeTab.language === 'typescript' ? 'typescript' : activeTab.language,
            monaco.Uri.file(activeTab.path)
          );
          editorRef.current?.setModel(model);
        } catch (err) {
          console.error('[CodeEditor] Failed to load file:', err);
          editorRef.current?.setValue(`// Error loading ${activeTab.path}\n// ${err}`);
        }
      } else {
        // No WebContainer — show placeholder
        editorRef.current?.setValue(`// ${activeTab.path}\n// WebContainer is initializing — file content will load when ready`);
        const model = monaco.editor.createModel('', activeTab.language);
        editorRef.current?.setModel(model);
      }
    }

    loadFile();
  }, [activeTab?.id, activeTab?.path]);

  if (!activeTab) {
    return (
      <div className="flex flex-col h-full">
        <EditorTabs />
        <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--bg-base)' }}>
          <div className="text-center animate-fade-in">
            <div className="text-4xl mb-4">⚡</div>
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

      {/* Monaco container */}
      <div className="flex-1 relative overflow-hidden">
        {isMonacoLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-base)', zIndex: 1 }}>
            <div className="text-center">
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
                style={{ borderColor: 'var(--accent-400)' }}
                aria-hidden="true"
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading editor…</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" aria-label="Code editor" />
      </div>
    </div>
  );
}
