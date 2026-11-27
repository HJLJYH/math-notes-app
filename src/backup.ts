import { Database, Note, FileRecord } from './database'
import { exportFile, readDataUrl, MAX_FILE_BYTES } from './fileTransfer'

export async function exportBackup(db: Database) {
  const notes = await db.getNotes()
  const files: object[] = []
  let bytes = 0
  for (const note of notes) for (const file of await db.getFiles(note.id!)) {
    bytes += file.data.size
    if (bytes > 17 * 1024 * 1024) throw new Error('附件总量超过完整备份上限17 MB，请逐个导出大附件。原数据未改变。')
    files.push({ id: file.id, noteId: file.noteId, name: file.name, type: file.type, data: await readDataUrl(file.data) })
  }
  await exportFile(new Blob([JSON.stringify({ format: 'math-notes-backup', version: 1, notes, files })], { type: 'application/json' }), `数学笔记备份-${new Date().toISOString().slice(0, 10)}.json`)
}
export async function importBackup(db: Database, file: File) {
  if (file.size > MAX_FILE_BYTES) throw new Error('备份文件超过25 MB')
  const raw = JSON.parse(await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(file)
  }))
  if (raw.format !== 'math-notes-backup' || raw.version !== 1 || !Array.isArray(raw.notes) || !Array.isArray(raw.files)) throw new Error('备份格式不正确')
  const ids = new Set<number>()
  const notes: Note[] = raw.notes.map((n: Note) => {
    if (!Number.isSafeInteger(n.id) || ids.has(n.id!) || typeof n.title !== 'string' || typeof n.content !== 'string' || typeof n.category !== 'string' || !Number.isFinite(n.created) || !Number.isFinite(n.updated)) throw new Error('备份笔记数据损坏')
    ids.add(n.id!)
    return { id: n.id, title: n.title, content: n.content, category: n.category, created: n.created, updated: n.updated }
  })
  const files: FileRecord[] = raw.files.map((f: { noteId: number; name: string; type: string; data: string }) => {
    if (!ids.has(f.noteId) || typeof f.name !== 'string' || typeof f.type !== 'string' || typeof f.data !== 'string' || !/^data:[^,]*;base64,/.test(f.data)) throw new Error('备份附件数据损坏')
    const binary = atob(f.data.slice(f.data.indexOf(',') + 1))
    return { noteId: f.noteId, name: f.name, type: f.type, data: new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: f.type }) }
  })
  await db.restoreBackup(notes, files)
}
