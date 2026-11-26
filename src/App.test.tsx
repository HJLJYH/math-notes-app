import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import NoteList from './components/NoteList'
import NoteEditor from './components/NoteEditor'
import { Database } from './database'

afterEach(() => cleanup())

describe('first-launch note creation', () => {
  it('keeps the create button visible but disabled while loading', () => {
    render(<NoteList db={null} category="全部" categories={['分析']} onSelect={vi.fn()} />)
    expect((screen.getByRole('button', { name: '+ 新建笔记' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('加载中...')).toBeTruthy()
  })

  it('defaults an existing blank category to a legal category', async () => {
    const onSave = vi.fn()
    render(<NoteEditor
      note={{ title: '旧笔记', content: '', category: '', created: 1, updated: 1 }}
      categories={['分析', '代数']}
      db={await Database.getInstance()}
      onSave={onSave} onDelete={vi.fn()} onFileUpload={vi.fn()} onBack={vi.fn()}
    />)
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('分析')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category: '分析' }))
  })

  it('creates, refreshes, reopens persisted storage, edits and saves in an empty category', async () => {
    const first = render(<App />)
    await screen.findByText('暂无笔记，点击"新建笔记"开始')
    fireEvent.click(screen.getByRole('button', { name: '+ 新建笔记' }))
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('分析')
    fireEvent.change(screen.getByPlaceholderText('笔记标题'), { target: { value: '首次笔记' } })
    fireEvent.change(screen.getByPlaceholderText('输入笔记内容...支持Markdown'), { target: { value: '持久化内容' } })
    // Clearing the selection must still save with a valid default category.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByRole('heading', { name: '首次笔记' })
    const db = await Database.getInstance()
    const [saved] = await db.getNotes('分析')
    expect(saved).toMatchObject({ title: '首次笔记', content: '持久化内容', category: '分析' })
    expect(saved.id).toBeTypeOf('number')
    first.unmount()

    // Close the actual IDB connection and reset only the in-memory singleton.
    // The next App mount opens the same persisted database, without deleting it.
    ;(db as any).db.close()
    ;(Database as any).instance = null
    render(<App />)
    await screen.findByRole('heading', { name: '首次笔记' })
    fireEvent.click(screen.getByRole('heading', { name: '首次笔记' }))
    expect((screen.getByPlaceholderText('输入笔记内容...支持Markdown') as HTMLTextAreaElement).value).toBe('持久化内容')
    fireEvent.change(screen.getByPlaceholderText('笔记标题'), { target: { value: '编辑后笔记' } })
    fireEvent.change(screen.getByPlaceholderText('输入笔记内容...支持Markdown'), { target: { value: '编辑后内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByRole('heading', { name: '编辑后笔记' })
    const reopened = await Database.getInstance()
    expect(await reopened.getNote(saved.id!)).toMatchObject({ title: '编辑后笔记', content: '编辑后内容', category: '分析' })
    expect(await reopened.getNotes()).toHaveLength(1)

    fireEvent.click(screen.getByText('代数', { exact: true }))
    await screen.findByText('暂无笔记，点击"新建笔记"开始')
    fireEvent.click(screen.getByRole('button', { name: '+ 新建笔记' }))
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('代数')
    fireEvent.change(screen.getByPlaceholderText('笔记标题'), { target: { value: '代数笔记' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByRole('heading', { name: '代数笔记' })
    expect(screen.queryByRole('heading', { name: '编辑后笔记' })).toBeNull()
    await waitFor(async () => expect(await reopened.getNotes('代数')).toHaveLength(1))
  })
})
