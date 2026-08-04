import { randomUUID } from 'crypto';
import { db } from '../infrastructure/db';
import {
    directorSignalRepo,
    eventOpportunityRepo,
    EventOpportunity,
    storyThreadRepo,
    worldFactRepo,
} from '../infrastructure/eventDirectorRepo';
import { contractRepo } from '../infrastructure/contractRepo';
import { SubjectCoreState } from '../domain/types';

const PROMISE_TEMPLATE = 'promise_follow_up_v1';
const METRIC_CONTRACT_TEMPLATE = 'metric_contract_offer_v1';
const SUPPLY_LOT_TEMPLATE = 'supply_lot_offer_v1';
const SUPPLY_TAIL_TEMPLATE = 'supply_origin_tail_v1';

const worldMinute = () => Number(
    (db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0
);

const characterName = (id?:string) => {
    if (!id) return 'Персонаж';
    return String((db.prepare(`SELECT name FROM characters WHERE id = ?`).get(id) as any)?.name || id);
};

export function emitPromiseCreated(input:{
    memoryId:number;
    subjectId:string;
    relatedSubjectId:string;
    owner:'character' | 'other';
    content:string;
    importance:number;
}) {
    const now = worldMinute();
    const sourceId = String(input.memoryId);
    const signalId = `signal:social_memory:${sourceId}:promise_created`;
    if (!directorSignalRepo.claim({
        id:signalId,
        type:'social_memory_created',
        sourceType:'social_memory',
        sourceId,
        payload:input,
        worldMinute:now,
    })) return null;

    const existing = storyThreadRepo.findBySource('social_memory', sourceId);
    const threadId = existing?.id || `thread:${randomUUID()}`;
    storyThreadRepo.save(existing || {
        id:threadId,
        type:'promise',
        title:`Незавершённое обещание: ${characterName(input.subjectId)}`,
        status:'open',
        stage:'seed',
        subjectId:input.subjectId,
        relatedCharacterIds:[input.relatedSubjectId],
        facts:[input.content],
        tags:['promise','conversation'],
        tension:.2,
        importance:Math.max(.5, input.importance),
        visibility:'known',
        sourceType:'social_memory',
        sourceId,
        createdMinute:now,
        updatedMinute:now,
        metadata:{ owner:input.owner, memoryId:input.memoryId },
    });

    const event:EventOpportunity = {
        id:`opportunity:${randomUUID()}`,
        templateId:PROMISE_TEMPLATE,
        status:'available',
        channel:'inbox',
        priority:Math.max(.5, input.importance),
        urgency:0,
        subjectId:input.subjectId,
        actorIds:[input.subjectId, input.relatedSubjectId],
        threadIds:[threadId],
        availableFrom:now + 30,
        expiresAt:now + 3 * 1440,
        payload:{
            memoryId:input.memoryId,
            owner:input.owner,
            promise:input.content,
            subjectName:characterName(input.subjectId),
        },
        sourceEventId:input.memoryId,
    };
    eventOpportunityRepo.save(event);
    return event;
}

const metricDefinitions = {
    sensitivity:{ label:'чувствительность', factionId:'fac_veil', factionName:'Veil Biotech' },
    plasticity:{ label:'пластичность', factionId:'fac_continuum', factionName:'Continuum Archive' },
    openness:{ label:'открытость', factionId:'fac_helix', factionName:'Helix Dynamics' },
    attitude:{ label:'принятие', factionId:'fac_helix', factionName:'Helix Dynamics' },
} as const;

const crossedThreshold = (before:number, after:number) =>
    [60, 75, 100, 150, 200, 300].find(threshold => before < threshold && after >= threshold);

export function emitSubjectMetricChanges(input:{
    tickId:string;
    subjectId:string;
    before:SubjectCoreState;
    after:SubjectCoreState;
}) {
    const now = worldMinute();
    const created:EventOpportunity[] = [];
    const values = {
        sensitivity:[
            input.before.baselineSensitivity ?? input.before.sensitivity,
            input.after.baselineSensitivity ?? input.after.sensitivity,
        ],
        plasticity:[
            input.before.baselinePlasticity ?? input.before.plasticity,
            input.after.baselinePlasticity ?? input.after.plasticity,
        ],
        openness:[
            input.before.baselineOpenness ?? input.before.openness,
            input.after.baselineOpenness ?? input.after.openness,
        ],
        attitude:[
            input.before.baselineAttitude ?? input.before.attitude,
            input.after.baselineAttitude ?? input.after.attitude,
        ],
    } as const;

    for (const [metric, pair] of Object.entries(values) as Array<[keyof typeof values, readonly [number,number]]>) {
        const threshold = crossedThreshold(Number(pair[0]), Number(pair[1]));
        if (!threshold) continue;
        const definition = metricDefinitions[metric];
        const sourceId = `${input.subjectId}:${metric}:${threshold}`;
        if (!directorSignalRepo.claim({
            id:`signal:metric:${sourceId}`,
            type:'subject_threshold_crossed',
            sourceType:'subject_metric',
            sourceId,
            payload:{ ...input, before:pair[0], after:pair[1], metric, threshold },
            worldMinute:now,
        })) continue;

        const threadId = `thread:${randomUUID()}`;
        storyThreadRepo.save({
            id:threadId,
            type:'corporate_interest',
            title:`${definition.factionName}: интерес к ${definition.label}`,
            status:'open',
            stage:'noticed',
            subjectId:input.subjectId,
            relatedCharacterIds:[],
            facts:[`${definition.label}: достигнут уровень ${Math.round(pair[1])}`],
            tags:['contract','metric',metric,definition.factionId],
            tension:.15,
            importance:.65,
            visibility:'hinted',
            sourceType:'subject_metric',
            sourceId,
            createdMinute:now,
            updatedMinute:now,
            metadata:{ metric, threshold, factionId:definition.factionId },
        });

        const target = Math.ceil(Math.max(Number(pair[1]) + 5, Number(pair[1]) * 1.1));
        const event:EventOpportunity = {
            id:`opportunity:${randomUUID()}`,
            templateId:METRIC_CONTRACT_TEMPLATE,
            status:'available',
            channel:'contract',
            priority:.7,
            urgency:.1,
            subjectId:input.subjectId,
            actorIds:[input.subjectId],
            threadIds:[threadId],
            locationId:'scene_liaison',
            availableFrom:now,
            expiresAt:now + 2 * 1440,
            payload:{
                metric,
                metricLabel:definition.label,
                current:Math.round(Number(pair[1]) * 10) / 10,
                target,
                threshold,
                factionId:definition.factionId,
                factionName:definition.factionName,
                subjectName:characterName(input.subjectId),
                sourceTickId:input.tickId,
            },
        };
        eventOpportunityRepo.save(event);
        created.push(event);
    }
    return created;
}

function ensureAuthoredSupplyOpportunity(now:number) {
    if (now < 540) return;
    const sourceId = 'veil-neurospike-v17';
    if (!directorSignalRepo.claim({
        id:`signal:supply:${sourceId}`, type:'supply_lot_opened',
        sourceType:'authored_supply', sourceId, payload:{ batch:'V-17' }, worldMinute:now,
    })) return;
    const threadId = `thread:${randomUUID()}`;
    storyThreadRepo.save({
        id:threadId,type:'supply_provenance',title:'Партия V-17',status:'open',stage:'offered',
        relatedCharacterIds:[],facts:['Ограниченная партия NeuroSpike V-17 появилась через закрытый канал.'],
        tags:['supply','veil','provenance'],tension:.25,importance:.6,visibility:'hinted',
        sourceType:'authored_supply',sourceId,createdMinute:now,updatedMinute:now,
        metadata:{ batch:'V-17', supplier:'Veil Biotech' },
    });
    eventOpportunityRepo.save({
        id:`opportunity:${randomUUID()}`,templateId:SUPPLY_LOT_TEMPLATE,status:'available',
        channel:'supply',priority:.68,urgency:.35,actorIds:[],threadIds:[threadId],
        locationId:'scene_broker',availableFrom:now,expiresAt:now + 1440,
        payload:{
            offerId:'event_offer_neurospike_v17',itemId:'drug_sensitizer',
            name:'NeuroSpike · V-17',price:135,stock:1,batch:'V-17',
            supplier:'Veil Biotech',originLabel:'закрытый клинический возврат',
            description:'Ранняя серия гипер-сенсибилизатора. Маркировка происхождения частично стёрта.',
        },
    });
}

export function emitSupplyPurchased(input:{
    offerId:string; itemId:string; playerId:string; metadata:Record<string,any>;
}) {
    if (!input.metadata?.eventLot) return null;
    const now = worldMinute();
    const sourceId = input.offerId;
    worldFactRepo.save({
        id:`fact:supply-purchase:${sourceId}`,scope:'player',scopeId:input.playerId,
        predicate:'acquired_supply_lot',
        value:{ offerId:input.offerId,itemId:input.itemId,batch:input.metadata.batch,supplier:input.metadata.supplier },
        sourceType:'purchase',sourceId,validFrom:now,tags:['supply','provenance'],
    });
    if (!directorSignalRepo.claim({
        id:`signal:supply-purchased:${sourceId}`,type:'event_supply_purchased',
        sourceType:'shop_offer',sourceId,payload:input,worldMinute:now,
    })) return null;
    const thread = storyThreadRepo.findBySource('authored_supply', 'veil-neurospike-v17');
    const event:EventOpportunity = {
        id:`opportunity:${randomUUID()}`,templateId:SUPPLY_TAIL_TEMPLATE,status:'available',
        channel:'inbox',priority:.6,urgency:.1,actorIds:[],threadIds:thread ? [thread.id] : [],
        availableFrom:now + 120,expiresAt:now + 4 * 1440,
        payload:{ ...input.metadata,offerId:input.offerId,itemId:input.itemId },
    };
    eventOpportunityRepo.save(event);
    return event;
}

const presentOpportunity = (event:EventOpportunity) => {
    if (event.templateId === PROMISE_TEMPLATE) {
        const name = event.payload.subjectName || characterName(event.subjectId);
        const ownerText = event.payload.owner === 'character'
            ? `${name} оставила незавершённое обещание`
            : `Вы оставили ${name} обещание`;
        return {
            ...event,
            title:'Незавершённый разговор',
            senderId:event.subjectId,
            senderName:name,
            body:`${ownerText}: «${event.payload.promise}». Тема всё ещё не получила продолжения.`,
            choices:[
                { id:'return', label:'Вернуться к разговору', kind:'primary' },
                { id:'defer', label:'Напомнить позже', kind:'secondary' },
                { id:'ignore', label:'Оставить без ответа', kind:'quiet' },
            ],
        };
    }
    if (event.templateId === METRIC_CONTRACT_TEMPLATE) {
        return {
            ...event,
            title:`Запрос на профиль: ${event.payload.metricLabel}`,
            senderId:event.payload.factionId,
            senderName:event.payload.factionName,
            body:`${event.payload.factionName} отметила изменение профиля ${event.payload.subjectName}: ${event.payload.metricLabel} достигла ${event.payload.current}. Заказчик готов выдать условия на дальнейшую калибровку до ${event.payload.target}.`,
            choices:[
                { id:'request_terms', label:'Запросить условия', kind:'primary' },
                { id:'defer', label:'Вернуться позже', kind:'secondary' },
                { id:'ignore', label:'Отклонить канал', kind:'quiet' },
            ],
        };
    }
    if (event.templateId === SUPPLY_LOT_TEMPLATE) {
        return {
            ...event,title:'Закрытая партия у Брокера',senderName:event.payload.supplier,
            body:`Доступна одна упаковка ${event.payload.name}. Происхождение: ${event.payload.originLabel}. Канал удержит лот не дольше суток.`,
            choices:[
                { id:'open_supply',label:'Открыть лот',kind:'primary' },
                { id:'defer',label:'Вернуться позже',kind:'secondary' },
                { id:'ignore',label:'Пропустить',kind:'quiet' },
            ],
        };
    }
    if (event.templateId === SUPPLY_TAIL_TEMPLATE) {
        return {
            ...event,title:'След на упаковке',senderName:'Лабораторный терминал',
            body:`На упаковке партии ${event.payload.batch} проявилась удалённая маркировка. Серия проходила через внутренний контур ${event.payload.supplier}; это не обычный рыночный товар.`,
            choices:[
                { id:'inspect',label:'Зафиксировать происхождение',kind:'primary' },
                { id:'ignore',label:'Не придавать значения',kind:'quiet' },
            ],
        };
    }
    return { ...event, title:'Событие', body:'Поступило новое сообщение.', choices:[] };
};

export function listInbox(limit = 12) {
    const now = worldMinute();
    ensureAuthoredSupplyOpportunity(now);
    return eventOpportunityRepo.listAvailable(now, limit).map(event => {
        if (event.status === 'available') {
            event.status = 'presented';
            event.offeredMinute = now;
            eventOpportunityRepo.save(event);
        }
        return presentOpportunity(event);
    });
}

export function resolveOpportunity(id:string, choice:string) {
    const event = eventOpportunityRepo.get(id);
    if (!event) throw new Error('Событие не найдено');
    if (!['available','presented'].includes(event.status)) throw new Error('Событие уже завершено');
    const now = worldMinute();
    if (event.availableFrom > now) throw new Error('Событие ещё недоступно');

    const allowedChoices = event.templateId === PROMISE_TEMPLATE
        ? ['return','defer','ignore']
        : event.templateId === METRIC_CONTRACT_TEMPLATE
            ? ['request_terms','defer','ignore']
            : event.templateId === SUPPLY_LOT_TEMPLATE
                ? ['open_supply','defer','ignore']
                : event.templateId === SUPPLY_TAIL_TEMPLATE
                    ? ['inspect','ignore']
            : [];
    if (!allowedChoices.includes(choice)) throw new Error('Недоступный вариант ответа');

    if (choice === 'defer') {
        event.status = 'available';
        event.availableFrom = now + 360;
        event.offeredMinute = undefined;
        event.resolution = 'deferred';
        eventOpportunityRepo.save(event);
        return { event:presentOpportunity(event), resolution:'deferred' };
    }

    event.status = choice === 'ignore' ? 'ignored' : 'resolved';
    event.resolvedMinute = now;
    event.resolution = choice;
    eventOpportunityRepo.save(event);

    let contractId:string | undefined;
    if (event.templateId === METRIC_CONTRACT_TEMPLATE && choice === 'request_terms') {
        const metric = String(event.payload.metric);
        const factionId = String(event.payload.factionId);
        db.prepare(`
            INSERT OR IGNORE INTO factions (id,name,type,description,meta)
            VALUES (?,?, 'research_center', ?, '{}')
        `).run(factionId,event.payload.factionName,`${event.payload.factionName}: событийный заказчик.`);
        contractId = `generated:${event.id}`;
        contractRepo.save({
            id:contractId,
            issuerId:factionId,
            title:`Исследование профиля: ${event.payload.metricLabel}`,
            description:`Заказ сформирован после зарегистрированного изменения профиля ${event.payload.subjectName}. Требуется повысить показатель «${event.payload.metricLabel}» до ${event.payload.target} и представить подходящий актив.`,
            state:'available',
            conditions:[{
                type:metric === 'attitude' ? 'attitude' : 'custom',
                key:metric === 'attitude' ? undefined : metric,
                operator:'>=',
                value:Number(event.payload.target),
            }],
            rewards:{ credits:Math.round(180 + Number(event.payload.target) * 4), trust:4 },
            penalties:{},
        });
    }
    if (event.templateId === SUPPLY_LOT_TEMPLATE && choice === 'open_supply') {
        db.prepare(`
            INSERT INTO shop_offers (
                id,item_id,name,description,category,price,stock,required_trust,
                metadata,available_from,expires_at,source_event_id
            ) VALUES (?,?,?,?, 'item',?,?,0,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET stock=excluded.stock,expires_at=excluded.expires_at,
                metadata=excluded.metadata,source_event_id=excluded.source_event_id
        `).run(
            event.payload.offerId,event.payload.itemId,event.payload.name,event.payload.description,
            event.payload.price,event.payload.stock,
            JSON.stringify({
                eventLot:true,batch:event.payload.batch,supplier:event.payload.supplier,
                originLabel:event.payload.originLabel,threadId:event.threadIds[0],
            }),
            now,event.expiresAt || now + 1440,event.id
        );
    }
    if (event.templateId === SUPPLY_TAIL_TEMPLATE && choice === 'inspect') {
        worldFactRepo.save({
            id:`fact:supply-origin:${event.payload.offerId}`,scope:'item',scopeId:event.payload.itemId,
            predicate:'batch_origin',value:{ batch:event.payload.batch,supplier:event.payload.supplier,channel:'internal' },
            sourceType:'director_event',sourceId:event.id,validFrom:now,
            tags:['supply','provenance','revealed'],metadata:{ threadIds:event.threadIds },
        });
    }

    const acceptedContract = event.templateId === METRIC_CONTRACT_TEMPLATE && choice === 'request_terms';
    const openedSupply = event.templateId === SUPPLY_LOT_TEMPLATE && choice === 'open_supply';
    const title = openedSupply ? 'Открыт ограниченный лот'
        : event.templateId === SUPPLY_TAIL_TEMPLATE && choice === 'inspect' ? 'Происхождение партии установлено'
        : acceptedContract ? 'Получены условия контракта'
        : choice === 'return' ? 'Возвращение к обещанию'
            : event.templateId === METRIC_CONTRACT_TEMPLATE ? 'Контрактный канал закрыт' : 'Обещание оставлено без ответа';
    const description = openedSupply
        ? `${event.payload.name} добавлен в каталог Брокера в единственном экземпляре.`
        : event.templateId === SUPPLY_TAIL_TEMPLATE && choice === 'inspect'
            ? `Зафиксирована внутренняя маркировка ${event.payload.supplier} на партии ${event.payload.batch}.`
        : acceptedContract
        ? `${event.payload.factionName} открыла заказ по профилю ${event.payload.subjectName}.`
        : choice === 'return'
            ? `Калибратор решил вернуться к разговору с ${event.payload.subjectName || characterName(event.subjectId)}.`
            : event.templateId === METRIC_CONTRACT_TEMPLATE
                ? `Предложение ${event.payload.factionName} оставлено без продолжения.`
                : `Напоминание об обещании для ${event.payload.subjectName || characterName(event.subjectId)} было оставлено без ответа.`;
    const scenario = db.prepare(`
        INSERT INTO scenario_events (world_minute,type,title,description,metadata)
        VALUES (?,?,?,?,?)
    `).run(now,'director_event',title,description,JSON.stringify({
        opportunityId:event.id,
        threadIds:event.threadIds,
        subjectId:event.subjectId,
        choice,
    }));
    db.prepare(`
        INSERT INTO event_instances (
            id,opportunity_id,template_id,phase,world_minute,participants,
            presented_content,selected_choice,outcome,scenario_event_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
        `instance:${randomUUID()}`,event.id,event.templateId,'resolved',now,
        JSON.stringify(event.actorIds),JSON.stringify(presentOpportunity(event)),
        choice,JSON.stringify({ resolution:choice }),Number(scenario.lastInsertRowid)
    );

    return {
        event:presentOpportunity(event),
        resolution:choice,
        focusSubjectId:choice === 'return' ? event.subjectId : undefined,
        focusSection:acceptedContract ? 'contracts' : openedSupply ? 'supply' : undefined,
        contractId,
    };
}
