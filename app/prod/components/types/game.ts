// Основные типы для игры
export interface Talent {
  id: string;
  name: string;
  role: string;
  level: number;
  attributes: {
    strength: number;
    empathy: number;
    intelligence: number;
    creativity: number;
    temperament: number;
    endurance: number;
    sensitivity: number;
    flexibility: number;
    emotionalStability: number;
    adaptability: number;
    sociability: number;
    dominance: number;
    selfEsteem: number;
    optimism: number;
    curiosity: number;
    engagement: number;
    entitlement: number;
    insight: number;
    routine: number;
    compliance: number;
    neuroplasticity: number;
    cognitiveLoad: number;
  };
  skills: { [key: string]: number };
  states: { [key: string]: number };
  statusEffects: StatusEffect[];
  memories: string[];
  experience: number;
  equippedItems: Equipment[];
  inventory: Equipment[];
  affinities: { [key: string]: number };
  stressors: { [key: string]: number };
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  slot: string;
  rarity: string;
  enabled: boolean;
  targetTalents?: string[];
  settings: {
    powerLevel: number;
    mode: string;
    restrictions: string[];
  };
  effects: { [key: string]: number };
  requirements: { [key: string]: number };
  description: string;
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  type: 'buff' | 'debuff';
  duration: number;
  effects: { [key: string]: number };
}

export interface GameConfig {
  assets: { assets: Talent[] };
  equipment: { equipment: Equipment[] };
  users: { users: User[] };
  contracts: { available: any[] };
  events: { events: any[] };
  actions: { categories: { [key: string]: any } };
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  created: string;
  lastLogin: string;
  account: {
    balance: number;
    currency: string;
    transactions: any[];
  };
  characters: string[];
  assets: string[];
  userEquipment: string[];
  characterKnowledge?: { [characterId: string]: any };
}

export interface GameAction {
  id: string;
  name: string;
  description: string;
  cost: number;
  effects: { [key: string]: number };
  requirements: { [key: string]: number };
  category: string;
}






