// src/core/webcontainer/types.ts
export interface ProcessHandle {
  id: string;
  exitCode: Promise<number>;
  kill: () => void;
  stdin: WritableStreamDefaultWriter<string>;
}

export interface WebContainerFs {
  readFile(path: string, encoding: 'utf-8'): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<unknown[]>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}
