import { Capacitor, registerPlugin } from '@capacitor/core'
const Attachment = registerPlugin<{ open(options: { uri: string; mime: string }): Promise<void> }>('Attachment')
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Base64 transfer across the native bridge consumes additional memory.
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('无法读取文件'))
    reader.readAsDataURL(blob)
  })
}
export async function exportFile(blob: Blob, name: string, open = false): Promise<void> {
  if (blob.size > MAX_FILE_BYTES) throw new Error('单次导出上限为25 MB，请分批备份或使用较小附件')
  if (Capacitor.isNativePlatform()) {
    const safeName = name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-120) || 'attachment'
    const path = `exports/${Date.now()}-${safeName}`
    const data = (await readDataUrl(blob)).split(',')[1]
    const result = await Filesystem.writeFile({ path, directory: Directory.Cache, data, recursive: true })
    // Capacitor Share uses Android FileProvider and temporary read grants.
    // Keep cache file until the recipient has consumed it, not immediate deletion.
    if (open) {
      const mime = /\.pdf$/i.test(name) ? 'application/pdf' : blob.type || 'application/octet-stream'
      await Attachment.open({ uri: result.uri, mime })
    } else {
      await Share.share({ title: name, files: [result.uri], dialogTitle: '保存到文件或分享附件' })
    }
  } else {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export async function clearExportCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  // Only previous sessions' export copies; never touches IndexedDB attachments.
  await Filesystem.rmdir({ path: 'exports', directory: Directory.Cache, recursive: true }).catch(() => {})
}
