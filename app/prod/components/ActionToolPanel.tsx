'use client';

import React, { useState, useEffect } from 'react';

interface ActionToolPanelProps {
  characterAI: any; // Используем any для совместимости с useCharacterAI
  selectedTalent: any; // Используем any для совместимости с Talent
  onClose: () => void;
  onToolModeChange?: (toolId: string | null, intensity?: number) => void;
  onActionModeChange?: (actionId: string | null, intensity?: number) => void;
}

export function ActionToolPanel({
  characterAI,
  selectedTalent,
  onClose,
  onToolModeChange,
  onActionModeChange
}: ActionToolPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [actionIntensity, setActionIntensity] = useState([5]);
  const [toolIntensity, setToolIntensity] = useState([5]);
  const [toolDuration, setToolDuration] = useState([30]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Получаем данные из characterAI (новая структура из базы данных)
  const actionCategoriesData = characterAI?.characterAIConfig?.actions || {};
  const toolCategoriesData = characterAI?.characterAIConfig?.tools || {};

  // Преобразуем в плоские структуры для совместимости с существующим кодом
  const actions = Object.entries(actionCategoriesData).reduce((acc, [category, items]) => {
    if (Array.isArray(items)) {
      items.forEach(item => {
        acc[item.id] = { ...item, category };
      });
    }
    return acc;
  }, {} as any);

  const tools = Object.entries(toolCategoriesData).reduce((acc, [category, items]) => {
    if (Array.isArray(items)) {
      items.forEach(item => {
        acc[item.id] = { ...item, category };
      });
    }
    return acc;
  }, {} as any);

  // Создаем категории для отображения
  const actionCategories = Object.keys(actionCategoriesData).reduce((acc, categoryKey) => {
    const categoryItems = actionCategoriesData[categoryKey] || [];
    if (Array.isArray(categoryItems) && categoryItems.length > 0) {
      acc[categoryKey] = {
        name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
        icon: getCategoryIcon(categoryKey),
        count: categoryItems.length
      };
    }
    return acc;
  }, {} as any);

  const toolCategories = Object.keys(toolCategoriesData).reduce((acc, categoryKey) => {
    const categoryItems = toolCategoriesData[categoryKey] || [];
    if (Array.isArray(categoryItems) && categoryItems.length > 0) {
      acc[categoryKey] = {
        name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
        icon: getCategoryIcon(categoryKey),
        count: categoryItems.length
      };
    }
    return acc;
  }, {} as any);

  // Получаем позы для выбранного персонажа из characterAIConfig
  const characterPoses = selectedTalent?.id ? characterAI?.characterAIConfig?.poses?.[selectedTalent.id]?.poses : {};
  const poses = Object.values(characterPoses || {}) as any[];

  const currentPose = characterAI?.currentPose || null;
  const currentAngle = characterAI?.currentAngle;

  // Функция для получения иконки категории
  function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      bdsm: '🔗',
      coaching: '🎯',
      experimental: '🧪',
      physical: '💪',
      test: '🧪',
      training: '🎓',
      electrical: '⚡',
      mechanical: '🔧',
      thermal: '🔥'
    };
    return icons[category] || '📁';
  }

  // Проверяем, что конфигурация загружена
  const isConfigLoaded = characterAI?.characterAIConfig &&
    (Object.keys(actions).length > 0 || Object.keys(tools).length > 0);

  // Отладочная информация
  console.log('🔧 ActionToolPanel Debug:', {
    hasCharacterAI: !!characterAI,
    hasConfig: !!characterAI?.characterAIConfig,
    actionCategoriesDataKeys: Object.keys(actionCategoriesData),
    toolCategoriesDataKeys: Object.keys(toolCategoriesData),
    actionsCount: Object.keys(actions).length,
    toolsCount: Object.keys(tools).length,
    actionCategoriesCount: Object.keys(actionCategories).length,
    toolCategoriesCount: Object.keys(toolCategories).length,
    selectedTalentId: selectedTalent?.id,
    hasCharacterPoses: !!characterPoses,
    posesCount: poses.length,
    posesSource: 'characterAIConfig.poses[characterId]',
    isConfigLoaded,
    characterAIConfigKeys: characterAI?.characterAIConfig ? Object.keys(characterAI.characterAIConfig) : [],
    availableCharacterIds: characterAI?.characterAIConfig?.poses ? Object.keys(characterAI.characterAIConfig.poses) : []
  });

  const handleActionSelect = (action: any) => {
    setSelectedAction(action.id);
  };

  const handleToolSelect = (tool: any) => {
    setSelectedTool(tool.id);
  };

  // убрали отдельные кнопки, выбор карточки включает режим

  // Включение/выключение режима инструмента
  const handleToolToggle = async () => {
    if (!selectedTool) return
    const tool = tools[selectedTool]
    if (!tool) return
    // Включаем ТОЛЬКО режим (без немедленного применения). Применение начнётся при удержании на зоне.
    console.log(`Режим инструмента включён: ${tool.name}`)
    onToolModeChange?.(tool.id, toolIntensity[0])
  }

  const handlePoseClick = async (pose: any) => {
    if (!characterAI?.characterId) {
      console.log('Нельзя сменить позу: персонаж не выбран');
      return;
    }
    if (characterAI?.changePose) {
      await characterAI.changePose(pose.id);
      console.log(`Смена позы: ${pose.name}`);
    }
  };

  const handleZoneClick = async (zone: any) => {
    console.log('🎯 Клик по зоне:', zone.name, zone.id);

    // Если выбран инструмент, применяем его к зоне
    if (selectedTool && characterAI?.useTool) {
      const tool = tools[selectedTool];
      if (tool) {
        console.log(`🔧 Применение инструмента ${tool.name} к зоне ${zone.name}`);
        await characterAI.useTool(selectedTool, zone.id, toolIntensity[0], toolDuration[0]);
      }
    }

    // Если выбрано действие, применяем его к зоне
    else if (selectedAction && characterAI?.executeAction) {
      const action = Object.values(actions).find((a: any) => a.id === selectedAction);
      if (action && typeof action === 'object' && 'name' in action) {
        console.log(`⚡ Выполнение действия ${(action as any).name} на зоне ${zone.name}`);
        await characterAI.executeAction(selectedAction, zone.id, actionIntensity[0]);
      }
    }

    // Если ничего не выбрано, показываем информацию о зоне
    else {
      console.log(`ℹ️ Информация о зоне ${zone.name}:`, zone);
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
  const [activeTab, setActiveTab] = useState('tools')
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
                        <span className="text-xs text-gray-500">({category.count || categoryActions.length})</span>
                        <span className="ml-auto text-xs">
                          {openCategory === categoryId ? '▲' : '▼'}
                        </span>
                      </div>
                      {openCategory === categoryId && (
                        <div className="space-y-2 ml-4">
                        {categoryActions.map(([id, action]: [string, any]) => (
                          <div
                            key={id}
                            className={`p-3 bg-gray-800 rounded border hover:bg-gray-700/60 cursor-pointer ${selectedAction === id ? 'border-cyan-500' : 'border-gray-600'}`}
                            onClick={() => {
                              console.log(`🎯 Выбор действия: ${action.name} (${id}) с интенсивностью ${actionIntensity[0]}`)
                              setSelectedAction(id)
                              onActionModeChange?.(id, actionIntensity[0])
                              console.log(`✅ Режим действия выбран: ${action.name}`)
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">{action.icon} {action.name}</span>
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
                          <div
                            key={id}
                            className={`p-3 bg-gray-800 rounded border hover:bg-gray-700/60 cursor-pointer ${selectedTool === id ? 'border-purple-500' : 'border-gray-600'}`}
                            onClick={() => {
                              console.log(`🎯 Выбор инструмента: ${tool.name} (${id}) с интенсивностью ${toolIntensity[0]}`)
                              setSelectedTool(id)
                              onToolModeChange?.(id, toolIntensity[0])
                              console.log(`✅ Режим инструмента выбран: ${tool.name}`)
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">{tool.icon} {tool.name}</span>
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

                {/* Текущая поза и ракурс */}
                {(currentPose || currentAngle) && (
                  <div className="p-3 bg-cyan-900/30 border border-cyan-500/50 rounded space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400">🎯</span>
                      <span className="text-white font-medium">Текущая поза:</span>
                      <span className="text-cyan-300">
                        {poses.find(p => p.id === currentPose)?.name || currentPose}
                      </span>
                    </div>
                    {currentAngle && (
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400">📷</span>
                        <span className="text-white font-medium">Текущий ракурс:</span>
                        <span className="text-purple-300">
                          {currentAngle.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Список поз */}
                {poses.length > 0 && characterAI?.characterId ? (
                  <div className="space-y-2">
                    {poses.map((pose: any, index: number) => (
                      <div key={pose.id || `pose-${index}`} className={`p-3 bg-gray-800 rounded border hover:bg-gray-700/60 cursor-pointer ${
                        currentPose === pose.id ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-600'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{pose.icon || '🧘'} {pose.name}</span>
                          {currentPose === pose.id && (
                            <span className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">Текущая</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{pose.description}</p>

                        {/* Информация о ракурсах */}
                        {pose.angles && pose.angles.length > 0 && (
                          <div className="text-xs text-gray-400 mb-2">
                            📷 {pose.angles.length} ракурс{pose.angles.length === 1 ? '' : pose.angles.length < 5 ? 'а' : 'ов'}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePoseClick(pose)}
                            className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                            disabled={currentPose === pose.id}
                          >
                            {currentPose === pose.id ? '✓ Текущая' : 'Принять позу'}
                          </button>

                          {/* Кнопки быстрого выбора ракурса */}
                          {currentPose === pose.id && pose.angles && pose.angles.length > 1 && (
                            <div className="flex gap-1">
                              {pose.angles.slice(0, 3).map((angle: any, index: number) => (
                                <button
                                  key={angle.id || `angle-${index}`}
                                  onClick={() => {
                                    if (characterAI?.changeAngle) {
                                      characterAI.changeAngle(angle.id);
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs rounded transition-colors ${
                                    currentAngle?.id === angle.id
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-purple-800 hover:bg-purple-700 text-gray-300'
                                  }`}
                                  title={angle.name}
                                >
                                  {index + 1}
                                </button>
                              ))}
                              {pose.angles.length > 3 && (
                                <span className="px-2 py-1 text-xs text-gray-500 self-center">
                                  +{pose.angles.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <div className="text-4xl mb-2">🧘</div>
                    {!characterAI?.characterId ? (
                      <>
                        <p>Выберите персонажа</p>
                        <p className="text-xs mt-2">Для работы с позами необходимо выбрать персонажа</p>
                      </>
                    ) : (
                      <>
                        <p>Позы не настроены</p>
                        <p className="text-xs mt-2">Настройте позы в разделе "Персонажи" → редактирование → "Позы"</p>
                      </>
                    )}
                  </div>
                )}

                {/* Настройки дефолтной позы */}
                <div className="mt-6 p-3 bg-gray-800/50 rounded border border-gray-600">
                  <h4 className="text-sm font-medium text-white mb-3">⚙️ Настройки позы</h4>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">
                      Дефолтная поза устанавливается автоматически при смене персонажа
                    </div>
                    <div className="text-xs text-gray-500">
                      Первый ракурс позы будет выбран автоматически
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
