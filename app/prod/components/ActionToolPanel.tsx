'use client';

import React, { useState, useEffect } from 'react';

interface ActionToolPanelProps {
  characterAI: any; // Используем any для совместимости с useCharacterAI
  selectedTalent: any; // Используем any для совместимости с Talent
  onClose: () => void;
}

export function ActionToolPanel({
  characterAI,
  selectedTalent,
  onClose
}: ActionToolPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [actionIntensity, setActionIntensity] = useState([5]);
  const [toolIntensity, setToolIntensity] = useState([5]);
  const [toolDuration, setToolDuration] = useState([30]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Получаем данные из characterAI
  const actions = characterAI?.characterAIConfig?.actions || {};
  const tools = characterAI?.characterAIConfig?.tools || {};
  const actionCategories = characterAI?.characterAIConfig?.actionCategories || {};
  const toolCategories = characterAI?.characterAIConfig?.toolCategories || {};
  
  // Используем poseManagementService для получения поз, чтобы избежать дублирования
  const poses = characterAI?.poseManagementService ? 
    Object.values(characterAI.poseManagementService.getAllPoses()) as any[] :
    Object.values(characterAI?.characterAIConfig?.poses || {}) as any[];
  
  const currentPose = characterAI?.currentPose || 'standing_normal';
  
  // Проверяем, что конфигурация загружена
  const isConfigLoaded = characterAI?.characterAIConfig && 
    characterAI.characterAIConfig.actions &&
    Object.keys(characterAI.characterAIConfig.actions).length > 0;
  
  // Отладочная информация
  console.log('🔧 ActionToolPanel Debug:', {
    hasCharacterAI: !!characterAI,
    hasConfig: !!characterAI?.characterAIConfig,
    hasActions: !!characterAI?.characterAIConfig?.actions,
    actionsCount: characterAI?.characterAIConfig?.actions ? Object.keys(characterAI.characterAIConfig.actions).length : 0,
    hasPoseManagementService: !!characterAI?.poseManagementService,
    posesCount: poses.length,
    posesSource: characterAI?.poseManagementService ? 'poseManagementService' : 'characterAIConfig',
    isConfigLoaded
  });

  const handleActionSelect = (action: any) => {
    setSelectedAction(action.id);
  };

  const handleToolSelect = (tool: any) => {
    setSelectedTool(tool.id);
  };

  const handleActionExecute = async () => {
    if (selectedAction && characterAI?.executeAction) {
      const action = actions[selectedAction];
      if (action) {
        await characterAI.executeAction(action.id, actionIntensity[0]);
        console.log(`Выполнено действие: ${action.name}`);
        setSelectedAction(null);
      }
    }
  };

  const handleToolExecute = async () => {
    if (selectedTool && characterAI?.useTool) {
      const tool = tools[selectedTool];
      if (tool) {
        await characterAI.useTool(tool.id, toolIntensity[0], toolDuration[0]);
        console.log(`Использован инструмент: ${tool.name}`);
        setSelectedTool(null);
      }
    }
  };

  const handlePoseClick = async (pose: any) => {
    if (characterAI?.changePose) {
      await characterAI.changePose(pose.id);
      console.log(`Смена позы: ${pose.name}`);
    }
  };

  const [position, setPosition] = useState(() => {
    // Центрируем панель при первом открытии
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(0, (window.innerWidth - 384) / 2),
        y: Math.max(0, (window.innerHeight - 400) / 2)
      }
    }
    return { x: 100, y: 100 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState('actions')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Ограничиваем позицию границами экрана
      const maxX = window.innerWidth - 384 // w-96 = 384px
      const maxY = window.innerHeight - 400 // примерная высота панели
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  return (
    <div 
      className="fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-96 max-h-[80vh] flex flex-col cursor-move"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="p-3 border-b border-gray-600 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <h3 className="font-semibold text-cyan-400">
          🎮 Действия и инструменты
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {!isConfigLoaded ? (
        <div className="flex-1 p-4 text-center">
          <div className="text-gray-400 mb-4 text-4xl">🤖</div>
          <h3 className="text-lg font-semibold text-white mb-2">Character AI не загружен</h3>
          <p className="text-gray-400 text-sm">
            Конфигурация Character AI не найдена или повреждена.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Вкладки */}
          <div className="flex border-b border-gray-600">
            {['actions', 'tools', 'poses'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab === 'actions' && 'Действия'}
                {tab === 'tools' && 'Инструменты'}
                {tab === 'poses' && 'Позы'}
              </button>
            ))}
          </div>

          {/* Общий бар интенсивности */}
          {(activeTab === 'actions' || activeTab === 'tools') && (
            <div className="p-3 border-b border-gray-600 bg-gray-800/50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300 whitespace-nowrap">
                  {activeTab === 'actions' ? 'Интенсивность действия:' : 'Интенсивность инструмента:'}
                </span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={activeTab === 'actions' ? actionIntensity[0] : toolIntensity[0]}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (activeTab === 'actions') {
                      setActionIntensity([value])
                    } else {
                      setToolIntensity([value])
                    }
                  }}
                  className="flex-1"
                  aria-label={`Интенсивность ${activeTab === 'actions' ? 'действия' : 'инструмента'}`}
                />
                <span className="text-sm text-cyan-400 font-medium min-w-[2rem] text-center">
                  {activeTab === 'actions' ? actionIntensity[0] : toolIntensity[0]}
                </span>
              </div>
              {activeTab === 'tools' && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-gray-300 whitespace-nowrap">Длительность:</span>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={toolDuration[0]}
                    onChange={(e) => setToolDuration([parseInt(e.target.value)])}
                    className="flex-1"
                    aria-label="Длительность инструмента"
                  />
                  <span className="text-sm text-purple-400 font-medium min-w-[3rem] text-center">
                    {toolDuration[0]}с
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Контент вкладок */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            {activeTab === 'actions' && (
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-2">Выберите действие:</div>
                {Object.entries(actionCategories).map(([categoryId, category]: [string, any]) => {
                  const categoryActions = Object.entries(actions).filter(([id, action]: [string, any]) => 
                    action.category === categoryId
                  )
                  
                  if (categoryActions.length === 0) return null
                  
                  return (
                    <div key={categoryId} className="space-y-2">
                      <div 
                        className="flex items-center gap-2 text-cyan-400 font-medium cursor-pointer hover:text-cyan-300"
                        onClick={() => setOpenCategory(openCategory === categoryId ? null : categoryId)}
                      >
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                        <span className="text-xs text-gray-500">({categoryActions.length})</span>
                        <span className="ml-auto text-xs">
                          {openCategory === categoryId ? '▲' : '▼'}
                        </span>
                      </div>
                      {openCategory === categoryId && (
                        <div className="space-y-2 ml-4">
                        {categoryActions.map(([id, action]: [string, any]) => (
                          <div key={id} className="p-3 bg-gray-800 rounded border border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">{action.icon} {action.name}</span>
                              <button
                                onClick={() => {
                                  setSelectedAction(id)
                                  handleActionExecute()
                                }}
                                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm"
                              >
                                Выполнить
                              </button>
                            </div>
                            <p className="text-sm text-gray-300">{action.description}</p>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-2">Выберите инструмент:</div>
                {Object.entries(toolCategories).map(([categoryId, category]: [string, any]) => {
                  const categoryTools = Object.entries(tools).filter(([id, tool]: [string, any]) => 
                    tool.category === categoryId
                  )
                  
                  if (categoryTools.length === 0) return null
                  
                  return (
                    <div key={categoryId} className="space-y-2">
                      <div 
                        className="flex items-center gap-2 text-purple-400 font-medium cursor-pointer hover:text-purple-300"
                        onClick={() => setOpenCategory(openCategory === categoryId ? null : categoryId)}
                      >
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                        <span className="text-xs text-gray-500">({categoryTools.length})</span>
                        <span className="ml-auto text-xs">
                          {openCategory === categoryId ? '▲' : '▼'}
                        </span>
                      </div>
                      {openCategory === categoryId && (
                        <div className="space-y-2 ml-4">
                        {categoryTools.map(([id, tool]: [string, any]) => (
                          <div key={id} className="p-3 bg-gray-800 rounded border border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">{tool.icon} {tool.name}</span>
                              <button
                                onClick={() => {
                                  setSelectedTool(id)
                                  handleToolExecute()
                                }}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                              >
                                Использовать
                              </button>
                            </div>
                            <p className="text-sm text-gray-300">{tool.description}</p>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'poses' && (
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-2">Выберите позу:</div>
                {poses.length > 0 ? (
                  <div className="space-y-2">
                    {poses.map((pose: any) => (
                      <div key={pose.id} className="p-3 bg-gray-800 rounded border border-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{pose.icon} {pose.name}</span>
                          {currentPose === pose.id && (
                            <span className="text-xs text-cyan-400">Текущая</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{pose.description}</p>
                        <button
                          onClick={() => handlePoseClick(pose)}
                          className="w-full px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Принять позу
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <div className="text-4xl mb-2">🧘</div>
                    <p>Позы не настроены</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
