"use client"

import React, { useState, useEffect } from 'react'
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
                <Badge variant="outline">{pose.category}</Badge>
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
                  {selectedPose.angles.map((angle) => (
                    <Card key={angle.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{angle.name}</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAngle(angle)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
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
            const updatedPose = {
              ...selectedPose,
              angles: selectedPose.angles.map(a =>
                a.id === updatedAngle.id ? updatedAngle : a
              )
            }
            handleSavePose(updatedPose)
            setEditingAngle(null)
          }}
          onCancel={() => setEditingAngle(null)}
          open={!!editingAngle}
        />
      )}

      {/* Диалог редактирования зоны */}
      {editingZone && (
        <ZoneEditDialog
          zone={editingZone}
          onSave={(updatedZone) => {
            if (!editingAngle) return
            const updatedAngle = {
              ...editingAngle,
              activeZones: [...editingAngle.activeZones, updatedZone]
            }
            setEditingAngle(updatedAngle)
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

          <div>
            <Label htmlFor="pose-category">Категория</Label>
            <Select
              value={editedPose.category}
              onValueChange={(value) => setEditedPose({...editedPose, category: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standing">Стоя</SelectItem>
                <SelectItem value="sitting">Сидя</SelectItem>
                <SelectItem value="kneeling">На коленях</SelectItem>
                <SelectItem value="lying">Лёжа</SelectItem>
                <SelectItem value="bound">Связанная</SelectItem>
                <SelectItem value="special">Специальная</SelectItem>
              </SelectContent>
            </Select>
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

// Компонент для редактирования ракурса
interface AngleEditDialogProps {
  angle: PoseAngle
  onSave: (angle: PoseAngle) => void
  onCancel: () => void
  open: boolean
}

const AngleEditDialog: React.FC<AngleEditDialogProps> = ({
  angle,
  onSave,
  onCancel,
  open
}) => {
  const [editedAngle, setEditedAngle] = useState<PoseAngle>(angle)

  useEffect(() => {
    setEditedAngle(angle)
  }, [angle])

  const handleSave = () => {
    onSave(editedAngle)
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
            <Label htmlFor="angle-media">URL медиа</Label>
            <Input
              id="angle-media"
              value={editedAngle.mediaUrl}
              onChange={(e) => setEditedAngle({...editedAngle, mediaUrl: e.target.value})}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <Label htmlFor="angle-thumbnail">URL миниатюры</Label>
            <Input
              id="angle-thumbnail"
              value={editedAngle.thumbnailUrl || ''}
              onChange={(e) => setEditedAngle({...editedAngle, thumbnailUrl: e.target.value})}
              placeholder="https://example.com/thumbnail.jpg"
            />
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
