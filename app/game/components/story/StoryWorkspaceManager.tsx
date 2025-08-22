'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  FolderPlus,
  Settings,
  Save,
  Copy,
  Eye,
  Grid3X3,
  FileText
} from "lucide-react"

interface Workspace {
  id: string
  name: string
  description: string
  type: 'scene' | 'chapter' | 'storyline' | 'custom'
  scenes: string[]
  storyPoints: string[]
  createdAt: string
  lastModified: string
  isActive: boolean
}

interface StoryWorkspaceManagerProps {
  workspaces: Record<string, Workspace>
  activeWorkspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onWorkspaceCreate: (workspace: Omit<Workspace, 'id' | 'createdAt' | 'lastModified'>) => void
  onWorkspaceUpdate: (workspaceId: string, updates: Partial<Workspace>) => void
  onWorkspaceDelete: (workspaceId: string) => void
  onWorkspaceDuplicate: (workspaceId: string) => void
  onNavigateToVisual?: () => void
}

export function StoryWorkspaceManager({
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreate,
  onWorkspaceUpdate,
  onWorkspaceDelete,
  onWorkspaceDuplicate,
  onNavigateToVisual
}: StoryWorkspaceManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    description: '',
    type: 'scene' as const,
    scenes: [],
    storyPoints: [],
    isActive: true
  })

  const handleCreateWorkspace = () => {
    if (newWorkspace.name.trim()) {
      onWorkspaceCreate(newWorkspace)
      setNewWorkspace({
        name: '',
        description: '',
        type: 'scene',
        scenes: [],
        storyPoints: [],
        isActive: true
      })
      setIsCreateDialogOpen(false)
    }
  }

  const handleEditWorkspace = () => {
    if (editingWorkspace && editingWorkspace.name.trim()) {
      onWorkspaceUpdate(editingWorkspace.id, {
        name: editingWorkspace.name,
        description: editingWorkspace.description,
        type: editingWorkspace.type
      })
      setEditingWorkspace(null)
      setIsEditDialogOpen(false)
    }
  }

  const openEditDialog = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setIsEditDialogOpen(true)
  }

  const getWorkspaceTypeColor = (type: string) => {
    const colors = {
      scene: 'bg-blue-100 text-blue-800',
      chapter: 'bg-green-100 text-green-800',
      storyline: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || colors.custom
  }

  const getWorkspaceTypeIcon = (type: string) => {
    switch (type) {
      case 'scene': return <Grid3X3 className="h-4 w-4" />
      case 'chapter': return <FolderOpen className="h-4 w-4" />
      case 'storyline': return <Eye className="h-4 w-4" />
      case 'custom': return <Settings className="h-4 w-4" />
      default: return <FolderOpen className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Рабочие области</h2>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Новая область
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать новую рабочую область</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Название</Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspace.name}
                    onChange={(e) => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Введите название рабочей области"
                  />
                </div>
                <div>
                  <Label htmlFor="workspace-description">Описание</Label>
                  <Textarea
                    id="workspace-description"
                    value={newWorkspace.description}
                    onChange={(e) => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Описание назначения этой рабочей области"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="workspace-type">Тип</Label>
                  <Select
                    value={newWorkspace.type}
                    onValueChange={(value) => setNewWorkspace(prev => ({ ...prev, type: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scene">Сцена</SelectItem>
                      <SelectItem value="chapter">Глава</SelectItem>
                      <SelectItem value="storyline">Сюжетная линия</SelectItem>
                      <SelectItem value="custom">Пользовательская</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateWorkspace} className="flex-1">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Список рабочих областей */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {Object.values(workspaces).map((workspace) => (
            <Card 
              key={workspace.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeWorkspaceId === workspace.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onWorkspaceChange(workspace.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getWorkspaceTypeColor(workspace.type)}`}>
                      {getWorkspaceTypeIcon(workspace.type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{workspace.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getWorkspaceTypeColor(workspace.type)}>
                          {workspace.type === 'scene' ? 'Сцена' : 
                           workspace.type === 'chapter' ? 'Глава' :
                           workspace.type === 'storyline' ? 'Сюжетная линия' : 'Пользовательская'}
                        </Badge>
                        {workspace.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Активная
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onNavigateToVisual && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onWorkspaceChange(workspace.id)
                          onNavigateToVisual()
                        }}
                      >
                        <FileText className="h-3 w-3" />
                        Редактировать
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onWorkspaceDuplicate(workspace.id)
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(workspace)
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onWorkspaceDelete(workspace.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {workspace.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {workspace.description}
                  </p>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Создано: {formatDate(workspace.createdAt)}</span>
                  <span>Изменено: {formatDate(workspace.lastModified)}</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{workspace.scenes.length} сцен</span>
                  <span>{workspace.storyPoints.length} сюжетных точек</span>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {Object.keys(workspaces).length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Нет рабочих областей</h3>
              <p className="text-muted-foreground mb-4">
                Создайте первую рабочую область для организации ваших сюжетных сцен
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Создать рабочую область
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Диалог редактирования */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать рабочую область</DialogTitle>
          </DialogHeader>
          {editingWorkspace && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-workspace-name">Название</Label>
                <Input
                  id="edit-workspace-name"
                  value={editingWorkspace.name}
                  onChange={(e) => setEditingWorkspace(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Введите название рабочей области"
                />
              </div>
              <div>
                <Label htmlFor="edit-workspace-description">Описание</Label>
                <Textarea
                  id="edit-workspace-description"
                  value={editingWorkspace.description}
                  onChange={(e) => setEditingWorkspace(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Описание назначения этой рабочей области"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-workspace-type">Тип</Label>
                <Select
                  value={editingWorkspace.type}
                  onValueChange={(value) => setEditingWorkspace(prev => prev ? { ...prev, type: value as any } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scene">Сцена</SelectItem>
                    <SelectItem value="chapter">Глава</SelectItem>
                    <SelectItem value="storyline">Сюжетная линия</SelectItem>
                    <SelectItem value="custom">Пользовательская</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleEditWorkspace} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
