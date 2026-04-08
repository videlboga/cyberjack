import { CharacterProfile, Status, CharacterPersonality } from '../domain/characterProfile.js';
import { Gender, AnatomyMod } from '../domain/anatomy.js';
import { CANON_FACTIONS, CANON_LOCATIONS, CANON_PROFESSIONS, CANON_TRAUMAS, CANON_KNOWLEDGE, CANON_PERSONALITY } from '../domain/canon.js';

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomGender(): Gender {
    const genders: Gender[] = ['male', 'female', 'androgynous'];
    return pickRandom(genders);
}

function getRandomMod(): AnatomyMod {
    const mods: AnatomyMod[] = ['none', 'none', 'none', 'amputee_left_arm', 'amputee_right_leg', 'cyber_implant_arm', 'cyber_implant_eyes'];
    return pickRandom(mods);
}

export function generateRandomCharacter(name: string, forceRole?: 'calibrator' | 'asset' | 'researcher'): CharacterProfile {
    const gender = getRandomGender();
    const anatomy = getRandomMod();
    const age = Math.floor(Math.random() * 40) + 18;

    const birthplace = pickRandom(CANON_LOCATIONS);
    
    let profession = pickRandom(CANON_PROFESSIONS);
    if (forceRole) {
        profession = CANON_PROFESSIONS.find(p => p.id === `prof_${forceRole}`) || profession;
    }

    let status: Status = 'observer';
    if (profession.id === 'prof_asset') status = 'asset';
    if (profession.id === 'prof_calibrator') status = 'calibrator';
    if (profession.id === 'prof_researcher' || profession.id === 'prof_cultist') status = 'assistant';

    const trauma = Math.random() > 0.5 ? pickRandom(CANON_TRAUMAS) : undefined;
    const faction = pickRandom(CANON_FACTIONS);

    const traits = [pickRandom(CANON_PERSONALITY.traits), pickRandom(CANON_PERSONALITY.traits)].filter((v, i, a) => a.indexOf(v) === i);
    const quirks = [pickRandom(CANON_PERSONALITY.quirks)];
    const speechStyle = pickRandom(CANON_PERSONALITY.speechStyles);
    const coreBelief = pickRandom(CANON_PERSONALITY.coreBeliefs);

    const personality: CharacterPersonality = {
        traits,
        quirks,
        speechStyle,
        coreBelief
    };

    const biography = `${name} (${age} лет) родился(ась) в зоне: ${birthplace.name}. Текущая профессия: ${profession.name}, статус: ${status}. Судьба привела к взаимодействию с фракцией "${faction.name}". ` +
                      (trauma ? `В прошлом пережил(а): ${trauma}. ` : `Жизнь протекала без фатальных сбоев, насколько это возможно на Станции. `) +
                      `Главное убеждение: "${coreBelief}". ${personality.traits.join(', ')} — так его(ее) характеризуют, отмеченная привычка: ${quirks[0]}. ${speechStyle}`;

    // Компактный и жесткий стержень лора про станцию и аномалию, понятный нейросети
    const CORE_SETTING = "Базовая реальность мира: Мы находимся на огромной изолированной космической станции, окруженной 'Аномалией' — пространством, реагирующим на сильные чувства. Общество строится вокруг жестокого изучения Аномалии: корпорации, ученые и технокульты искусственно вызывают экстремальные эмоции (боль, экстаз, ужас) у особых сломленных людей - 'Активов'.";

    const selectedCommon = [CORE_SETTING, pickRandom(CANON_KNOWLEDGE.common)];
    const selectedSecret = Math.random() > 0.8 ? [pickRandom(CANON_KNOWLEDGE.secrets)] : [];

    const personal = [
        `Я родом из: ${birthplace.name}.`,
        `Моя роль: ${profession.name}. ${profession.description}`,
        `Моя фракция: ${faction.name}.`,
    ];

    if (trauma) {
        personal.push(`Травма в прошлом: ${trauma}.`);
    }

    const profile: CharacterProfile = {
        base: {
            name,
            age,
            gender,
            anatomy,
            status
        },
        origin: {
            birthplaceId: birthplace.id,
            professionId: profession.id,
            coreTrauma: trauma,
            biography
        },
        personality,
        knowledge: {
            common: selectedCommon,
            personal: personal,
            secrets: selectedSecret
        },
        memory: {
            knownCharacters: {},
            scars: trauma ? [trauma] : []
        }
    };

    return profile;
}
