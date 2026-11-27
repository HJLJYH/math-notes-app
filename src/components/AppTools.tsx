import { useState } from 'react'
import { Database } from '../database'
import { exportBackup, importBackup } from '../backup'
import { checkUpdate, openUpdate, Update } from '../updates'

export default function AppTools({ db, onRestore }: { db: Database | null; onRestore: () => void }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [update, setUpdate] = useState<Update | null>(null)
  async function run(action: () => Promise<void>) {
    setBusy(true); setStatus('')
    try { await action() } catch (e) { setStatus(e instanceof Error ? e.message : '操作失败，请重试') } finally { setBusy(false) }
  }
  return <section style={{ padding: 12, background: '#eef5ff', marginBottom: 16 }}>
    <button className="btn" disabled={busy} onClick={() => run(async () => {
      setUpdate(null)
      const result = await checkUpdate()
      if (result.update.versionCode > result.current) { setUpdate(result.update); setStatus(`发现新版：${result.update.version}`) }
      else setStatus('当前已是最新版本')
    })}>检查应用更新</button>
    <button className="btn" disabled={busy || !db} onClick={() => run(async () => { await exportBackup(db!); setStatus('备份已交给系统保存/分享，请在目标应用中确认保存。备份含私人笔记，请妥善保管。') })}>导出本地备份</button>
    <label className="file-upload">导入备份<input aria-label="导入备份" type="file" accept=".json,application/json" disabled={busy || !db} style={{ display: 'none' }} onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''
      if (file && confirm('将备份合并为新笔记，不覆盖已有数据。继续？')) void run(async () => { await importBackup(db!, file); onRestore(); setStatus('备份已合并，原有笔记保留。') })
    }} /></label>
    {busy && <p role="status">正在处理，请稍候…</p>}
    {status && <p role="status">{status}</p>}
    {update && <div style={{ overflowWrap: 'anywhere' }}>
      <p>这是APK升级，不是热更新。将打开GitHub HTTPS下载地址，下载后需由Android确认安装并校验签名。不会上传笔记或附件。</p>
      <p>重要：旧版若使用随机debug签名，可能提示“签名不匹配”。请勿卸载旧应用，以免丢失本机笔记；先备份。新签名正式版之间可覆盖升级。</p>
      <small>GitHub提供的APK SHA-256：{update.sha256}。本应用不直接下载或声称已验证浏览器下载文件；系统安装器负责验证APK签名。</small>
      <p><button className="btn btn-primary" disabled={busy} onClick={() => {
        if (confirm('已了解安装确认和旧版签名限制，打开GitHub下载APK？')) void run(async () => { await openUpdate(update); setStatus('请在系统下载完成后打开APK并确认安装。') })
      }}>确认并下载APK</button></p>
    </div>}
    <small>离线仍可使用全部本地笔记。完整备份附件总量限17 MB，大附件请单独导出。不要在未备份前卸载或清除应用数据。</small>
  </section>
}
