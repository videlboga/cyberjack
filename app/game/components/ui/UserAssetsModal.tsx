import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, User, Package } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserAssetsModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  availableAssets: any[]
  availableEquipment: any[]
  onSave: (userId: string, assets: any[], equipment: any[]) => void
}

export const UserAssetsModal: React.FC<UserAssetsModalProps> = ({
  isOpen,
  onClose,
  user,
  availableAssets,
  availableEquipment,
  onSave
}) => {
  const [userAssets, setUserAssets] = useState<any[]>([])
  const [userEquipment, setUserEquipment] = useState<any[]>([])
  const [selectedAsset, setSelectedAsset] = useState<string>('')
  const [selectedEquipment, setSelectedEquipment] = useState<string>('')

  useEffect(() => {
    if (user) {
      setUserAssets(user.assets || [])
      setUserEquipment(user.equipment || [])
    }
  }, [user])

  const handleAddAsset = () => {
    if (selectedAsset) {
      const asset = availableAssets.find(a => a.id === selectedAsset)
      if (asset && !userAssets.find(ua => ua.assetId === selectedAsset)) {
        const newUserAsset = {
          assetId: asset.id,
          name: asset.name,
          acquired: new Date().toISOString(),
          status: 'active' as const,
          location: 'inventory',
          currentAssignment: null
        }
        setUserAssets([...userAssets, newUserAsset])
        setSelectedAsset('')
      }
    }
  }

  const handleRemoveAsset = (assetId: string) => {
    setUserAssets(userAssets.filter(ua => ua.assetId !== assetId))
  }

  const handleAddEquipment = () => {
    if (selectedEquipment) {
      const equipment = availableEquipment.find(e => e.id === selectedEquipment)
      if (equipment && !userEquipment.find(ue => ue.itemId === selectedEquipment)) {
        const newUserEquipment = {
          itemId: equipment.id,
          name: equipment.name,
          type: equipment.type,
          slot: equipment.slot,
          installed: new Date().toISOString(),
          status: 'active' as const
        }
        setUserEquipment([...userEquipment, newUserEquipment])
        setSelectedEquipment('')
      }
    }
  }

  const handleRemoveEquipment = (itemId: string) => {
    setUserEquipment(userEquipment.filter(ue => ue.itemId !== itemId))
  }

  const handleSave = () => {
    onSave(user.id, userAssets, userEquipment)
    onClose()
  }

  const getAssetStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'training': return 'bg-yellow-100 text-yellow-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEquipmentStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'damaged': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Управление активами пользователя: {user?.username}
          </DialogTitle>
          <DialogDescription>
            Управляйте активами и оборудованием пользователя. Добавляйте и удаляйте активы, которые будут доступны пользователю в игре.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Активы ({userAssets.length})
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Оборудование ({userEquipment.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Добавить актив</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Выберите актив" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssets
                        .filter(asset => !userAssets.find(ua => ua.assetId === asset.id))
                        .map(asset => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name} ({asset.rank})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddAsset} disabled={!selectedAsset}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Активы пользователя</CardTitle>
              </CardHeader>
              <CardContent>
                {userAssets.length === 0 ? (
                  <p className="text-muted-foreground">У пользователя нет активов</p>
                ) : (
                  <div className="space-y-2">
                    {userAssets.map(userAsset => {
                      const asset = availableAssets.find(a => a.id === userAsset.assetId)
                      return (
                        <div key={userAsset.assetId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{asset?.name || userAsset.name}</span>
                              <Badge variant="outline">{asset?.rank}</Badge>
                              <Badge className={getAssetStatusColor(userAsset.status)}>
                                {userAsset.status === 'active' ? 'Активен' : 
                                 userAsset.status === 'training' ? 'Обучение' : 'Неактивен'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Получен: {new Date(userAsset.acquired).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAsset(userAsset.assetId)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Добавить оборудование</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Выберите оборудование" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEquipment
                        .filter(equipment => !userEquipment.find(ue => ue.itemId === equipment.id))
                        .map(equipment => (
                          <SelectItem key={equipment.id} value={equipment.id}>
                            {equipment.name} ({equipment.type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddEquipment} disabled={!selectedEquipment}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Оборудование пользователя</CardTitle>
              </CardHeader>
              <CardContent>
                {userEquipment.length === 0 ? (
                  <p className="text-muted-foreground">У пользователя нет оборудования</p>
                ) : (
                  <div className="space-y-2">
                    {userEquipment.map(userEquipment => {
                      const equipment = availableEquipment.find(e => e.id === userEquipment.itemId)
                      return (
                        <div key={userEquipment.itemId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{equipment?.name || userEquipment.name}</span>
                              <Badge variant="outline">{equipment?.type || userEquipment.type}</Badge>
                              <Badge className={getEquipmentStatusColor(userEquipment.status)}>
                                {userEquipment.status === 'active' ? 'Активно' : 
                                 userEquipment.status === 'inactive' ? 'Неактивно' : 'Повреждено'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Установлено: {new Date(userEquipment.installed).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEquipment(userEquipment.itemId)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}







