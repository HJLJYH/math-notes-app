import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkUpdate, openUpdate, parseRelease } from './updates'
const mocks = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ build: '1001' }) } }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: mocks.open } }))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const release = () => ({ tag_name: 'android-1002', name: '测试版本', assets: [{ name: 'math-notes.apk', browser_download_url: 'https://github.com/HJLJYH/math-notes-app/releases/download/android-1002/math-notes.apk', digest: `sha256:${'a'.repeat(64)}` }] })
describe('APK update trust boundary', () => {
  it('accepts only release assets from the fixed repository with a valid GitHub SHA256', () => {
    expect(parseRelease(release())).toMatchObject({ versionCode: 1002, sha256: 'a'.repeat(64) })
    const raw = release(); raw.assets[0].browser_download_url = 'https://evil.example/app.apk'
    expect(() => parseRelease(raw)).toThrow('可信发布地址')
    raw.assets[0].browser_download_url = release().assets[0].browser_download_url
    raw.assets[0].digest = ''
    expect(() => parseRelease(raw)).toThrow('SHA-256')
    expect(() => parseRelease({ ...release(), prerelease: true })).toThrow()
  })
  it('compares the installed native build and never opens anything during check', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => release() }))
    const result = await checkUpdate()
    expect(result.current).toBe(1001)
    expect(result.update.versionCode).toBe(1002)
    expect(mocks.open).not.toHaveBeenCalled()
    await openUpdate(result.update)
    expect(mocks.open).toHaveBeenCalledWith({ url: result.update.url })
  })
  it('reports offline errors without modifying local storage or loading code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(checkUpdate()).rejects.toThrow('offline')
  })
  it('rejects tampered download links at confirmation time', async () => {
    await expect(openUpdate({ ...parseRelease(release()), url: 'http://evil.example' })).rejects.toThrow('无效')
  })
})
