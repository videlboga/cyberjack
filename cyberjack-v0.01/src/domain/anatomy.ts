export type Gender = 'male' | 'female' | 'androgynous';
export type AnatomyMod = 'none' | 'amputee_left_arm' | 'amputee_right_leg' | 'cyber_implant_arm' | 'cyber_implant_eyes';

export interface AnatomyPointDef {
    id: string;
    label: string;
    sens: number;
    att: number;
    providesFunctions?: string[];
    tags?: string[];
    parentId?: string;
}

export function getBaseHumanAnatomy(gender: Gender, mod: AnatomyMod = 'none'): AnatomyPointDef[] {
    const points: AnatomyPointDef[] = [
        { id: 'posture', label: 'Поза (Текущее положение тела)', sens: 0, att: 50 },
        { id: 'mind_state', label: 'Психика/Разум', sens: 0, att: 50 },
        
        { id: 'head', label: 'Голова/Волосы', sens: 30, att: 70, providesFunctions: ['look', 'hear'] },
        { id: 'face', label: 'Лицо', sens: 60, att: 40, parentId: 'head' },
        { id: 'lips', label: 'Губы', sens: 85, att: 20, providesFunctions: ['speak', 'kiss', 'eat'], parentId: 'face' },
        { id: 'neck', label: 'Шея', sens: 80, att: 30 },
        
        { id: 'shoulders', label: 'Плечи', sens: 30, att: 80 },
        { id: 'chest', label: gender === 'female' ? 'Грудь (Молочные железы)' : 'Грудь', sens: gender === 'female' ? 85 : 60, att: 30 },
        { id: 'nipples', label: 'Соски', sens: 95, att: 10, parentId: 'chest' },
        { id: 'belly', label: 'Живот', sens: 50, att: 40 },
        { id: 'back', label: 'Спина', sens: 40, att: 60, providesFunctions: ['stabilize_posture'] },
        { id: 'waist', label: 'Талия', sens: 65, att: 45 },
        
        { id: 'arms', label: 'Руки', sens: 20, att: 90, providesFunctions: ['reach'] },
        { id: 'hands', label: 'Кисти', sens: 70, att: 85, providesFunctions: ['touch', 'manipulate'], parentId: 'arms' },
        
        { id: 'inner_thighs', label: 'Внутренняя сторона бедер', sens: 85, att: 10 },
        { id: 'legs', label: 'Ноги', sens: 25, att: 75, providesFunctions: ['walk'] },
        { id: 'knees', label: 'Колени', sens: 20, att: 70, providesFunctions: ['kneel', 'stand', 'shift_posture'] },
        { id: 'feet', label: 'Ступни', sens: 75, att: 50, providesFunctions: ['stand'] },
        
        { id: 'buttocks', label: 'Ягодицы', sens: 50, att: 15 },
        { id: 'anus', label: 'Анус', sens: 100, att: 5, parentId: 'buttocks' }
    ];

    if (gender === 'male' || gender === 'androgynous') {
        points.push({ id: 'groin', label: 'Пах', sens: 90, att: 10 });
        points.push({ id: 'penis', label: 'Член', sens: 100, att: 5, parentId: 'groin' });
        points.push({ id: 'testicles', label: 'Яички', sens: 100, att: 5, parentId: 'groin' });
        points.push({ id: 'prostate', label: 'Простата', sens: 100, att: 5, parentId: 'anus' });
    }
    if (gender === 'female' || gender === 'androgynous') {
        points.push({ id: 'vulva', label: 'Вульва', sens: 95, att: 5 });
        points.push({ id: 'vagina', label: 'Влагалище', sens: 100, att: 5, parentId: 'vulva' });
        points.push({ id: 'clitoris', label: 'Клитор', sens: 100, att: 5, parentId: 'vulva' });
    }

    if (mod === 'amputee_left_arm') {
        return points.filter(p => !['left_arm', 'left_hand'].includes(p.id));
    }
    if (mod === 'cyber_implant_arm') {
        const arm = points.find(p => p.id === 'right_arm');
        if (arm) {
            arm.label = 'Кибернетическая правая рука';
            arm.sens = 10;
            arm.att = 95;
            arm.tags = ['cybernetic', 'metal', 'durable'];
        }
        const hand = points.find(p => p.id === 'right_hand');
        if (hand) {
            hand.label = 'Кибер-кисть';
            hand.sens = 10;
        }
    }

    // Добавляем сервисные технические слоты, если они нужны движку
    points.push(
        
        { id: 'slot_room', label: 'Слот: Окружение (Комната)', sens: 50, att: 50 },
        { id: 'slot_social', label: 'Слот: Социальное', sens: 50, att: 50 },
        { id: 'systemic', label: 'Организм (Системное)', sens: 50, att: 50 }
    );

    return points;
}
