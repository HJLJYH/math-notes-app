import React, { useState, useEffect } from 'react'
import { Database, Note } from '../database'

interface NoteListProps {
  db: Database | null
  category: string
  categories: string[]
  onSelect: (note: Note) => void
}

const NoteList: React.FC<NoteListProps> = ({ db, category, categories, onSelect }) => {
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

  return (
    <div>
      <button 
        className="btn btn-primary"
        style={{ marginBottom: '16px', display: 'block', margin: '0 auto 16px' }}
        disabled={!db}
        onClick={() => onSelect({ title: '新笔记', content: '', category: categories.includes(category) ? category : categories[0], created: Date.now(), updated: Date.now() })}
      >
        + 新建笔记
      </button>

      {!db ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
      ) : notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无笔记，点击"新建笔记"开始
        </div>
      )}

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
