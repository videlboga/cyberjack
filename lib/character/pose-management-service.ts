import { Pose, PoseChangeCondition, InteractiveAction, InteractiveTool, PoseAngle, ActiveZone } from '../unified-entities';

export class PoseManagementService {
  private poses: { [key: string]: Pose } = {};
  private poseChangeConditions: { [key: string]: PoseChangeCondition } = {};
  private actions: { [key: string]: InteractiveAction } = {};
  private tools: { [key: string]: InteractiveTool } = {};

  constructor(
    poses: { [key: string]: Pose },
    poseChangeConditions: { [key: string]: PoseChangeCondition },
    actions: { [key: string]: InteractiveAction },
    tools: { [key: string]: InteractiveTool }
  ) {
    // Проверяем на дублирование поз
    const poseIds = Object.keys(poses);
    const uniquePoseIds = new Set(poseIds);
    if (uniquePoseIds.size !== poseIds.length) {
      console.warn('⚠️ Обнаружено дублирование ID поз в PoseManagementService:', {
        total: poseIds.length,
        unique: uniquePoseIds.size,
        duplicates: poseIds.filter((id, index) => poseIds.indexOf(id) !== index)
      });
    }
    
    // Проверяем на дублирование имен поз
    const poseNames = Object.values(poses).map(pose => pose.name);
    const uniquePoseNames = new Set(poseNames);
    if (uniquePoseNames.size !== poseNames.length) {
      console.warn('⚠️ Обнаружено дублирование имен поз в PoseManagementService:', {
        total: poseNames.length,
        unique: uniquePoseNames.size,
        duplicates: poseNames.filter((name, index) => poseNames.indexOf(name) !== index)
      });
    }
    
    this.poses = poses;
    this.poseChangeConditions = poseChangeConditions;
    this.actions = actions;
    this.tools = tools;
    
    console.log('🎭 PoseManagementService инициализирован с позами:', {
      count: Object.keys(poses).length,
      ids: Object.keys(poses),
      names: Object.values(poses).map(pose => pose.name)
    });
  }

  /**
   * Проверяет все условия смены позы и возвращает подходящие
   */
  checkPoseChangeConditions(
    currentPose: string,
    characterStates: { [key: string]: number },
    characterAttributes: { [key: string]: number },
    activeFetishes: { [key: string]: number },
    userActions: string[],
    environment: {
      equipment: string[];
      location: string;
      privacy: 'public' | 'private' | 'intimate';
    }
  ): Array<{
    condition: PoseChangeCondition;
    probability: number;
    reason: string;
  }> {
    const validConditions: Array<{
      condition: PoseChangeCondition;
      probability: number;
      reason: string;
    }> = [];

    for (const [conditionId, condition] of Object.entries(this.poseChangeConditions)) {
      const isMet = this.evaluateCondition(condition, {
        characterStates,
        characterAttributes,
        activeFetishes,
        userActions,
        environment
      });

      if (isMet) {
        const probability = this.calculateConditionProbability(condition, {
          characterStates,
          characterAttributes,
          activeFetishes
        });

        validConditions.push({
          condition,
          probability,
          reason: this.generateConditionReason(condition, {
            characterStates,
            characterAttributes,
            activeFetishes
          })
        });
      }
    }

    // Сортируем по приоритету и вероятности
    return validConditions.sort((a, b) => {
      // Сначала по типу (автоматические имеют приоритет)
      const typePriority = { automatic: 3, command: 2, trust: 1, fear: 1, obedience: 1, pleasure: 1, pain: 1 };
      const aPriority = typePriority[a.condition.type as keyof typeof typePriority] || 0;
      const bPriority = typePriority[b.condition.type as keyof typeof typePriority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Затем по вероятности
      return b.probability - a.probability;
    });
  }

  /**
   * Выполняет смену позы
   */
  executePoseChange(
    targetPoseId: string,
    characterStates: { [key: string]: number },
    characterAttributes: { [key: string]: number }
  ): {
    success: boolean;
    newPose: Pose | null;
    effects: { [key: string]: number };
    message: string;
  } {
    const targetPose = this.poses[targetPoseId];
    
    if (!targetPose) {
      return {
        success: false,
        newPose: null,
        effects: {},
        message: "Такой позы не существует"
      };
    }

    // Проверяем требования для позы
    const requirementsMet = this.checkPoseRequirements(targetPose, characterAttributes);
    
    if (!requirementsMet.met) {
      return {
        success: false,
        newPose: null,
        effects: {},
        message: requirementsMet.message
      };
    }

    // Применяем эффекты позы
    const effects = this.calculatePoseEffects(targetPose, characterStates, characterAttributes);

    return {
      success: true,
      newPose: targetPose,
      effects,
      message: `Принимаю позу: ${targetPose.name}`
    };
  }

  /**
   * Проверяет требования для позы
   */
  private checkPoseRequirements(
    pose: Pose,
    characterAttributes: { [key: string]: number }
  ): { met: boolean; message: string } {
    const requirements = pose.requirements;

    if (requirements.flexibility && characterAttributes.flexibility < requirements.flexibility) {
      return {
        met: false,
        message: `Мне не хватает гибкости для этой позы (нужно: ${requirements.flexibility}, у меня: ${characterAttributes.flexibility})`
      };
    }

    if (requirements.strength && characterAttributes.strength < requirements.strength) {
      return {
        met: false,
        message: `Мне не хватает сил для этой позы (нужно: ${requirements.strength}, у меня: ${characterAttributes.strength})`
      };
    }

    return { met: true, message: "Требования выполнены" };
  }

  /**
   * Вычисляет эффекты позы
   */
  private calculatePoseEffects(
    pose: Pose,
    characterStates: { [key: string]: number },
    characterAttributes: { [key: string]: number }
  ): { [key: string]: number } {
    const effects: { [key: string]: number } = {};

    // Применяем физические эффекты
    if (pose.effects.physical) {
      for (const [key, value] of Object.entries(pose.effects.physical)) {
        effects[key] = (effects[key] || 0) + value;
      }
    }

    // Применяем эмоциональные эффекты
    if (pose.effects.emotional) {
      for (const [key, value] of Object.entries(pose.effects.emotional)) {
        effects[key] = (effects[key] || 0) + value;
      }
    }

    // Применяем эффекты фетишей
    if (pose.effects.fetish) {
      for (const [key, value] of Object.entries(pose.effects.fetish)) {
        effects[`fetish_${key}`] = (effects[`fetish_${key}`] || 0) + value;
      }
    }

    return effects;
  }

  /**
   * Оценивает условие смены позы
   */
  private evaluateCondition(
    condition: PoseChangeCondition,
    context: {
      characterStates: { [key: string]: number };
      characterAttributes: { [key: string]: number };
      activeFetishes: { [key: string]: number };
      userActions: string[];
    environment: {
        equipment: string[];
        location: string;
        privacy: 'public' | 'private' | 'intimate';
      };
    }
  ): boolean {
    const { characterStates, characterAttributes, activeFetishes, userActions, environment } = context;

    // Проверяем условия на атрибуты
    if (condition.conditions.attributes) {
      for (const [attr, condition] of Object.entries(condition.conditions.attributes)) {
        const currentValue = characterAttributes[attr] || 0;
        if (!this.evaluateComparison(currentValue, condition.operator, condition.value)) {
          return false;
        }
      }
    }

    // Проверяем условия на состояния
    if (condition.conditions.states) {
      for (const [state, condition] of Object.entries(condition.conditions.states)) {
        const currentValue = characterStates[state] || 0;
        if (!this.evaluateComparison(currentValue, condition.operator, condition.value)) {
          return false;
        }
      }
    }

    // Проверяем условия на фетиши
    if (condition.conditions.fetishes) {
      const fetishConditions = condition.conditions.fetishes;
      
      if (fetishConditions.active) {
        const hasActiveFetish = fetishConditions.active.some(fetish => 
          activeFetishes[fetish] && activeFetishes[fetish] > 0.3
        );
        if (!hasActiveFetish) {
          return false;
        }
      }

      if (fetishConditions.intensity) {
        for (const [fetish, minIntensity] of Object.entries(fetishConditions.intensity)) {
          const currentIntensity = activeFetishes[fetish] || 0;
          if (currentIntensity < minIntensity) {
            return false;
          }
        }
      }
    }

    // Проверяем условия на отношения
    if (condition.conditions.relationship) {
      const relationshipConditions = condition.conditions.relationship;
      
      if (relationshipConditions.trustLevel) {
        const trustValue = characterStates.trust || 0;
        if (!this.evaluateComparison(trustValue, relationshipConditions.trustLevel.operator, relationshipConditions.trustLevel.value)) {
          return false;
        }
      }

      if (relationshipConditions.relationshipLevel) {
        const relationshipValue = characterStates.relationship || 0;
        if (!this.evaluateComparison(relationshipValue, relationshipConditions.relationshipLevel.operator, relationshipConditions.relationshipLevel.value)) {
          return false;
        }
      }
    }

    // Проверяем условия на действия пользователя
    if (condition.conditions.userActions) {
      const userActionConditions = condition.conditions.userActions;
      
      if (userActionConditions.recentActions) {
        const hasRecentAction = userActionConditions.recentActions.some(action => 
          userActions.includes(action)
        );
        if (!hasRecentAction) {
          return false;
        }
      }

      if (userActionConditions.actionIntensity !== undefined) {
        // Здесь можно добавить логику для оценки интенсивности действий
        // Пока просто проверяем наличие действий
        if (userActions.length < userActionConditions.actionIntensity) {
          return false;
        }
      }
    }

    // Проверяем условия на окружение
    if (condition.conditions.environment) {
      const envConditions = condition.conditions.environment;
      
      if (envConditions.equipment) {
        const hasRequiredEquipment = envConditions.equipment.some(equipment => 
          environment.equipment.includes(equipment)
        );
        if (!hasRequiredEquipment) {
          return false;
        }
      }

      if (envConditions.location && environment.location !== envConditions.location) {
        return false;
      }

      if (envConditions.privacy && environment.privacy !== envConditions.privacy) {
        return false;
      }
    }

    return true;
  }

  /**
   * Вычисляет вероятность срабатывания условия
   */
  private calculateConditionProbability(
    condition: PoseChangeCondition,
    context: {
      characterStates: { [key: string]: number };
      characterAttributes: { [key: string]: number };
      activeFetishes: { [key: string]: number };
    }
  ): number {
    let baseProbability = condition.probability;

    // Модифицируем вероятность на основе состояний
    const { characterStates, characterAttributes, activeFetishes } = context;

    // Если это условие страха, увеличиваем вероятность при высоком страхе
    if (condition.type === 'fear' && characterStates.fear > 70) {
      baseProbability *= 1.5;
    }

    // Если это условие доверия, увеличиваем вероятность при высоком доверии
    if (condition.type === 'trust' && characterStates.trust > 70) {
      baseProbability *= 1.3;
    }

    // Если это условие удовольствия, увеличиваем вероятность при высоком удовольствии
    if (condition.type === 'pleasure' && characterStates.pleasure > 70) {
      baseProbability *= 1.4;
    }

    // Ограничиваем вероятность от 0 до 1
    return Math.min(Math.max(baseProbability, 0), 1);
  }

  /**
   * Генерирует объяснение причины смены позы
   */
  private generateConditionReason(
    condition: PoseChangeCondition,
    context: {
      characterStates: { [key: string]: number };
      characterAttributes: { [key: string]: number };
      activeFetishes: { [key: string]: number };
    }
  ): string {
    const { characterStates, characterAttributes, activeFetishes } = context;

    switch (condition.type) {
      case 'automatic':
        if (characterStates.fear > 80) {
          return "От страха я автоматически принимаю покорную позу";
        }
        if (characterStates.pleasure > 75) {
          return "От удовольствия я расслабляюсь и открываюсь";
        }
        return "Автоматически меняю позу в соответствии с ситуацией";

      case 'command':
        return "Выполняю вашу команду";

      case 'trust':
        return "Доверяю вам настолько, что готова быть уязвимой";

      case 'fear':
        return "От страха я подчиняюсь и принимаю покорную позу";

      case 'obedience':
        return "Мое подчинение заставляет меня принять эту позу";

      case 'pleasure':
        return "От удовольствия я не могу сопротивляться";

      case 'pain':
        return "От боли я вынуждена принять эту позу";

      default:
        return "Меняю позу по внутренним причинам";
    }
  }

  /**
   * Выполняет сравнение значений
   */
  private evaluateComparison(
    currentValue: number,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    targetValue: number
  ): boolean {
    switch (operator) {
      case '==':
        return Math.abs(currentValue - targetValue) < 0.1;
      case '!=':
        return Math.abs(currentValue - targetValue) >= 0.1;
      case '>':
        return currentValue > targetValue;
      case '<':
        return currentValue < targetValue;
      case '>=':
        return currentValue >= targetValue;
      case '<=':
        return currentValue <= targetValue;
      default:
        return false;
    }
  }

  /**
   * Получает доступные позы для персонажа
   */
  getAvailablePoses(
    characterAttributes: { [key: string]: number },
    characterStates: { [key: string]: number },
    equipment: string[]
  ): Pose[] {
    return Object.values(this.poses).filter(pose => {
      const requirementsMet = this.checkPoseRequirements(pose, characterAttributes);
      return requirementsMet.met;
    });
  }

  /**
   * Получает позу по ID
   */
  getPose(poseId: string): Pose | null {
    return this.poses[poseId] || null;
  }

  /**
   * Получает все позы
   */
  getAllPoses(): { [key: string]: Pose } {
    return { ...this.poses };
  }

  /**
   * Получает условия смены позы по типу
   */
  getConditionsByType(type: string): PoseChangeCondition[] {
    return Object.values(this.poseChangeConditions).filter(condition => condition.type === type);
  }

  /**
   * Получает доступные ракурсы для позы
   */
  getPoseAngles(poseId: string): PoseAngle[] {
    const pose = this.poses[poseId];
    return pose?.angles || [];
  }

  /**
   * Получает ракурс по ID
   */
  getPoseAngle(poseId: string, angleId: string): PoseAngle | null {
    const pose = this.poses[poseId];
    return pose?.angles.find(angle => angle.id === angleId) || null;
  }

  /**
   * Получает активные зоны для ракурса
   */
  getActiveZones(poseId: string, angleId: string): ActiveZone[] {
    const angle = this.getPoseAngle(poseId, angleId);
    return angle?.activeZones || [];
  }

  /**
   * Получает активную зону по ID
   */
  getActiveZone(poseId: string, angleId: string, zoneId: string): ActiveZone | null {
    const zones = this.getActiveZones(poseId, angleId);
    return zones.find(zone => zone.id === zoneId) || null;
  }

  /**
   * Проверяет доступность ракурса для персонажа
   */
  isAngleAvailable(poseId: string, angleId: string, characterAttributes: { [key: string]: number }, equipment: string[]): boolean {
    const angle = this.getPoseAngle(poseId, angleId);
    if (!angle) return false;

    // Проверяем требования к характеристикам
    if (angle.requirements?.attributes) {
      for (const [attr, requiredValue] of Object.entries(angle.requirements.attributes)) {
        if ((characterAttributes[attr] || 0) < requiredValue) {
          return false;
        }
      }
    }

    // Проверяем требования к оборудованию
    if (angle.requirements?.equipment) {
      const hasRequiredEquipment = angle.requirements.equipment.every(eq =>
        equipment.includes(eq)
      );
      if (!hasRequiredEquipment) {
        return false;
      }
    }

    return true;
  }

  /**
   * Получает доступные ракурсы для позы и персонажа
   */
  getAvailableAngles(poseId: string, characterAttributes: { [key: string]: number }, equipment: string[]): PoseAngle[] {
    const pose = this.poses[poseId];
    if (!pose) return [];

    return pose.angles.filter(angle =>
      this.isAngleAvailable(poseId, angle.id, characterAttributes, equipment)
    );
  }

  /**
   * Получает доступные активные зоны для ракурса и персонажа
   */
  getAvailableActiveZones(poseId: string, angleId: string, characterAttributes: { [key: string]: number }, characterStates: { [key: string]: number }, equipment: string[]): ActiveZone[] {
    const zones = this.getActiveZones(poseId, angleId);
    return zones.filter(zone => {
      // Проверяем требования к характеристикам
      if (zone.requirements?.attributes) {
        for (const [attr, requiredValue] of Object.entries(zone.requirements.attributes)) {
          if ((characterAttributes[attr] || 0) < requiredValue) {
            return false;
          }
        }
      }

      // Проверяем требования к состояниям
      if (zone.requirements?.states) {
        for (const [state, requiredValue] of Object.entries(zone.requirements.states)) {
          if ((characterStates[state] || 0) < requiredValue) {
            return false;
          }
        }
      }

      // Проверяем требования к оборудованию
      if (zone.requirements?.equipment) {
        const hasRequiredEquipment = zone.requirements.equipment.every(eq =>
          equipment.includes(eq)
        );
        if (!hasRequiredEquipment) {
          return false;
        }
      }

      return true;
    });
  }
}
