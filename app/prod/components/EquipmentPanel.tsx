"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { 
  Handcuffs, 
  Collar, 
  Zap, 
  Thermometer, 
  Vibrate, 
  Whip, 
  Brush, 
  Shirt, 
  Table, 
  Cross, 
  Chair,
  Settings,
  Power,
  PowerOff
} from 'lucide-react'

import { Equipment, EquipmentCategory, EquipmentSettings } from '@/lib/unified-entities'

interface EquipmentPanelProps {
  equipment: Equipment[]
  onEquipmentToggle: (equipmentId: string, isActive: boolean) => void
  onEquipmentSettingsChange: (equipmentId: string, settings: EquipmentSettings) => void
  onEquipmentRemove: (equipmentId: string) => void
}

const getEquipmentIcon = (category: EquipmentCategory) => {
  switch (category) {
    case EquipmentCategory.HANDCUFFS:
      return <Handcuffs className="w-4 h-4" />
    case EquipmentCategory.COLLAR:
      return <Collar className="w-4 h-4" />
    case EquipmentCategory.VIBRATOR:
      return <Vibrate className="w-4 h-4" />
    case EquipmentCategory.ELECTROSTIM:
      return <Zap className="w-4 h-4" />
    case EquipmentCategory.THERMO:
      return <Thermometer className="w-4 h-4" />
    case EquipmentCategory.WHIP:
      return <Whip className="w-4 h-4" />
    case EquipmentCategory.BRUSH:
      return <Brush className="w-4 h-4" />
    case EquipmentCategory.UNIFORM:
      return <Shirt className="w-4 h-4" />
    case EquipmentCategory.BDSM_SUIT:
      return <Shirt className="w-4 h-4" />
    case EquipmentCategory.TABLE:
      return <Table className="w-4 h-4" />
    case EquipmentCategory.CROSS:
      return <Cross className="w-4 h-4" />
    case EquipmentCategory.CHAIR:
      return <Chair className="w-4 h-4" />
    default:
      return <Settings className="w-4 h-4" />
  }
}

const getEquipmentCategoryName = (category: EquipmentCategory) => {
  switch (category) {
    case EquipmentCategory.HANDCUFFS:
      return 'Наручники'
    case EquipmentCategory.COLLAR:
      return 'Ошейник'
    case EquipmentCategory.VIBRATOR:
      return 'Вибратор'
    case EquipmentCategory.ELECTROSTIM:
      return 'Электростимулятор'
    case EquipmentCategory.THERMO:
      return 'Термоустройство'
    case EquipmentCategory.WHIP:
      return 'Плеть'
    case EquipmentCategory.BRUSH:
      return 'Щетка'
    case EquipmentCategory.UNIFORM:
      return 'Униформа'
    case EquipmentCategory.BDSM_SUIT:
      return 'БДСМ костюм'
    case EquipmentCategory.TABLE:
      return 'Стол'
    case EquipmentCategory.CROSS:
      return 'Крест'
    case EquipmentCategory.CHAIR:
      return 'Кресло'
    default:
      return 'Устройство'
  }
}

const getEquipmentCategoryColor = (category: EquipmentCategory) => {
  switch (category) {
    case EquipmentCategory.HANDCUFFS:
    case EquipmentCategory.COLLAR:
      return 'bg-red-500'
    case EquipmentCategory.VIBRATOR:
    case EquipmentCategory.ELECTROSTIM:
    case EquipmentCategory.THERMO:
      return 'bg-purple-500'
    case EquipmentCategory.WHIP:
    case EquipmentCategory.BRUSH:
      return 'bg-orange-500'
    case EquipmentCategory.UNIFORM:
    case EquipmentCategory.BDSM_SUIT:
      return 'bg-blue-500'
    case EquipmentCategory.TABLE:
    case EquipmentCategory.CROSS:
    case EquipmentCategory.CHAIR:
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}

export default function EquipmentPanel({
  equipment,
  onEquipmentToggle,
  onEquipmentSettingsChange,
  onEquipmentRemove
}: EquipmentPanelProps) {
  const [activeTab, setActiveTab] = useState('restraints')
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null)

  const groupedEquipment = equipment.reduce((acc, item) => {
    const category = item.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, Equipment[]>)

  const handleIntensityChange = (equipmentId: string, value: number[]) => {
    const equipment = equipment.find(eq => eq.id === equipmentId)
    if (equipment) {
      onEquipmentSettingsChange(equipmentId, {
        ...equipment.settings,
        intensity: value[0]
      })
    }
  }

  const handleFrequencyChange = (equipmentId: string, value: number[]) => {
    const equipment = equipment.find(eq => eq.id === equipmentId)
    if (equipment) {
      onEquipmentSettingsChange(equipmentId, {
        ...equipment.settings,
        frequency: value[0]
      })
    }
  }

  const handleTemperatureChange = (equipmentId: string, value: number[]) => {
    const equipment = equipment.find(eq => eq.id === equipmentId)
    if (equipment) {
      onEquipmentSettingsChange(equipmentId, {
        ...equipment.settings,
        temperature: value[0]
      })
    }
  }

  const handleVoltageChange = (equipmentId: string, value: number[]) => {
    const equipment = equipment.find(eq => eq.id === equipmentId)
    if (equipment) {
      onEquipmentSettingsChange(equipmentId, {
        ...equipment.settings,
        voltage: value[0]
      })
    }
  }

  const toggleEquipmentExpanded = (equipmentId: string) => {
    setExpandedEquipment(expandedEquipment === equipmentId ? null : equipmentId)
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-xl">
      <Card className="bg-transparent border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Оборудование
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-700">
              <TabsTrigger value="restraints" className="text-xs">Ограничители</TabsTrigger>
              <TabsTrigger value="stimulation" className="text-xs">Стимуляция</TabsTrigger>
              <TabsTrigger value="clothing" className="text-xs">Одежда</TabsTrigger>
              <TabsTrigger value="furniture" className="text-xs">Мебель</TabsTrigger>
              <TabsTrigger value="tools" className="text-xs">Инструменты</TabsTrigger>
            </TabsList>

            <TabsContent value="restraints" className="space-y-3 mt-4">
              {groupedEquipment[EquipmentCategory.HANDCUFFS]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
              {groupedEquipment[EquipmentCategory.COLLAR]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
            </TabsContent>

            <TabsContent value="stimulation" className="space-y-3 mt-4">
              {groupedEquipment[EquipmentCategory.VIBRATOR]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                  showIntensity={true}
                  showFrequency={true}
                />
              ))}
              {groupedEquipment[EquipmentCategory.ELECTROSTIM]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                  showIntensity={true}
                  showVoltage={true}
                />
              ))}
              {groupedEquipment[EquipmentCategory.THERMO]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                  showTemperature={true}
                />
              ))}
            </TabsContent>

            <TabsContent value="clothing" className="space-y-3 mt-4">
              {groupedEquipment[EquipmentCategory.UNIFORM]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
              {groupedEquipment[EquipmentCategory.BDSM_SUIT]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
            </TabsContent>

            <TabsContent value="furniture" className="space-y-3 mt-4">
              {groupedEquipment[EquipmentCategory.TABLE]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
              {groupedEquipment[EquipmentCategory.CROSS]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
              {groupedEquipment[EquipmentCategory.CHAIR]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
            </TabsContent>

            <TabsContent value="tools" className="space-y-3 mt-4">
              {groupedEquipment[EquipmentCategory.WHIP]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
              {groupedEquipment[EquipmentCategory.BRUSH]?.map((item) => (
                <EquipmentItem
                  key={item.id}
                  equipment={item}
                  onToggle={onEquipmentToggle}
                  onSettingsChange={onEquipmentSettingsChange}
                  onRemove={onEquipmentRemove}
                  isExpanded={expandedEquipment === item.id}
                  onToggleExpanded={toggleEquipmentExpanded}
                />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

interface EquipmentItemProps {
  equipment: Equipment
  onToggle: (equipmentId: string, isActive: boolean) => void
  onSettingsChange: (equipmentId: string, settings: EquipmentSettings) => void
  onRemove: (equipmentId: string) => void
  isExpanded: boolean
  onToggleExpanded: (equipmentId: string) => void
  showIntensity?: boolean
  showFrequency?: boolean
  showTemperature?: boolean
  showVoltage?: boolean
}

function EquipmentItem({
  equipment,
  onToggle,
  onSettingsChange,
  onRemove,
  isExpanded,
  onToggleExpanded,
  showIntensity = false,
  showFrequency = false,
  showTemperature = false,
  showVoltage = false
}: EquipmentItemProps) {
  return (
    <div className="bg-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded ${getEquipmentCategoryColor(equipment.category)}`}>
            {getEquipmentIcon(equipment.category)}
          </div>
          <div>
            <h4 className="text-white font-medium">{getEquipmentCategoryName(equipment.category)}</h4>
            <p className="text-gray-400 text-sm">{equipment.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={equipment.isActive ? "default" : "secondary"}>
            {equipment.isActive ? "Активно" : "Неактивно"}
          </Badge>
          
          <Button
            size="sm"
            variant={equipment.isActive ? "destructive" : "default"}
            onClick={() => onToggle(equipment.id, !equipment.isActive)}
          >
            {equipment.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleExpanded(equipment.id)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onRemove(equipment.id)}
          >
            Снять
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-600 space-y-3">
          {showIntensity && (
            <div>
              <label className="text-sm text-gray-300">Интенсивность</label>
              <Slider
                value={[equipment.settings.intensity || 0]}
                onValueChange={(value) => onSettingsChange(equipment.id, { ...equipment.settings, intensity: value[0] })}
                max={10}
                step={1}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{equipment.settings.intensity || 0}/10</span>
            </div>
          )}
          
          {showFrequency && (
            <div>
              <label className="text-sm text-gray-300">Частота</label>
              <Slider
                value={[equipment.settings.frequency || 0]}
                onValueChange={(value) => onSettingsChange(equipment.id, { ...equipment.settings, frequency: value[0] })}
                max={10}
                step={1}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{equipment.settings.frequency || 0}/10</span>
            </div>
          )}
          
          {showTemperature && (
            <div>
              <label className="text-sm text-gray-300">Температура</label>
              <Slider
                value={[equipment.settings.temperature || 20]}
                onValueChange={(value) => onSettingsChange(equipment.id, { ...equipment.settings, temperature: value[0] })}
                min={0}
                max={50}
                step={1}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{equipment.settings.temperature || 20}°C</span>
            </div>
          )}
          
          {showVoltage && (
            <div>
              <label className="text-sm text-gray-300">Напряжение</label>
              <Slider
                value={[equipment.settings.voltage || 0]}
                onValueChange={(value) => onSettingsChange(equipment.id, { ...equipment.settings, voltage: value[0] })}
                min={0}
                max={100}
                step={5}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{equipment.settings.voltage || 0}V</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
