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
  private db: IDBPDatabase<NoteDBSchema> | null = null;

  private constructor() {}

  static async getInstance(): Promise<Database> {
    if (Database.instance) return Database.instance;
    
    Database.instance = new Database();
    await Database.instance.init();
    return Database.instance;
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

  async saveNote(note: Note): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    if (note.id) {
      note.updated = now;
      await this.db.put('notes', note);
    } else {
      note.created = now;
      note.updated = now;
      await this.db.add('notes', note);
    }
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
    
    const data = await file.arrayBuffer();
    const blob = new Blob([data], { type: file.type });
    
    await this.db.add('files', {
      noteId,
      name: file.name,
      type: file.type,
      data: blob
    });
  }

  async getFiles(noteId: number): Promise<FileRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAllFromIndex('files', 'by-note', noteId);
  }

  async getFile(id: number): Promise<FileRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('files', id);
  }

  async deleteFile(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('files', id);
  }
}

export { Database }
