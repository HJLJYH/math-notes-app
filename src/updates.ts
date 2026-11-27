import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

export const RELEASE_API = 'https://api.github.com/repos/HJLJYH/math-notes-app/releases/latest'
export const RELEASE_PAGE = 'https://github.com/HJLJYH/math-notes-app/releases/latest'
export interface Update { versionCode: number; version: string; url: string; sha256: string }
export function parseRelease(raw: any): Update {
  if (!raw || raw.draft || raw.prerelease || typeof raw.tag_name !== 'string' || !/^android-\d+$/.test(raw.tag_name) || !Array.isArray(raw.assets)) throw new Error('发布信息格式不受支持')
  const code = Number(raw.tag_name.slice(8))
  if (!Number.isSafeInteger(code) || code < 1) throw new Error('发布版本号无效')
  const asset = raw.assets.find((a: any) => a?.name === 'math-notes.apk')
  const url = asset?.browser_download_url
  const expected = `https://github.com/HJLJYH/math-notes-app/releases/download/${raw.tag_name}/math-notes.apk`
  if (url !== expected) throw new Error('更新地址不是本项目的可信发布地址')
  const digest = asset?.digest
  if (typeof digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('发布缺少GitHub SHA-256摘要，请稍后重试')
  return { versionCode: Number(raw.tag_name.slice(8)), version: raw.name || raw.tag_name, url, sha256: digest.slice(7) }
}
export async function checkUpdate(): Promise<{ current: number; update: Update }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    // Only metadata is fetched, never code; offline the bundled app remains usable.
    const response = await fetch(RELEASE_API, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error(`检查失败 (${response.status})，请联网后重试`)
    const update = parseRelease(await response.json())
    const info = Capacitor.isNativePlatform() ? await App.getInfo() : { build: '0' }
    return { current: Number(info.build), update }
  } finally { clearTimeout(timeout) }
}
export async function openUpdate(update: Update) {
  // Revalidate even if called with stale/untrusted UI state.
  if (update.url !== `https://github.com/HJLJYH/math-notes-app/releases/download/android-${update.versionCode}/math-notes.apk`) throw new Error('更新链接无效')
  await Browser.open({ url: update.url })
}
