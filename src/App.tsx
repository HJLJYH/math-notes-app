import { useState, useEffect } from 'react'
import { Database } from './database'
import NoteEditor from './components/NoteEditor'
import NoteList from './components/NoteList'
import Categories from './components/Categories'

const CATEGORIES = [
  '分析',
  '代数', 
  '数学分析',
  '高等代数',
  '丘赛计算数学',
  '丘赛分析方向',
  '丘赛代数方向',
  'cmc数学b类',
  '博资考'
]

function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [category, setCategory] = useState<string>('全部')
  const [editingNote, setEditingNote] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const database = await Database.getInstance()
      setDb(database)
    }
    init()
  }, [])

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setEditingNote(null)
  }

  const handleNoteSelect = (note: any) => {
    setEditingNote(note)
  }

  const handleNoteSave = async (note: any) => {
    if (db) {
      await db.saveNote(note)
      setEditingNote(null)
    }
  }

  const handleNoteDelete = async (id: number) => {
    if (db && confirm('确定要删除这个笔记吗？')) {
      await db.deleteNote(id)
      setEditingNote(null)
    }
  }

  const handleFileUpload = async (file: File, noteId: number) => {
    if (db) {
      await db.saveFile(noteId, file)
    }
  }

  return (
    <div className="container">
      <header style={{ 
        background: '#4A90E2', 
        color: 'white', 
        padding: '16px', 
        marginBottom: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>数学笔记</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '14px' }}>
          支持PDF/图片/文本编辑 | 大存储
        </p>
      </header>

      {editingNote ? (
        <NoteEditor
          note={editingNote}
          categories={CATEGORIES}
          onSave={handleNoteSave}
          onDelete={handleNoteDelete}
          onFileUpload={handleFileUpload}
          db={db}
          onBack={() => setEditingNote(null)}
        />
      ) : (
        <>
          <Categories 
            categories={CATEGORIES}
            current={category}
            onChange={handleCategoryChange}
          />
          <NoteList 
            db={db}
            category={category}
            onSelect={handleNoteSelect}
          />
        </>
      )}
    </div>
  )
}

export default App
