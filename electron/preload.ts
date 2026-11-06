import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, Config, FishStatus } from '../src/lib/types'

// 安全桥: 渲染层只能通过 window.money 访问受控 API。
const api = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke('money:getSnapshot'),
  getConfig: (): Promise<Config> => ipcRenderer.invoke('money:getConfig'),
  setConfig: (patch: Partial<Config>): Promise<Config> =>
    ipcRenderer.invoke('money:setConfig', patch),
  setWorkMode: (on: boolean): Promise<void> =>
    ipcRenderer.invoke('money:setWorkMode', on),
  setOverlayMode: (mode: 'floating' | 'fullscreen'): Promise<void> =>
    ipcRenderer.invoke('money:setOverlayMode', mode),
  quit: () => ipcRenderer.send('money:quit'),

  onSnapshot: (cb: (s: AppSnapshot) => void) => {
    const h = (_e: unknown, s: AppSnapshot) => cb(s)
    ipcRenderer.on('money:snapshot', h)
    return () => ipcRenderer.off('money:snapshot', h)
  },
  onFishCaught: (cb: (p: { status: FishStatus; roast: string }) => void) => {
    const h = (_e: unknown, p: { status: FishStatus; roast: string }) => cb(p)
    ipcRenderer.on('money:fish', h)
    return () => ipcRenderer.off('money:fish', h)
  },
  onAchievement: (cb: (id: string) => void) => {
    const h = (_e: unknown, id: string) => cb(id)
    ipcRenderer.on('money:achievement', h)
    return () => ipcRenderer.off('money:achievement', h)
  },
}

contextBridge.exposeInMainWorld('money', api)
