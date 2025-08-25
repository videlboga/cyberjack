'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface ActionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface Action {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  intensity: number;
  cost: number;
  effects: any;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  baseIntensity: number;
  maxIntensity: number;
  effects: any;
  intensityMultiplier: any;
}

interface HierarchicalActionMenuProps {
  actionCategories: Record<string, ActionCategory>;
  toolCategories: Record<string, ToolCategory>;
  actions: Record<string, Action>;
  tools: Record<string, Tool>;
  onActionSelect: (action: Action) => void;
  onToolSelect: (tool: Tool) => void;
  selectedAction?: Action | null;
  selectedTool?: Tool | null;
}

export function HierarchicalActionMenu({
  actionCategories,
  toolCategories,
  actions,
  tools,
  onActionSelect,
  onToolSelect,
  selectedAction,
  selectedTool
}: HierarchicalActionMenuProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryColor = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-100 text-red-800 border-red-200';
      case 'green': return 'bg-green-100 text-green-800 border-green-200';
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'purple': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pink': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionsByCategory = () => {
    const grouped: Record<string, Action[]> = {};
    Object.values(actions).forEach(action => {
      if (!grouped[action.category]) {
        grouped[action.category] = [];
      }
      grouped[action.category].push(action);
    });
    return grouped;
  };

  const getToolsByCategory = () => {
    const grouped: Record<string, Tool[]> = {};
    Object.values(tools).forEach(tool => {
      if (!grouped[tool.category]) {
        grouped[tool.category] = [];
      }
      grouped[tool.category].push(tool);
    });
    return grouped;
  };

  const actionsByCategory = getActionsByCategory();
  const toolsByCategory = getToolsByCategory();

  return (
    <div className="space-y-6">
      {/* Действия */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-cyan-400">🎮 Действия</h3>
        <div className="space-y-2">
          {Object.entries(actionCategories).map(([categoryId, category]) => {
            const categoryActions = actionsByCategory[categoryId] || [];
            const isExpanded = expandedCategories.has(categoryId);
            
            return (
              <Card key={categoryId} className="border border-gray-600 bg-gray-800/50">
                <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{category.icon}</span>
                          <div>
                            <CardTitle className="text-base text-white">{category.name}</CardTitle>
                            <p className="text-sm text-gray-400">{category.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getCategoryColor(category.color)}`}
                          >
                            {categoryActions.length} действий
                          </Badge>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 gap-2">
                        {categoryActions.map((action) => (
                          <TooltipProvider key={action.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={selectedAction?.id === action.id ? "default" : "outline"}
                                  size="sm"
                                  className="h-auto p-3 flex items-center gap-3 justify-start"
                                  onClick={() => onActionSelect(action)}
                                >
                                  <span className="text-lg">{action.icon}</span>
                                  <div className="flex-1 text-left">
                                    <div className="font-medium">{action.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Интенсивность: {action.intensity}/10 | Стоимость: {action.cost} NP
                                    </div>
                                  </div>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div>
                                  <p className="font-medium">{action.description}</p>
                                  <div className="mt-2 text-sm">
                                    <p><strong>Эффекты:</strong></p>
                                    {action.effects.physical && (
                                      <div className="mt-1">
                                        <p className="text-blue-400">Физические:</p>
                                        <ul className="list-disc list-inside ml-2">
                                          {Object.entries(action.effects.physical).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {action.effects.emotional && (
                                      <div className="mt-1">
                                        <p className="text-purple-400">Эмоциональные:</p>
                                        <ul className="list-disc list-inside ml-2">
                                          {Object.entries(action.effects.emotional).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Инструменты */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-cyan-400">🔧 Инструменты</h3>
        <div className="space-y-2">
          {Object.entries(toolCategories).map(([categoryId, category]) => {
            const categoryTools = toolsByCategory[categoryId] || [];
            const isExpanded = expandedCategories.has(categoryId);
            
            return (
              <Card key={categoryId} className="border border-gray-600 bg-gray-800/50">
                <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{category.icon}</span>
                          <div>
                            <CardTitle className="text-base text-white">{category.name}</CardTitle>
                            <p className="text-sm text-gray-400">{category.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getCategoryColor(category.color)}`}
                          >
                            {categoryTools.length} инструментов
                          </Badge>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 gap-2">
                        {categoryTools.map((tool) => (
                          <TooltipProvider key={tool.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={selectedTool?.id === tool.id ? "default" : "outline"}
                                  size="sm"
                                  className="h-auto p-3 flex items-center gap-3 justify-start"
                                  onClick={() => onToolSelect(tool)}
                                >
                                  <span className="text-lg">{tool.icon}</span>
                                  <div className="flex-1 text-left">
                                    <div className="font-medium">{tool.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Мощность: {tool.baseIntensity}-{tool.maxIntensity}/10
                                    </div>
                                  </div>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div>
                                  <p className="font-medium">{tool.description}</p>
                                  <div className="mt-2 text-sm">
                                    <p><strong>Эффекты:</strong></p>
                                    {tool.effects.physical && (
                                      <div className="mt-1">
                                        <p className="text-blue-400">Физические:</p>
                                        <ul className="list-disc list-inside ml-2">
                                          {Object.entries(tool.effects.physical).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {tool.effects.emotional && (
                                      <div className="mt-1">
                                        <p className="text-purple-400">Эмоциональные:</p>
                                        <ul className="list-disc list-inside ml-2">
                                          {Object.entries(tool.effects.emotional).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {tool.intensityMultiplier && (
                                      <div className="mt-1">
                                        <p className="text-yellow-400">Множители интенсивности:</p>
                                        <ul className="list-disc list-inside ml-2">
                                          {Object.entries(tool.intensityMultiplier).map(([key, value]) => (
                                            <li key={key}>{key}: {value}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

