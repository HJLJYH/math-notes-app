import { useState, useEffect } from 'react'
import { Database, Note, FileRecord } from '../database'
import { exportFile, MAX_FILE_BYTES } from '../fileTransfer'

interface NoteEditorProps {
  note: Note
  categories: string[]
  onSave: (note: Note) => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
  onFileUpload: (file: File, noteId: number) => Promise<void> | void
  db: Database | null
  onBack: () => void
}
const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请检查可用存储空间后重试'

function Preview({ file }: { file: FileRecord }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const image = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)
  const plain = file.type.startsWith('text/') || /\.(txt|md|csv|json|tex)$/i.test(file.name)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (image) { objectUrl = URL.createObjectURL(file.data); setUrl(objectUrl) }
    if (plain) {
      if (file.data.size > 1024 * 1024) setError('文本超过1 MB，请导出后阅读')
      else {
        const reader = new FileReader()
        reader.onload = () => { if (active) setText(String(reader.result)) }
        reader.onerror = () => { if (active) setError('文本读取失败，请导出后阅读') }
        reader.readAsText(file.data)
      }
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file, image, plain])
  return <div>
    {image && url && <img src={url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />}
    {plain && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '60vh', overflow: 'auto' }}>{text}</pre>}
    {error && <p role="alert">{error}</p>}
    {!image && !plain && <p>PDF及其他文件请点“其他应用打开”，选择已安装的阅读器；也可“导出/分享”保存副本。网页端将下载文件。附件仅保存在本机。</p>}
  </div>
}

export default function NoteEditor({ note, categories, onSave, onDelete, onFileUpload, db, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [category, setCategory] = useState(note.category || categories[0])
  const [savedNote, setSavedNote] = useState(note)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<number | null>(null)
  const draft = () => ({ ...savedNote, title, content, category: category || note.category || categories[0] })

  useEffect(() => {
    let active = true
    if (note.id && db) db.getFiles(note.id).then(result => { if (active) setFiles(result) }).catch(e => { if (active) setError(message(e)) })
    return () => { active = false }
  }, [note.id, db])

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try { await action() } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function upload(selected: File[]) {
    if (!db || !selected.length) return
    await run(async () => {
      if (selected.some(f => f.size > MAX_FILE_BYTES)) throw new Error('单个附件上限25 MB，存储还受设备剩余空间限制；本次尚未上传')
      // Persist the complete current draft first, including existing unsaved edits.
      const saved = await db.saveNote(draft())
      setSavedNote(saved)
      let completed = 0
      try {
        for (const file of selected) {
          setStatus(`正在保存附件 ${completed + 1}/${selected.length}：${file.name}`)
          await onFileUpload(file, saved.id!)
          completed++
          setFiles(await db.getFiles(saved.id!))
        }
        setStatus(`已保存 ${completed} 个附件，笔记正文也已保存`)
      } catch (e) {
        setFiles(await db.getFiles(saved.id!))
        setStatus(`已保存 ${completed}/${selected.length} 个附件；已保存的正文及附件不会丢失`)
        throw e
      }
    })
  }
  return <div style={{ background: 'white', borderRadius: 8, padding: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <button className="btn" disabled={busy} onClick={onBack}>← 返回</button>
      <div>
        <button className="btn btn-primary" disabled={busy || !db} onClick={() => run(async () => { await onSave(draft()) })}>保存</button>
        {savedNote.id && <button className="btn btn-danger" disabled={busy} onClick={() => run(async () => { await onDelete(savedNote.id!) })}>删除</button>}
      </div>
    </div>
    {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
    {status && <p role="status">{status}</p>}
    <input disabled={busy} value={title} onChange={e => setTitle(e.target.value)} placeholder="笔记标题" style={{ width: '100%', padding: 12, fontSize: 18, marginBottom: 12 }} />
    <select disabled={busy} value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 12 }}>
      <option value="">选择分类</option>
      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
    </select>
    <textarea disabled={busy} className="editor" value={content} onChange={e => setContent(e.target.value)} placeholder="输入笔记内容...支持Markdown" style={{ marginBottom: 16 }} />
    <label className="file-upload">添加附件（PDF/图片/文本等）
      <input aria-label="添加附件" type="file" multiple disabled={busy || !db} onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void upload(selected) }} style={{ display: 'none' }} />
    </label>
    <p>单个附件最多25 MB；数据只保存在本机，容量取决于剩余存储空间。上传时自动保存正文。</p>
    {files.length > 0 && <section><h3>附件 ({files.length})</h3>
      {files.map(file => <div key={file.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0', overflowWrap: 'anywhere' }}>
        <strong>{file.name}</strong> ({(file.data.size / 1024 / 1024).toFixed(2)} MB)
        <div>
          <button className="btn" disabled={busy} onClick={() => setPreview(preview === file.id ? null : file.id!)}>预览</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => { await exportFile(file.data, file.name, true); setStatus('已请求打开附件，请在系统中选择阅读器。') })}>其他应用打开</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => { await exportFile(file.data, file.name); setStatus('已完成导出操作；请在目标应用中确认保存。取消分享不会删除附件。') })}>导出/分享</button>
          <button className="btn btn-danger" disabled={busy} onClick={() => run(async () => {
            if (db && confirm('确定要删除这个文件吗？')) { await db.deleteFile(file.id!); setFiles(await db.getFiles(savedNote.id!)) }
          })}>删除附件</button>
        </div>
        {preview === file.id && <Preview file={file} />}
      </div>)}
    </section>}
  </div>
}
