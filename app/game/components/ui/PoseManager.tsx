"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pose, PoseAngle, ActiveZone } from "@/lib/unified-entities"
import { Plus, Edit, Trash2, Eye, Upload, Settings } from "lucide-react"

interface PoseManagerProps {
  poses: { [key: string]: Pose }
  onUpdatePoses: (poses: { [key: string]: Pose }) => void
}

export const PoseManager: React.FC<PoseManagerProps> = ({
  poses,
  onUpdatePoses
}) => {
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null)
  const [editingPose, setEditingPose] = useState<Pose | null>(null)
  const [editingAngle, setEditingAngle] = useState<PoseAngle | null>(null)
  const [editingZone, setEditingZone] = useState<ActiveZone | null>(null)
  const [editingZones, setEditingZones] = useState<ActiveZone[] | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const handleCreatePose = () => {
    const newPose: Pose = {
      id: `pose_${Date.now()}`,
      name: 'Новая поза',
      description: 'Описание позы',
      category: 'standing',
      key: 'standing',
      angles: [],
      requirements: {},
      effects: {}
    }
    setEditingPose(newPose)
    setIsCreateDialogOpen(true)
  }

  const handleSavePose = (pose: Pose) => {
    const updatedPoses = { ...poses, [pose.id]: pose }
    onUpdatePoses(updatedPoses)
    setEditingPose(null)
    setIsCreateDialogOpen(false)
    // Обновляем локальное состояние для немедленного отображения
    if (selectedPose?.id === pose.id) {
      setSelectedPose(pose)
    }
  }

  const handleDeletePose = (poseId: string) => {
    const updatedPoses = { ...poses }
    delete updatedPoses[poseId]
    onUpdatePoses(updatedPoses)
    if (selectedPose?.id === poseId) {
      setSelectedPose(null)
    }
  }

  const handleCreateAngle = () => {
    if (!selectedPose) return

    const newAngle: PoseAngle = {
      id: `angle_${Date.now()}`,
      name: 'Новый ракурс',
      description: 'Описание ракурса',
      mediaUrl: '',
      mediaType: 'image',
      activeZones: []
    }

    const updatedPose = {
      ...selectedPose,
      angles: [...selectedPose.angles, newAngle]
    }
    handleSavePose(updatedPose)
    // Не устанавливаем editingAngle, чтобы диалог не открывался автоматически
  }

  const handleEditAngle = (angle: PoseAngle) => {
    setEditingAngle(angle)
  }

  const handleEditZones = (angle: PoseAngle) => {
    setEditingZones(angle.activeZones || [])
    setEditingAngle(angle)
  }

  const handleCreateAndEditAngle = () => {
    if (!selectedPose) return

    const newAngle: PoseAngle = {
      id: `angle_${Date.now()}`,
      name: 'Новый ракурс',
      description: 'Описание ракурса',
      mediaUrl: '',
      mediaType: 'image',
      activeZones: []
    }

    const updatedPose = {
      ...selectedPose,
      angles: [...selectedPose.angles, newAngle]
    }
    handleSavePose(updatedPose)
    setEditingAngle(newAngle)
  }

  const handleCreateZone = () => {
    if (!editingAngle) return

    const newZone: ActiveZone = {
      id: `zone_${Date.now()}`,
      name: 'Новая зона',
      description: 'Описание зоны',
      x: 50,
      y: 50,
      width: 20,
      height: 20,
      availableActions: [],
      availableTools: [],
      sensitivity: 5,
      category: 'touch'
    }

    setEditingZone(newZone)
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Управление позами</h2>
          <p className="text-muted-foreground">Настройка поз, ракурсов и активных зон для персонажей</p>
        </div>
        <Button onClick={handleCreatePose}>
          <Plus className="h-4 w-4 mr-2" />
          Создать позу
        </Button>
      </div>

      {/* Список поз */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(poses).map((pose) => (
          <Card key={pose.id} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{pose.name}</CardTitle>
                  <CardDescription>{pose.description}</CardDescription>
                </div>
                <Badge variant="outline">{pose.angles.length} ракурсов</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Ракурсов: {pose.angles.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedPose?.id === pose.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPose(pose)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Просмотр
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPose(pose)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePose(pose.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Детальный просмотр позы */}
      {selectedPose && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedPose.name}</CardTitle>
                <CardDescription>{selectedPose.description}</CardDescription>
              </div>
              <Button onClick={handleCreateAndEditAngle}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить ракурс
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="angles">Ракурсы</TabsTrigger>
                <TabsTrigger value="requirements">Требования</TabsTrigger>
                <TabsTrigger value="effects">Эффекты</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ключ позы</Label>
                    <Input value={selectedPose.key} readOnly />
                  </div>
                  <div>
                    <Label>Категория</Label>
                    <Input value={selectedPose.category} readOnly />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="angles" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPose.angles.map((angle) => (
                    <Card key={angle.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{angle.name}</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditZones(angle)}
                              title="Редактировать зоны"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAngle(angle)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription>{angle.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm">
                            Тип медиа: <Badge variant="outline">{angle.mediaType}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Активных зон: {angle.activeZones.length}
                          </div>
                          {angle.thumbnailUrl && (
                            <div className="mt-2">
                              <img
                                src={angle.thumbnailUrl}
                                alt={angle.name}
                                className="w-full h-32 object-cover rounded"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="requirements" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Гибкость (мин)</Label>
                    <Input
                      type="number"
                      value={selectedPose.requirements?.flexibility || 0}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label>Сила (мин)</Label>
                    <Input
                      type="number"
                      value={selectedPose.requirements?.strength || 0}
                      readOnly
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="effects" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Физические эффекты</Label>
                    <Textarea
                      value={JSON.stringify(selectedPose.effects?.physical || {}, null, 2)}
                      readOnly
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>Эмоциональные эффекты</Label>
                    <Textarea
                      value={JSON.stringify(selectedPose.effects?.emotional || {}, null, 2)}
                      readOnly
                      rows={4}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Диалог редактирования позы */}
      {editingPose && (
        <PoseEditDialog
          pose={editingPose}
          onSave={handleSavePose}
          onCancel={() => setEditingPose(null)}
          open={!!editingPose}
        />
      )}

      {/* Диалог редактирования ракурса */}
      {editingAngle && (
        <AngleEditDialog
          angle={editingAngle}
          onSave={(updatedAngle) => {
            if (!selectedPose) return
            const angleIndex = selectedPose.angles.findIndex(a => a.id === updatedAngle.id)
            const updatedAngles = [...selectedPose.angles]

            if (angleIndex >= 0) {
              // Обновляем существующий ракурс
              updatedAngles[angleIndex] = updatedAngle
            } else {
              // Добавляем новый ракурс
              updatedAngles.push(updatedAngle)
            }

            const updatedPose = {
              ...selectedPose,
              angles: updatedAngles
            }
            handleSavePose(updatedPose)
            setSelectedPose(updatedPose) // Обновляем локальное состояние
            setEditingAngle(null)
          }}
          onCancel={() => setEditingAngle(null)}
          open={!!editingAngle}
          onEditZones={handleEditZones}
        />
      )}

      {/* Визуальный редактор зон */}
      {editingZones !== null && editingAngle && (
        <ZoneEditor
          angle={editingAngle}
          onSave={(zones) => {
            if (!selectedPose) return
            const updatedAngle = {
              ...editingAngle,
              activeZones: zones
            }
            const updatedPose = {
              ...selectedPose,
              angles: selectedPose.angles.map(a =>
                a.id === updatedAngle.id ? updatedAngle : a
              )
            }
            handleSavePose(updatedPose)
            setSelectedPose(updatedPose) // Обновляем локальное состояние
            setEditingZones(null)
            setEditingAngle(null)
          }}
          onCancel={() => {
            setEditingZones(null)
            setEditingAngle(null)
          }}
          open={editingZones !== null}
        />
      )}

      {/* Диалог редактирования зоны */}
      {editingZone && (
        <ZoneEditDialog
          zone={editingZone}
          onSave={(updatedZone) => {
            if (!editingAngle) return
            const existingZoneIndex = editingAngle.activeZones.findIndex(z => z.id === updatedZone.id)
            const updatedZones = [...editingAngle.activeZones]

            if (existingZoneIndex >= 0) {
              // Обновляем существующую зону
              updatedZones[existingZoneIndex] = updatedZone
            } else {
              // Добавляем новую зону
              updatedZones.push(updatedZone)
            }

            const updatedAngle = {
              ...editingAngle,
              activeZones: updatedZones
            }
            setEditedAngle(updatedAngle)
            setEditingZone(null)
          }}
          onCancel={() => setEditingZone(null)}
          open={!!editingZone}
        />
      )}
    </div>
  )
}

// Компонент для редактирования позы
interface PoseEditDialogProps {
  pose: Pose
  onSave: (pose: Pose) => void
  onCancel: () => void
  open: boolean
}

const PoseEditDialog: React.FC<PoseEditDialogProps> = ({
  pose,
  onSave,
  onCancel,
  open
}) => {
  const [editedPose, setEditedPose] = useState<Pose>(pose)

  useEffect(() => {
    setEditedPose(pose)
  }, [pose])

  const handleSave = () => {
    onSave(editedPose)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактирование позы</DialogTitle>
          <DialogDescription>
            Настройте параметры позы
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pose-name">Название</Label>
              <Input
                id="pose-name"
                value={editedPose.name}
                onChange={(e) => setEditedPose({...editedPose, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="pose-key">Ключ</Label>
              <Input
                id="pose-key"
                value={editedPose.key}
                onChange={(e) => setEditedPose({...editedPose, key: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pose-description">Описание</Label>
            <Textarea
              id="pose-description"
              value={editedPose.description}
              onChange={(e) => setEditedPose({...editedPose, description: e.target.value})}
              rows={3}
            />
          </div>

          {/* Категория скрыта - используется только для внутренней организации */}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Компонент для редактирования ракурса
interface AngleEditDialogProps {
  angle: PoseAngle
  onSave: (angle: PoseAngle) => void
  onCancel: () => void
  open: boolean
  onEditZones?: (angle: PoseAngle) => void
}

const AngleEditDialog: React.FC<AngleEditDialogProps> = ({
  angle,
  onSave,
  onCancel,
  open,
  onEditZones
}) => {
  const [editedAngle, setEditedAngle] = useState<PoseAngle>(angle)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    setEditedAngle(angle)
    setSelectedFile(null)
  }, [angle])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Создаем URL для предварительного просмотра
      const fileUrl = URL.createObjectURL(file)
      setEditedAngle({...editedAngle, mediaUrl: fileUrl})
    }
  }

  const handleSave = () => {
    // Если файл был выбран, сохраняем его как blob URL
    if (selectedFile) {
      const fileUrl = URL.createObjectURL(selectedFile)
      const updatedAngle = {...editedAngle, mediaUrl: fileUrl}
      onSave(updatedAngle)
    } else {
      onSave(editedAngle)
    }
    setSelectedFile(null)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактирование ракурса</DialogTitle>
          <DialogDescription>
            Настройте параметры ракурса
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="angle-name">Название</Label>
              <Input
                id="angle-name"
                value={editedAngle.name}
                onChange={(e) => setEditedAngle({...editedAngle, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="angle-type">Тип медиа</Label>
              <Select
                value={editedAngle.mediaType}
                onValueChange={(value: 'image' | 'video' | 'gif') =>
                  setEditedAngle({...editedAngle, mediaType: value})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Изображение</SelectItem>
                  <SelectItem value="video">Видео</SelectItem>
                  <SelectItem value="gif">GIF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="angle-description">Описание</Label>
            <Textarea
              id="angle-description"
              value={editedAngle.description}
              onChange={(e) => setEditedAngle({...editedAngle, description: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="angle-media">Медиа файл</Label>
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <div className="text-sm text-muted-foreground">
                Или введите URL:
              </div>
              <Input
                id="angle-media"
                value={editedAngle.mediaUrl.startsWith('blob:') ? '' : editedAngle.mediaUrl}
                onChange={(e) => setEditedAngle({...editedAngle, mediaUrl: e.target.value})}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Предварительный просмотр */}
          {editedAngle.mediaUrl && (
            <div>
              <Label>Предварительный просмотр</Label>
              <div className="mt-2 border rounded-lg p-2 bg-muted/20 relative">
                <div className="relative w-full h-32 overflow-hidden rounded">
                  {editedAngle.mediaType === 'video' ? (
                    <video
                      src={editedAngle.mediaUrl}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={editedAngle.mediaUrl}
                      alt={editedAngle.name}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Визуализация активных зон */}
                  {editedAngle.activeZones.map((zone) => (
                    <div
                      key={zone.id}
                      className="absolute border-2 border-cyan-400 bg-cyan-400/20 cursor-pointer hover:bg-cyan-400/40 transition-all"
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                      }}
                      title={`${zone.name} (${zone.category})`}
                    >
                      <div className="absolute -top-6 left-0 bg-black/70 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap">
                        {zone.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Активные зоны */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Активные зоны</Label>
              <div className="flex gap-2">
                              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditZones?.(editedAngle)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Визуальный редактор
              </Button>
                <Badge variant="outline" className="text-xs">
                  {editedAngle.activeZones.length} зон
                </Badge>
              </div>
            </div>

            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {editedAngle.activeZones.length > 0 ? (
                editedAngle.activeZones.map((zone) => (
                  <div key={zone.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium text-sm">{zone.promptName || zone.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Ключ: {zone.zoneKey} • {zone.category}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {zone.sensitivity}/10
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">
                  Нет активных зон. Нажмите "Визуальный редактор" для создания.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Компонент визуального редактора зон
interface ZoneEditorProps {
  angle: PoseAngle
  onSave: (zones: ActiveZone[]) => void
  onCancel: () => void
  open: boolean
}

const ZoneEditor: React.FC<ZoneEditorProps> = ({
  angle,
  onSave,
  onCancel,
  open
}) => {
  const [zones, setZones] = useState<ActiveZone[]>(angle.activeZones || [])
  const [selectedZone, setSelectedZone] = useState<ActiveZone | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null)

  const imageRef = useRef<HTMLImageElement>(null)

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!isCreating || !imageRef.current) return

    const rect = imageRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    const newZone: ActiveZone = {
      id: `zone_${Date.now()}`,
      name: 'Новая зона',
      description: 'Описание зоны',
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      width: 20,
      height: 20,
      availableActions: [],
      availableTools: [],
      sensitivity: 5,
      category: 'touch',
      zoneKey: `zone_${Date.now()}`, // Ключ для системы взаимодействий
      promptName: 'зона' // Название для промптов
    }

    setZones([...zones, newZone])
    setSelectedZone(newZone)
    setIsCreating(false)
  }

  const handleZoneClick = (zone: ActiveZone, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedZone(zone)
  }

  const updateZone = (updatedZone: ActiveZone) => {
    setZones(zones.map(z => z.id === updatedZone.id ? updatedZone : z))
    setSelectedZone(updatedZone)
  }

  const deleteZone = (zoneId: string) => {
    setZones(zones.filter(z => z.id !== zoneId))
    if (selectedZone?.id === zoneId) {
      setSelectedZone(null)
    }
  }

  const handleSave = () => {
    onSave(zones)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Визуальный редактор активных зон</DialogTitle>
          <DialogDescription>
            Кликните "Создать зону" и затем кликните на изображении, чтобы создать активную зону
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 h-[600px]">
          {/* Левая панель - изображение с зонами */}
          <div className="flex-1 flex flex-col">
            <div className="flex gap-2 mb-4">
              <Button
                variant={isCreating ? "default" : "outline"}
                onClick={() => setIsCreating(!isCreating)}
              >
                {isCreating ? "Отмена создания" : "Создать зону"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedZone(null)}>
                Снять выделение
              </Button>
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden relative bg-muted/20">
              {angle.mediaUrl ? (
                <>
                  <img
                    ref={imageRef}
                    src={angle.mediaUrl}
                    alt={angle.name}
                    className="w-full h-full object-contain cursor-crosshair"
                    onClick={handleImageClick}
                  />

                  {/* Активные зоны */}
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`absolute border-2 cursor-pointer transition-all ${
                        selectedZone?.id === zone.id
                          ? 'border-primary bg-primary/20 scale-105'
                          : 'border-cyan-400 bg-cyan-400/20 hover:bg-cyan-400/30'
                      }`}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                      }}
                      onClick={(e) => handleZoneClick(zone, e)}
                      title={`${zone.name} (${zone.zoneKey})`}
                    >
                      <div className="absolute -top-8 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {zone.promptName || zone.name}
                      </div>
                      {selectedZone?.id === zone.id && (
                        <div className="absolute -bottom-8 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          Ключ: {zone.zoneKey}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="text-4xl mb-2">📷</div>
                    <p>Изображение не загружено</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Правая панель - настройки выбранной зоны */}
          <div className="w-80 border rounded-lg p-4 overflow-y-auto">
            {selectedZone ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Настройки зоны</h3>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteZone(selectedZone.id)}
                  >
                    Удалить
                  </Button>
                </div>

                <div>
                  <Label htmlFor="zone-name">Название для промптов</Label>
                  <Input
                    id="zone-name"
                    value={selectedZone.promptName || selectedZone.name}
                    onChange={(e) => updateZone({...selectedZone, promptName: e.target.value})}
                    placeholder="например: 'шея', 'грудь', 'бедро'"
                  />
                </div>

                <div>
                  <Label htmlFor="zone-key">Ключ зоны</Label>
                  <Input
                    id="zone-key"
                    value={selectedZone.zoneKey || selectedZone.id}
                    onChange={(e) => updateZone({...selectedZone, zoneKey: e.target.value})}
                    placeholder="например: 'neck', 'chest', 'thigh'"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ключ используется системой взаимодействий
                  </p>
                </div>

                <div>
                  <Label htmlFor="zone-description">Описание</Label>
                  <Textarea
                    id="zone-description"
                    value={selectedZone.description}
                    onChange={(e) => updateZone({...selectedZone, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="zone-category">Категория</Label>
                  <Select
                    value={selectedZone.category}
                    onValueChange={(value: ActiveZone['category']) =>
                      updateZone({...selectedZone, category: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="touch">Прикосновение</SelectItem>
                      <SelectItem value="pressure">Давление</SelectItem>
                      <SelectItem value="temperature">Температура</SelectItem>
                      <SelectItem value="electrical">Электричество</SelectItem>
                      <SelectItem value="visual">Визуальный</SelectItem>
                      <SelectItem value="auditory">Аудио</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Позиция X (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(selectedZone.x)}
                      onChange={(e) => updateZone({...selectedZone, x: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Позиция Y (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(selectedZone.y)}
                      onChange={(e) => updateZone({...selectedZone, y: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Ширина (%)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={Math.round(selectedZone.width)}
                      onChange={(e) => updateZone({...selectedZone, width: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Высота (%)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={Math.round(selectedZone.height)}
                      onChange={(e) => updateZone({...selectedZone, height: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Чувствительность (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={selectedZone.sensitivity}
                    onChange={(e) => updateZone({...selectedZone, sensitivity: Number(e.target.value)})}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">👆</div>
                <p>Выберите зону для редактирования</p>
                <p className="text-sm mt-2">Или создайте новую зону</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleSave}>
            Сохранить зоны
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Компонент для редактирования активной зоны
interface ZoneEditDialogProps {
  zone: ActiveZone
  onSave: (zone: ActiveZone) => void
  onCancel: () => void
  open: boolean
}

const ZoneEditDialog: React.FC<ZoneEditDialogProps> = ({
  zone,
  onSave,
  onCancel,
  open
}) => {
  const [editedZone, setEditedZone] = useState<ActiveZone>(zone)

  useEffect(() => {
    setEditedZone(zone)
  }, [zone])

  const handleSave = () => {
    onSave(editedZone)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактирование активной зоны</DialogTitle>
          <DialogDescription>
            Настройте параметры активной зоны
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zone-name">Название</Label>
              <Input
                id="zone-name"
                value={editedZone.name}
                onChange={(e) => setEditedZone({...editedZone, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="zone-category">Категория</Label>
              <Select
                value={editedZone.category}
                onValueChange={(value: ActiveZone['category']) =>
                  setEditedZone({...editedZone, category: value})
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="touch">Прикосновение</SelectItem>
                  <SelectItem value="pressure">Давление</SelectItem>
                  <SelectItem value="temperature">Температура</SelectItem>
                  <SelectItem value="electrical">Электричество</SelectItem>
                  <SelectItem value="visual">Визуальный</SelectItem>
                  <SelectItem value="auditory">Аудио</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="zone-description">Описание</Label>
            <Textarea
              id="zone-description"
              value={editedZone.description}
              onChange={(e) => setEditedZone({...editedZone, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Позиция X (%)</Label>
              <Slider
                value={[editedZone.x]}
                onValueChange={([value]) => setEditedZone({...editedZone, x: value})}
                max={100}
                min={0}
                step={1}
              />
              <div className="text-center text-sm text-muted-foreground">{editedZone.x}%</div>
            </div>
            <div>
              <Label>Позиция Y (%)</Label>
              <Slider
                value={[editedZone.y]}
                onValueChange={([value]) => setEditedZone({...editedZone, y: value})}
                max={100}
                min={0}
                step={1}
              />
              <div className="text-center text-sm text-muted-foreground">{editedZone.y}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ширина (%)</Label>
              <Slider
                value={[editedZone.width]}
                onValueChange={([value]) => setEditedZone({...editedZone, width: value})}
                max={100}
                min={1}
                step={1}
              />
              <div className="text-center text-sm text-muted-foreground">{editedZone.width}%</div>
            </div>
            <div>
              <Label>Высота (%)</Label>
              <Slider
                value={[editedZone.height]}
                onValueChange={([value]) => setEditedZone({...editedZone, height: value})}
                max={100}
                min={1}
                step={1}
              />
              <div className="text-center text-sm text-muted-foreground">{editedZone.height}%</div>
            </div>
          </div>

          <div>
            <Label>Чувствительность (1-10)</Label>
            <Slider
              value={[editedZone.sensitivity]}
              onValueChange={([value]) => setEditedZone({...editedZone, sensitivity: value})}
              max={10}
              min={1}
              step={1}
            />
            <div className="text-center text-sm text-muted-foreground">{editedZone.sensitivity}/10</div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
