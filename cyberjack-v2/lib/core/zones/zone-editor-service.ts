/**
 * Сервис для управления активными зонами в графическом редакторе
 */

export interface Zone {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  anatomyId?: string
  anatomyName?: string
  mediaFileId?: string  // ID конкретного медиа файла
}

export interface ZoneEditorState {
  zones: Zone[]
  selectedZoneId: string | null
  isDragging: boolean
  isResizing: boolean
  dragStart: { x: number; y: number } | null
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null
}

export interface ZoneEditorConfig {
  imageWidth: number
  imageHeight: number
  minZoneSize: number
  maxZoneSize: number
}

export class ZoneEditorService {
  private state: ZoneEditorState
  private config: ZoneEditorConfig
  private onStateChange: (state: ZoneEditorState) => void

  constructor(
    initialZones: Zone[] = [],
    config: ZoneEditorConfig,
    onStateChange: (state: ZoneEditorState) => void
  ) {
    this.state = {
      zones: initialZones,
      selectedZoneId: null,
      isDragging: false,
      isResizing: false,
      dragStart: null,
      resizeHandle: null
    }
    this.config = config
    this.onStateChange = onStateChange
  }

  // Обновить зоны
  updateZones(zones: Zone[]) {
    this.state.zones = zones
    this.notifyStateChange()
  }

  // Добавить новую зону
  addZone(zone: Omit<Zone, 'id'>) {
    const newZone: Zone = {
      ...zone,
      id: `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    this.state.zones.push(newZone)
    this.state.selectedZoneId = newZone.id
    this.notifyStateChange()
    return newZone
  }

  // Удалить зону
  removeZone(zoneId: string) {
    this.state.zones = this.state.zones.filter(zone => zone.id !== zoneId)
    if (this.state.selectedZoneId === zoneId) {
      this.state.selectedZoneId = null
    }
    this.notifyStateChange()
  }

  // Обновить зону
  updateZone(zoneId: string, updates: Partial<Omit<Zone, 'id'>>) {
    const zoneIndex = this.state.zones.findIndex(zone => zone.id === zoneId)
    if (zoneIndex !== -1) {
      this.state.zones[zoneIndex] = { ...this.state.zones[zoneIndex], ...updates }
      this.notifyStateChange()
    }
  }

  // Выбрать зону
  selectZone(zoneId: string | null) {
    this.state.selectedZoneId = zoneId
    this.notifyStateChange()
  }

  // Начать перетаскивание
  startDrag(zoneId: string, startX: number, startY: number) {
    this.state.selectedZoneId = zoneId
    this.state.isDragging = true
    this.state.dragStart = { x: startX, y: startY }
    this.notifyStateChange()
  }

  // Обновить позицию при перетаскивании
  updateDrag(currentX: number, currentY: number) {
    if (!this.state.isDragging || !this.state.dragStart || !this.state.selectedZoneId) {
      return
    }

    const deltaX = currentX - this.state.dragStart.x
    const deltaY = currentY - this.state.dragStart.y

    this.updateZonePosition(this.state.selectedZoneId, deltaX, deltaY)
    this.state.dragStart = { x: currentX, y: currentY }
  }

  // Завершить перетаскивание
  endDrag() {
    this.state.isDragging = false
    this.state.dragStart = null
    this.notifyStateChange()
  }

  // Начать изменение размера
  startResize(zoneId: string, handle: 'nw' | 'ne' | 'sw' | 'se', startX: number, startY: number) {
    this.state.selectedZoneId = zoneId
    this.state.isResizing = true
    this.state.resizeHandle = handle
    this.state.dragStart = { x: startX, y: startY }
    this.notifyStateChange()
  }

  // Обновить размер при изменении
  updateResize(currentX: number, currentY: number) {
    if (!this.state.isResizing || !this.state.dragStart || !this.state.selectedZoneId || !this.state.resizeHandle) {
      return
    }

    const zone = this.state.zones.find(z => z.id === this.state.selectedZoneId)
    if (!zone) return

    const deltaX = currentX - this.state.dragStart.x
    const deltaY = currentY - this.state.dragStart.y

    let newX = zone.x
    let newY = zone.y
    let newWidth = zone.width
    let newHeight = zone.height

    switch (this.state.resizeHandle) {
      case 'nw':
        newX = Math.max(0, zone.x + deltaX)
        newY = Math.max(0, zone.y + deltaY)
        newWidth = Math.max(this.config.minZoneSize, zone.width - deltaX)
        newHeight = Math.max(this.config.minZoneSize, zone.height - deltaY)
        break
      case 'ne':
        newY = Math.max(0, zone.y + deltaY)
        newWidth = Math.max(this.config.minZoneSize, zone.width + deltaX)
        newHeight = Math.max(this.config.minZoneSize, zone.height - deltaY)
        break
      case 'sw':
        newX = Math.max(0, zone.x + deltaX)
        newWidth = Math.max(this.config.minZoneSize, zone.width - deltaX)
        newHeight = Math.max(this.config.minZoneSize, zone.height + deltaY)
        break
      case 'se':
        newWidth = Math.max(this.config.minZoneSize, zone.width + deltaX)
        newHeight = Math.max(this.config.minZoneSize, zone.height + deltaY)
        break
    }

    // Проверяем границы изображения
    newX = Math.min(newX, this.config.imageWidth - newWidth)
    newY = Math.min(newY, this.config.imageHeight - newHeight)
    newWidth = Math.min(newWidth, this.config.imageWidth - newX)
    newHeight = Math.min(newHeight, this.config.imageHeight - newY)

    this.updateZone(this.state.selectedZoneId, {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    })

    this.state.dragStart = { x: currentX, y: currentY }
  }

  // Завершить изменение размера
  endResize() {
    this.state.isResizing = false
    this.state.resizeHandle = null
    this.state.dragStart = null
    this.notifyStateChange()
  }

  // Создать зону по координатам
  createZoneFromCoordinates(x1: number, y1: number, x2: number, y2: number, name: string = 'Новая зона') {
    const x = Math.min(x1, x2)
    const y = Math.min(y1, y2)
    let width = Math.abs(x2 - x1)
    let height = Math.abs(y2 - y1)

    // Принудительно устанавливаем минимальные размеры
    if (width < this.config.minZoneSize) {
      width = this.config.minZoneSize
    }
    if (height < this.config.minZoneSize) {
      height = this.config.minZoneSize
    }

    return this.addZone({
      name,
      x: Math.max(0, Math.min(x, this.config.imageWidth - width)),
      y: Math.max(0, Math.min(y, this.config.imageHeight - height)),
      width: Math.min(width, this.config.imageWidth - x),
      height: Math.min(height, this.config.imageHeight - y)
    })
  }

  // Получить зону по ID
  getZone(zoneId: string): Zone | undefined {
    return this.state.zones.find(zone => zone.id === zoneId)
  }

  // Получить выбранную зону
  getSelectedZone(): Zone | undefined {
    if (!this.state.selectedZoneId) return undefined
    return this.getZone(this.state.selectedZoneId)
  }

  // Получить все зоны
  getAllZones(): Zone[] {
    return [...this.state.zones]
  }

  // Проверить, находится ли точка в зоне
  isPointInZone(x: number, y: number, zoneId: string): boolean {
    const zone = this.getZone(zoneId)
    if (!zone) return false

    return x >= zone.x && x <= zone.x + zone.width &&
           y >= zone.y && y <= zone.y + zone.height
  }

  // Получить зону по координатам точки
  getZoneAtPoint(x: number, y: number): Zone | undefined {
    return this.state.zones.find(zone => this.isPointInZone(x, y, zone.id))
  }

  // Проверить, является ли точка ручкой изменения размера
  getResizeHandle(x: number, y: number, zoneId: string): 'nw' | 'ne' | 'sw' | 'se' | null {
    const zone = this.getZone(zoneId)
    if (!zone) return null

    const handleSize = 8
    const tolerance = 4

    // Северо-запад
    if (Math.abs(x - zone.x) <= tolerance && Math.abs(y - zone.y) <= tolerance) {
      return 'nw'
    }
    // Северо-восток
    if (Math.abs(x - (zone.x + zone.width)) <= tolerance && Math.abs(y - zone.y) <= tolerance) {
      return 'ne'
    }
    // Юго-запад
    if (Math.abs(x - zone.x) <= tolerance && Math.abs(y - (zone.y + zone.height)) <= tolerance) {
      return 'sw'
    }
    // Юго-восток
    if (Math.abs(x - (zone.x + zone.width)) <= tolerance && Math.abs(y - (zone.y + zone.height)) <= tolerance) {
      return 'se'
    }

    return null
  }

  // Обновить позицию зоны
  private updateZonePosition(zoneId: string, deltaX: number, deltaY: number) {
    const zone = this.getZone(zoneId)
    if (!zone) return

    const newX = Math.max(0, Math.min(zone.x + deltaX, this.config.imageWidth - zone.width))
    const newY = Math.max(0, Math.min(zone.y + deltaY, this.config.imageHeight - zone.height))

    this.updateZone(zoneId, { x: newX, y: newY })
  }

  // Уведомить об изменении состояния
  private notifyStateChange() {
    this.onStateChange({ ...this.state })
  }

  // Получить текущее состояние
  getState(): ZoneEditorState {
    return { ...this.state }
  }
}
