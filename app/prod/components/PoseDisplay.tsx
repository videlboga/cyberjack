'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Star, Zap, Heart, Shield, Target } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface Pose {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: number;
  requirements?: any;
  effects?: any;
  tags?: string[];
}

interface PoseCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface PoseDisplayProps {
  title: string;
  categories: Record<string, PoseCategory>;
  poses: Record<string, Pose>;
  currentPose: string;
  onPoseSelect: (pose: Pose) => void;
}

export function PoseDisplay({
  title,
  categories,
  poses,
  currentPose,
  onPoseSelect
}: PoseDisplayProps) {
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

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-400';
    if (difficulty <= 5) return 'text-yellow-400';
    if (difficulty <= 8) return 'text-orange-400';
    return 'text-red-400';
  };

  const getDifficultyText = (difficulty: number) => {
    if (difficulty <= 2) return 'Легко';
    if (difficulty <= 5) return 'Средне';
    if (difficulty <= 8) return 'Сложно';
    return 'Очень сложно';
  };

  const getPosesByCategory = () => {
    const grouped: Record<string, Pose[]> = {};
    if (poses && typeof poses === 'object') {
      Object.values(poses).forEach(pose => {
        if (!grouped[pose.category]) {
          grouped[pose.category] = [];
        }
        grouped[pose.category].push(pose);
      });
    }
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

  const posesByCategory = getPosesByCategory();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
        🎭 {title}
      </h3>

      <div className="space-y-2">
        {categories && typeof categories === 'object' ? Object.entries(categories).map(([categoryId, category]) => {
          const categoryPoses = posesByCategory[categoryId] || [];
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
                          {categoryPoses.length} поз
                        </Badge>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 gap-2">
                      {categoryPoses.map((pose) => (
                        <TooltipProvider key={pose.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={currentPose === pose.id ? "default" : "outline"}
                                size="sm"
                                className="h-auto p-3 flex items-center gap-3 justify-start hover:bg-gray-700/50"
                                onClick={() => onPoseSelect(pose)}
                              >
                                <span className="text-lg">{pose.icon}</span>
                                <div className="flex-1 text-left">
                                  <div className="font-medium flex items-center gap-2">
                                    {pose.name}
                                    {currentPose === pose.id && (
                                      <Badge variant="secondary" className="text-xs">
                                        Активна
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className={getDifficultyColor(pose.difficulty)}>
                                      {getDifficultyText(pose.difficulty)} ({pose.difficulty}/10)
                                    </span>
                                    {pose.tags && pose.tags.length > 0 && (
                                      <span className="text-cyan-400">
                                        {pose.tags.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  {pose.effects && (
                                    <div className="flex items-center gap-1 mt-1">
                                      {Object.keys(pose.effects).map(effectType => (
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
                                <p className="font-medium">{pose.description}</p>
                                <div className="mt-2 text-sm space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Target className="h-3 w-3 text-orange-400" />
                                    <span className="font-semibold text-orange-400">
                                      Сложность: {pose.difficulty}/10
                                    </span>
                                  </div>
                                  {pose.requirements && (
                                    <div>
                                      <p className="font-semibold text-orange-400">Требования:</p>
                                      <ul className="list-disc list-inside ml-2 text-xs">
                                        {pose.requirements && typeof pose.requirements === 'object' ? Object.entries(pose.requirements).map(([key, value]) => (
                                          <li key={key}>{key}: {value}</li>
                                        )) : null}
                                      </ul>
                                    </div>
                                  )}
                                  {pose.effects && (
                                    <div>
                                      <p className="font-semibold text-cyan-400">Эффекты:</p>
                                      {pose.effects && typeof pose.effects === 'object' ? Object.entries(pose.effects).map(([effectType, effects]) => (
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
                                      )) : null}
                                    </div>
                                  )}
                                  {pose.tags && pose.tags.length > 0 && (
                                    <div>
                                      <p className="font-semibold text-cyan-400">Теги:</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {pose.tags.map(tag => (
                                          <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
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
        }) : null}
      </div>
    </div>
  );
}
