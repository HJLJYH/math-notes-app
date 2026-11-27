import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Node's structuredClone cannot clone jsdom's Blob implementation. Preserve
// immutable Blob bytes while cloning record containers for fake-indexeddb.
const originalClone = globalThis.structuredClone
function cloneForIDB<T>(value: T): T {
  if (value instanceof Blob) return value.slice(0, value.size, value.type) as T
  if (Array.isArray(value)) return value.map(cloneForIDB) as T
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneForIDB(item)])) as T
  return originalClone(value)
}
vi.stubGlobal('structuredClone', cloneForIDB)
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import NoteEditor from './components/NoteEditor'
import { Database, Note } from './database'
import { exportFile, MAX_FILE_BYTES } from './fileTransfer'
import { exportBackup, importBackup } from './backup'

const native = vi.hoisted(() => ({ isNative: false, write: vi.fn(), share: vi.fn(), open: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.isNative }, registerPlugin: () => ({ open: native.open }) }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: native.write } }))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); native.isNative = false })
const draft: Note = { title: '上传草稿', content: '不能丢失的正文', category: '分析', created: 1, updated: 1 }
const pick = (file: File) => fireEvent.change(screen.getByLabelText('添加附件'), { target: { files: [file] } })

async function setup(note = draft, upload?: (file: File, id: number) => Promise<void>) {
  const db = await Database.getInstance()
  render(<NoteEditor note={note} categories={['分析']} db={db} onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onFileUpload={upload || ((file, id) => db.saveFile(id, file))} />)
  return db
}

describe('attachment persistence', () => {
  it('saves an ID-less complete draft, awaits upload, refreshes list and reopens persisted attachments', async () => {
    const db = await setup()
    pick(new File(['hello'], '新附件.txt', { type: 'text/plain' }))
    await screen.findByText('新附件.txt', { exact: false })
    await screen.findByText('已保存 1 个附件，笔记正文也已保存')
    const saved = (await db.getNotes()).find(n => n.title === draft.title)!
    expect(saved).toMatchObject({ title: draft.title, content: draft.content, category: draft.category })
    expect(saved.id).toBeTypeOf('number')
    expect(await db.getFiles(saved.id!)).toHaveLength(1)
    cleanup()
    ;(db as any).db.close(); (Database as any).instance = null
    await setup(saved)
    await screen.findByText('新附件.txt', { exact: false })
  })
  it('preserves unsaved existing-note edits and supports selecting the same file again', async () => {
    const db = await Database.getInstance()
    const saved = await db.saveNote({ ...draft, title: '已有笔记' })
    await setup(saved)
    fireEvent.change(screen.getByPlaceholderText('输入笔记内容...支持Markdown'), { target: { value: '新正文' } })
    const file = new File(['abc'], '重复.txt')
    pick(file)
    await screen.findByText('已保存 1 个附件，笔记正文也已保存')
    expect(await db.getNote(saved.id!)).toMatchObject({ content: '新正文' })
    pick(file)
    await waitFor(async () => expect(await db.getFiles(saved.id!)).toHaveLength(2))
    await screen.findByRole('heading', { name: '附件 (2)' })
  })
  it('shows upload errors, keeps the draft and allows retry', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('存储空间不足'))
    const db = await setup({ ...draft, title: '失败草稿' }, upload)
    pick(new File(['a'], 'failure.txt'))
    expect((await screen.findByRole('alert')).textContent).toContain('存储空间不足')
    expect((await db.getNotes()).find(n => n.title === '失败草稿')).toMatchObject({ content: draft.content })
    expect((screen.getByLabelText('添加附件') as HTMLInputElement).disabled).toBe(false)
  })
  it('rejects oversized files before creating a note', async () => {
    const upload = vi.fn()
    await setup(draft, upload)
    const file = new File(['a'], 'large.bin'); Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 })
    pick(file)
    expect((await screen.findByRole('alert')).textContent).toContain('25 MB')
    expect(upload).not.toHaveBeenCalled()
  })
  it('deletes attachments only after confirmation and refreshes the list', async () => {
    const db = await Database.getInstance()
    const saved = await db.saveNote({ ...draft, title: '删除附件测试' })
    await db.saveFile(saved.id!, new File(['abc'], 'delete.txt'))
    await setup(saved)
    await screen.findByText('delete.txt', { exact: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '删除附件' }))
    await waitFor(() => expect(screen.queryByText('delete.txt', { exact: false })).toBeNull())
    expect(await db.getFiles(saved.id!)).toHaveLength(0)
  })
})

describe('native export and backup', () => {
  it('writes base64 to cache, then shares the actual native URI rather than blob links', async () => {
    native.isNative = true
    native.write.mockResolvedValue({ uri: 'file:///cache/exports/test.txt' })
    native.share.mockResolvedValue({})
    await exportFile(new Blob(['hello'], { type: 'text/plain' }), '../test.txt')
    expect(native.write).toHaveBeenCalledWith(expect.objectContaining({ data: 'aGVsbG8=', directory: 'CACHE', recursive: true }))
    expect(native.write.mock.calls.slice(-1)[0][0].path).not.toContain('/../')
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/exports/test.txt'] }))
  })
  it('opens PDFs via native FileProvider viewer with a known MIME type', async () => {
    native.isNative = true
    native.write.mockResolvedValue({ uri: 'file:///cache/exports/test.pdf' })
    native.open.mockResolvedValue({})
    await exportFile(new Blob(['%PDF']), 'test.pdf', true)
    expect(native.open).toHaveBeenCalledWith({ uri: 'file:///cache/exports/test.pdf', mime: 'application/pdf' })
  })
  it('surfaces native export failures rather than claiming download success', async () => {
    native.isNative = true
    native.write.mockRejectedValueOnce(new Error('磁盘已满'))
    await expect(exportFile(new Blob(['a']), 'a.txt')).rejects.toThrow('磁盘已满')
  })
  it('exports and atomically merges backup without overwriting originals', async () => {
    native.isNative = true; native.write.mockResolvedValue({ uri: 'file:///backup.json' })
    const db = await Database.getInstance()
    await exportBackup(db)
    const data = native.write.mock.calls.slice(-1)[0][0].data
    const decoded = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const before = await db.getNotes()
    await importBackup(db, new File([decoded], 'backup.json'))
    expect(await db.getNotes()).toHaveLength(before.length * 2)
    for (const note of before) expect(await db.getNote(note.id!)).toEqual(note)
    await expect(importBackup(db, new File(['{}'], 'invalid.json'))).rejects.toThrow('备份格式')
  })
})
