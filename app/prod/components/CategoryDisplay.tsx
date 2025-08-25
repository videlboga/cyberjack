'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Star, Zap, Heart, Shield } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface CategoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  intensity?: number;
  cost?: number;
  baseIntensity?: number;
  maxIntensity?: number;
  effects?: any;
  intensityMultiplier?: any;
  requirements?: any;
  cooldown?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface CategoryDisplayProps {
  title: string;
  categories: Record<string, Category>;
  items: Record<string, CategoryItem>;
  onItemSelect: (item: CategoryItem) => void;
  selectedItem?: CategoryItem | null;
  itemType: 'action' | 'tool';
}

export function CategoryDisplay({
  title,
  categories,
  items,
  onItemSelect,
  selectedItem,
  itemType
}: CategoryDisplayProps) {
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
      case 'cyan': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getItemsByCategory = () => {
    const grouped: Record<string, CategoryItem[]> = {};
    Object.values(items).forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  };

  const getEffectIcon = (effectType: string) => {
    switch (effectType) {
      case 'physical': return <Zap className="h-3 w-3 text-blue-400" />;
      case 'emotional': return <Heart className="h-3 w-3 text-purple-400" />;
      case 'fetish': return <Star className="h-3 w-3 text-yellow-400" />;
      case 'safety': return <Shield className="h-3 w-3 text-green-400" />;
      default: return <Zap className="h-3 w-3 text-gray-400" />;
    }
  };

  const itemsByCategory = getItemsByCategory();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
        {itemType === 'action' ? '🎮' : '🔧'} {title}
      </h3>
      
      <div className="space-y-2">
        {Object.entries(categories).map(([categoryId, category]) => {
          const categoryItems = itemsByCategory[categoryId] || [];
          const isExpanded = expandedCategories.has(categoryId);
          
          return (
            <Card key={categoryId} className="border border-gray-600 bg-gray-800/50 hover:border-gray-500 transition-colors">
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
                          {categoryItems.length} {itemType === 'action' ? 'действий' : 'инструментов'}
                        </Badge>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 gap-2">
                      {categoryItems.map((item) => (
                        <TooltipProvider key={item.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={selectedItem?.id === item.id ? "default" : "outline"}
                                size="sm"
                                className="h-auto p-3 flex items-center gap-3 justify-start hover:bg-gray-700/50"
                                onClick={() => onItemSelect(item)}
                              >
                                <span className="text-lg">{item.icon}</span>
                                <div className="flex-1 text-left">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    {itemType === 'action' ? (
                                      <>
                                        <span>Интенсивность: {item.intensity}/10</span>
                                        {item.cost && <span>Стоимость: {item.cost} NP</span>}
                                      </>
                                    ) : (
                                      <>
                                        <span>Мощность: {item.baseIntensity}-{item.maxIntensity}/10</span>
                                        {item.cooldown && <span>Кулдаун: {item.cooldown}с</span>}
                                      </>
                                    )}
                                  </div>
                                  {item.effects && (
                                    <div className="flex items-center gap-1 mt-1">
                                      {Object.keys(item.effects).map(effectType => (
                                        <span key={effectType} title={effectType}>
                                          {getEffectIcon(effectType)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div>
                                <p className="font-medium">{item.description}</p>
                                <div className="mt-2 text-sm space-y-2">
                                  {item.effects && (
                                    <div>
                                      <p className="font-semibold text-cyan-400">Эффекты:</p>
                                      {Object.entries(item.effects).map(([effectType, effects]) => (
                                        <div key={effectType} className="mt-1">
                                          <div className="flex items-center gap-1 text-xs font-medium">
                                            {getEffectIcon(effectType)}
                                            <span className="capitalize">{effectType}:</span>
                                          </div>
                                          <ul className="list-disc list-inside ml-4 text-xs">
                                            {Object.entries(effects as any).map(([key, value]) => (
                                              <li key={key}>{key}: {value}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {item.requirements && (
                                    <div>
                                      <p className="font-semibold text-orange-400">Требования:</p>
                                      <ul className="list-disc list-inside ml-2 text-xs">
                                        {Object.entries(item.requirements).map(([key, value]) => (
                                          <li key={key}>{key}: {value}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {item.intensityMultiplier && (
                                    <div>
                                      <p className="font-semibold text-yellow-400">Множители:</p>
                                      <ul className="list-disc list-inside ml-2 text-xs">
                                        {Object.entries(item.intensityMultiplier).map(([key, value]) => (
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
  );
}

