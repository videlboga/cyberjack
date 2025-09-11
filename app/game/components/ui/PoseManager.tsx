"use client"

import React, { useState, useRef, useCallback } from 'react'
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
import { Plus, Edit, Trash2, Eye, Settings, Upload } from "lucide-react"
import systemConfig from '@/data/system-unified.json'

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
  const [editingZones, setEditingZones] = useState<ActiveZone[] | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<ActiveZone | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState<PoseAngle | null>(null)
  const [isEditingAngle, setIsEditingAngle] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageRef = useRef<HTMLImageElement>(null)

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
      angles: [...(Array.isArray(selectedPose.angles) ? selectedPose.angles : []), newAngle]
    }
    handleSavePose(updatedPose)
  }

  const handleEditZones = (angle: PoseAngle) => {
    setEditingZones(angle.activeZones || [])
    setEditingAngle(angle)
  }

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
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
      anatomyId: undefined,
      category: 'touch'
    }

    setEditingZones(prev => prev ? [...prev, newZone] : [newZone])
    setIsCreating(false)
  }, [isCreating])

  const handleSaveAngleZones = () => {
    if (!selectedPose || !editingAngle || !editingZones) return

    const updatedAngle = {
      ...editingAngle,
      activeZones: editingZones
    }

    const updatedPose = {
      ...selectedPose,
      angles: (Array.isArray(selectedPose.angles) ? selectedPose.angles : []).map(a =>
        a.id === updatedAngle.id ? updatedAngle : a
      )
    }

    handleSavePose(updatedPose)
    setEditingAngle(null)
    setEditingZones([])
    setSelectedZone(null)
  }

  const updateZone = (updatedZone: ActiveZone) => {
    setEditingZones(zones => zones ? zones.map(z => z.id === updatedZone.id ? updatedZone : z) : [])
    setSelectedZone(updatedZone)
  }

  const deleteZone = (zoneId: string) => {
    setEditingZones(zones => zones ? zones.filter(z => z.id !== zoneId) : [])
    if (selectedZone?.id === zoneId) {
      setSelectedZone(null)
    }
  }

  const handleEditAngle = (angle: PoseAngle) => {
    setSelectedAngle(angle)
    setIsEditingAngle(true)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedAngle) return

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB')
      return
    }

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('angleId', selectedAngle.id)
      formData.append('poseId', selectedPose?.id || '')

      const response = await fetch('/api/upload-pose-image', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Изображение загружено:', result)

        // Обновляем mediaUrl для ракурса
        const updatedAngle = {
          ...selectedAngle,
          mediaUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl
        }

        setSelectedAngle(updatedAngle)

        // Обновляем позу с новым ракурсом
        if (selectedPose) {
          const updatedPose = {
            ...selectedPose,
            angles: (Array.isArray(selectedPose.angles) ? selectedPose.angles : []).map(a =>
              a.id === selectedAngle.id ? updatedAngle : a
            )
          }
          handleSavePose(updatedPose)
        }

        alert('Изображение успешно загружено!')
      } else {
        const error = await response.text()
        console.error('Ошибка загрузки:', error)
        alert('Ошибка загрузки изображения: ' + error)
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error)
      alert('Ошибка загрузки изображения')
    }

    // Сбрасываем input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSaveAngle = () => {
    if (!selectedAngle || !selectedPose) return

    const updatedPose = {
      ...selectedPose,
      angles: (Array.isArray(selectedPose.angles) ? selectedPose.angles : []).map(a =>
        a.id === selectedAngle.id ? selectedAngle : a
      )
    }

    handleSavePose(updatedPose)
    setIsEditingAngle(false)
    setSelectedAngle(null)
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
        {Object.values(poses).map((pose, index) => (
          <Card key={pose.id || `pose-${index}`} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{pose.name}</CardTitle>
                  <CardDescription>{pose.description}</CardDescription>
                </div>
                <Badge variant="outline">{(Array.isArray(pose.angles) ? pose.angles : []).length} ракурсов</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Ракурсов: {(Array.isArray(pose.angles) ? pose.angles : []).length}
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
              <Button onClick={handleCreateAngle}>
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
                  {(Array.isArray(selectedPose.angles) ? selectedPose.angles : []).map((angle, index) => (
                    <Card key={angle.id || `angle-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{angle.name}</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAngle(angle)}
                              title="Редактировать ракурс"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditZones(angle)}
                              title="Редактировать зоны"
                            >
                              <Settings className="h-4 w-4" />
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
                            Активных зон: {(Array.isArray(angle.activeZones) ? angle.activeZones : []).length}
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
                          {/* Показываем активные зоны */}
                          {(Array.isArray(angle.activeZones) ? angle.activeZones : []).length > 0 && (
                            <div className="mt-2">
                              <div className="text-sm font-medium mb-2">Активные зоны:</div>
                              <div className="space-y-1">
                                {(Array.isArray(angle.activeZones) ? angle.activeZones : []).map((zone, zoneIndex) => (
                                  <div key={zone.id || `zone-${zoneIndex}`} className="text-xs bg-gray-100 p-2 rounded">
                                    <div className="font-medium">{zone.name}</div>
                                    <div className="text-gray-600">
                                      {zone.category} • Чувствительность: {zone.sensitivity}/10
                                    </div>
                                    <div className="text-gray-500">
                                      Действий: {zone.availableActions?.length || 0} •
                                      Инструментов: {zone.availableTools?.length || 0}
                                    </div>
                                  </div>
                                ))}
                              </div>
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
        <Dialog open={!!editingPose} onOpenChange={(open) => !open && setEditingPose(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Редактирование позы</DialogTitle>
              <DialogDescription>
                Настройте параметры позы для персонажа
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="pose-name">Название позы</Label>
                <Input
                  id="pose-name"
                  value={editingPose.name}
                  onChange={(e) => setEditingPose({...editingPose, name: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="pose-description">Описание</Label>
                <Textarea
                  id="pose-description"
                  value={editingPose.description}
                  onChange={(e) => setEditingPose({...editingPose, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pose-key">Ключ позы</Label>
                  <Input
                    id="pose-key"
                    value={editingPose.key}
                    onChange={(e) => setEditingPose({...editingPose, key: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="pose-category">Категория</Label>
                  <Select
                    value={editingPose.category}
                    onValueChange={(value) => setEditingPose({...editingPose, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standing">Стоя</SelectItem>
                      <SelectItem value="kneeling">На коленях</SelectItem>
                      <SelectItem value="lying">Лежа</SelectItem>
                      <SelectItem value="sitting">Сидя</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Гибкость (требование)</Label>
                  <Slider
                    value={[editingPose.requirements?.flexibility || 0]}
                    onValueChange={([value]) => setEditingPose({
                      ...editingPose,
                      requirements: {...editingPose.requirements, flexibility: value}
                    })}
                    max={10}
                    step={1}
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    {editingPose.requirements?.flexibility || 0}/10
                  </div>
                </div>
                <div>
                  <Label>Сила (требование)</Label>
                  <Slider
                    value={[editingPose.requirements?.strength || 0]}
                    onValueChange={([value]) => setEditingPose({
                      ...editingPose,
                      requirements: {...editingPose.requirements, strength: value}
                    })}
                    max={10}
                    step={1}
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    {editingPose.requirements?.strength || 0}/10
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingPose(null)}>
                Отмена
              </Button>
              <Button onClick={() => handleSavePose(editingPose)}>
                Сохранить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Визуальный редактор зон */}
      {editingZones !== null && editingAngle && (
        <Dialog open={editingZones !== null} onOpenChange={(open) => !open && setEditingZones(null)}>
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
                  {editingAngle.mediaUrl ? (
                    <>
                      <img
                        ref={imageRef}
                        src={editingAngle.mediaUrl}
                        alt={editingAngle.name}
                        className="w-full h-full object-contain cursor-crosshair"
                        onClick={handleImageClick}
                      />

                      {/* Визуализация активных зон */}
                      {editingZones && editingZones.map((zone, index) => (
                        <div
                          key={zone.id || `zone-visual-${index}`}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedZone(zone)
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Изображение не загружено</p>
                        <p className="text-sm">Добавьте URL изображения в настройках ракурса</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Правая панель - настройки зон */}
              <div className="w-80 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4">
                  {selectedZone && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Настройки зоны</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Название зоны</Label>
                          <Input
                            value={selectedZone.name}
                            onChange={(e) => updateZone({...selectedZone, name: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label>Описание</Label>
                          <Textarea
                            value={selectedZone.description}
                            onChange={(e) => updateZone({...selectedZone, description: e.target.value})}
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label>Категория</Label>
                          <Select
                            value={selectedZone.category}
                            onValueChange={(value: any) => updateZone({...selectedZone, category: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="touch">Прикосновения</SelectItem>
                              <SelectItem value="pressure">Давление</SelectItem>
                              <SelectItem value="temperature">Температура</SelectItem>
                              <SelectItem value="electrical">Электричество</SelectItem>
                              <SelectItem value="visual">Визуал</SelectItem>
                              <SelectItem value="auditory">Звук</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Чувствительность: {selectedZone.sensitivity}/10</Label>
                          <Slider
                            value={[selectedZone.sensitivity]}
                            onValueChange={([value]) => updateZone({...selectedZone, sensitivity: value})}
                            max={10}
                            min={1}
                            step={1}
                          />
                        </div>

                        <div>
                          <Label>Связанная анатомия</Label>
                          <Select
                            value={selectedZone.anatomyId || ""}
                            onValueChange={(value) => updateZone({...selectedZone, anatomyId: value || undefined})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите анатомию" />
                            </SelectTrigger>
                            <SelectContent>
                              {(systemConfig.anatomy || []).map((item: any) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteZone(selectedZone.id)}
                          >
                            Удалить зону
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Список всех зон */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Активные зоны</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {(editingZones?.length || 0)} зон
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {editingZones && editingZones.length > 0 ? (
                          editingZones.map((zone, index) => (
                            <div key={zone.id || `zone-list-${index}`} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <div className="font-medium text-sm">{zone.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {zone.category} • {zone.sensitivity}/10
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedZone(zone)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-muted-foreground text-sm py-4">
                            Нет активных зон. Нажмите "Создать зону" для добавления.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setEditingZones(null)}>
                    Отмена
                  </Button>
                  <Button onClick={handleSaveAngleZones}>
                    Сохранить зоны
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог редактирования ракурса */}
      {selectedAngle && (
        <Dialog open={isEditingAngle} onOpenChange={(open) => !open && setIsEditingAngle(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Редактирование ракурса</DialogTitle>
              <DialogDescription>
                Настройте параметры ракурса и загрузите изображение
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="angle-name">Название ракурса</Label>
                <Input
                  id="angle-name"
                  value={selectedAngle.name}
                  onChange={(e) => setSelectedAngle({...selectedAngle, name: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="angle-description">Описание</Label>
                <Textarea
                  id="angle-description"
                  value={selectedAngle.description}
                  onChange={(e) => setSelectedAngle({...selectedAngle, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <Label>Тип медиа</Label>
                <Select
                  value={selectedAngle.mediaType}
                  onValueChange={(value: any) => setSelectedAngle({...selectedAngle, mediaType: value})}
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

              <div>
                <Label>Изображение ракурса</Label>
                <div className="space-y-2">
                  {selectedAngle.mediaUrl ? (
                    <div className="border rounded-lg p-4">
                      <img
                        src={selectedAngle.mediaUrl}
                        alt={selectedAngle.name}
                        className="w-full h-48 object-cover rounded"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Текущее изображение: {selectedAngle.mediaUrl}
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-muted-foreground">Изображение не загружено</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      aria-label="Выберите изображение для загрузки"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedAngle.mediaUrl ? 'Заменить изображение' : 'Загрузить изображение'}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="angle-media-url">Или укажите URL изображения</Label>
                <Input
                  id="angle-media-url"
                  value={selectedAngle.mediaUrl}
                  onChange={(e) => setSelectedAngle({...selectedAngle, mediaUrl: e.target.value})}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditingAngle(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveAngle}>
                Сохранить ракурс
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}