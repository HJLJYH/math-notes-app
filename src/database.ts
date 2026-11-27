import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface NoteDBSchema extends DBSchema {
  notes: {
    key: number;
    value: Note;
    indexes: {
      'by-category': string;
      'by-created': number;
    };
  };
  files: {
    key: number;
    value: FileRecord;
    indexes: {
      'by-note': number;
    };
  };
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  category: string;
  created: number;
  updated: number;
}

export interface FileRecord {
  id?: number;
  noteId: number;
  name: string;
  type: string;
  data: Blob;
}

class Database {
  private static instance: Database | null = null;
  private static initializing: Promise<Database> | null = null;
  private db: IDBPDatabase<NoteDBSchema> | null = null;

  private constructor() {}

  static async getInstance(): Promise<Database> {
    if (Database.instance) return Database.instance;
    if (!Database.initializing) {
      const database = new Database();
      Database.initializing = database.init().then(() => {
        Database.instance = database;
        return database;
      }).finally(() => { Database.initializing = null; });
    }
    return Database.initializing;
  }

  private async init() {
    this.db = await openDB<NoteDBSchema>('math-notes', 1, {
      upgrade(db) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        notesStore.createIndex('by-category', 'category');
        notesStore.createIndex('by-created', 'created', { unique: false });

        const filesStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        filesStore.createIndex('by-note', 'noteId');
      }
    });
  }

  async saveNote(note: Note): Promise<Note> {
    if (!this.db) throw new Error('Database not initialized');
    const saved = { ...note, created: note.created || Date.now(), updated: Date.now() };
    const tx = this.db.transaction('notes', 'readwrite');
    saved.id = await tx.store.put(saved);
    await tx.done;
    return saved;
  }

  async deleteNote(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('notes', id);
    const files = await this.db.getAllFromIndex('files', 'by-note', id);
    for (const file of files) {
      await this.db.delete('files', file.id!);
    }
  }

  async getNotes(category?: string): Promise<Note[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let notes: Note[];
    if (category && category !== '全部') {
      notes = await this.db.getAllFromIndex('notes', 'by-category', category);
    } else {
      notes = await this.db.getAll('notes');
    }
    
    return notes.sort((a, b) => b.updated - a.updated);
  }

  async getNote(id: number): Promise<Note | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('notes', id);
  }

  async saveFile(noteId: number, file: File): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Store the Blob directly: avoid duplicating large attachments in memory.
    const tx = this.db.transaction(['notes', 'files'], 'readwrite');
    if (!await tx.objectStore('notes').get(noteId)) {
      await tx.done;
      throw new Error('笔记不存在，请先保存笔记');
    }
    await tx.objectStore('files').add({
      noteId, name: file.name, type: file.type, data: file.slice(0, file.size, file.type)
    });
    await tx.done;
  }

  async getFiles(noteId: number): Promise<FileRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAllFromIndex('files', 'by-note', noteId);
  }

  async getFile(id: number): Promise<FileRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('files', id);
  }

  async restoreBackup(notes: Note[], files: FileRecord[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    // Merge using new IDs, never overwrite existing notes. Atomic rollback on failure.
    const tx = this.db.transaction(['notes', 'files'], 'readwrite');
    const ids = new Map<number, number>();
    for (const note of notes) {
      const { id, ...value } = note;
      ids.set(id!, await tx.objectStore('notes').add(value));
    }
    for (const file of files) {
      const { id: _id, ...value } = file;
      await tx.objectStore('files').add({ ...value, noteId: ids.get(file.noteId)! });
    }
    await tx.done;
  }

  async deleteFile(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('files', id);
  }
}

export { Database }
