import React, { useState, useEffect } from 'react'
import { Database, Note } from '../database'

interface NoteListProps {
  db: Database | null
  category: string
  onSelect: (note: Note) => void
}

const NoteList: React.FC<NoteListProps> = ({ db, category, onSelect }) => {
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    const loadNotes = async () => {
      if (db) {
        const notes = await db.getNotes(category)
        setNotes(notes)
      }
    }
    loadNotes()
  }, [db, category])

  if (!db) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
  }

  if (notes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        暂无笔记，点击"新建笔记"开始
      </div>
    )
  }

  return (
    <div>
      <button 
        className="btn btn-primary"
        style={{ marginBottom: '16px', display: 'block', margin: '0 auto 16px' }}
        onClick={() => onSelect({ title: '新笔记', content: '', category: category === '全部' ? '' : category, id: undefined, created: Date.now(), updated: Date.now() })}
      >
        + 新建笔记
      </button>

      {notes.map(note => (
        <div key={note.id} className="note-card" onClick={() => onSelect(note)}>
          <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>{note.title || '无标题'}</h3>
          <p style={{ 
            fontSize: '13px', 
            color: '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '8px'
          }}>
            {note.content.substring(0, 100)}...
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
            <span>{note.category}</span>
            <span>{new Date(note.updated).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default NoteList
