import React, { useState, useEffect } from 'react'
import { Database, Note, FileRecord } from '../database'

interface NoteEditorProps {
  note: Note | any
  categories: string[]
  onSave: (note: Note) => void
  onDelete: (id: number) => void
  onFileUpload: (file: File, noteId: number) => void
  db: Database | null
  onBack: () => void
}

const NoteEditor: React.FC<NoteEditorProps> = ({ 
  note, 
  categories, 
  onSave, 
  onDelete, 
  onFileUpload,
  db, 
  onBack 
}) => {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [category, setCategory] = useState(note.category || categories[0])
  const [files, setFiles] = useState<FileRecord[]>([])

  useEffect(() => {
    const loadFiles = async () => {
      if (note.id && db) {
        const fileRecords = await db.getFiles(note.id)
        setFiles(fileRecords)
      }
    }
    loadFiles()
  }, [note.id, db])

  const handleSave = () => {
    if (db) {
      onSave({
        ...note,
        title,
        content,
        category: category || note.category || categories[0]
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && note.id && db) {
      Array.from(files).forEach(file => {
        onFileUpload(file, note.id)
      })
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    if (db && confirm('确定要删除这个文件吗？')) {
      await db.deleteFile(fileId)
      const updatedFiles = files.filter(f => f.id !== fileId)
      setFiles(updatedFiles)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn" onClick={onBack}>← 返回</button>
        <div>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
          {note.id && (
            <button className="btn btn-danger" style={{ marginLeft: '8px' }} onClick={() => onDelete(note.id)}>删除</button>
          )}
        </div>
      </div>

      <input 
        type="text" 
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="笔记标题"
        style={{ 
          width: '100%', 
          padding: '12px', 
          fontSize: '18px', 
          fontWeight: 'bold',
          border: '1px solid #ddd',
          borderRadius: '6px',
          marginBottom: '12px'
        }}
      />

      <select 
        value={category}
        onChange={e => setCategory(e.target.value)}
        style={{ 
          width: '100%', 
          padding: '10px', 
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          fontSize: '14px'
        }}
      >
        <option value="">选择分类</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <textarea 
        className="editor"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="输入笔记内容...支持Markdown"
        style={{ marginBottom: '16px' }}
      />

      <div style={{ marginBottom: '16px' }}>
        <label className="file-upload">
          上传文件（PDF/图片/文本）
          <input 
            type="file" 
            multiple 
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.mp4,.mp3"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '12px' }}>附件 ({files.length})</h3>
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id}>
                  <td>{file.name}</td>
                  <td>{(file.data.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td>
                    <a href={URL.createObjectURL(file.data)} target="_blank" download={file.name}>
                      下载
                    </a>
                    <button 
                      className="btn btn-danger" 
                      style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => handleDeleteFile(file.id!)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default NoteEditor
