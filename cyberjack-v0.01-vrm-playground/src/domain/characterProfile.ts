import { Gender, AnatomyMod } from './anatomy.js';

export type Status = 'asset' | 'calibrator' | 'assistant' | 'observer';

export interface CharacterBase {
    name: string;
    age: number;
    gender: Gender;
    anatomy: AnatomyMod;
    status: Status;
}

export interface CharacterOrigin {
    birthplaceId: string; // tag id from lore
    professionId: string; // tag id from lore
    coreTrauma?: string;
    biography: string; // Связный текст-описание прошлого
}

export interface CharacterPersonality {
    traits: string[]; // ['Параноик', 'Жестокий', 'Верный']
    quirks: string[]; // ['Постоянно оглядывается', 'Щелкает пальцами']
    speechStyle: string; // 'Короткие рубленые фразы, холодный тон'
    coreBelief: string; // 'Доверять можно только себе и своей Фракции'
}

export interface KnowledgeBase {
    common: string[];
    personal: string[];
    secrets: string[];
}

export interface DynamicMemory {
    knownCharacters: Record<string, string>;
    scars: string[];
}

export interface CharacterProfile {
    base: CharacterBase;
    origin: CharacterOrigin;
    personality: CharacterPersonality;
    knowledge: KnowledgeBase;
    memory: DynamicMemory;
}
