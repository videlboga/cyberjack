import { subjectRepo, characterRelationRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';

/**
 * Детерминированное решение: послушается ли исполнитель контр-приказа
 * (interrupt_directive). LLM только даёт интент; финальное решение принимает
 * ядро по личности, отношениям и статусу.
 *
 * Возвращает true, если исполнитель останавливает текущее поручение.
 */
export function resolveDirectiveCompliance(input: {
    executorId: string;
    requesterId: string;
    playerId?: string;
}): {
    comply: boolean;
    score: number;
    reasons: string[];
} {
    const { executorId, requesterId, playerId = 'PL-1' } = input;
    const reasons: string[] = [];
    const core = subjectRepo.get(executorId);
    const requesterIsPlayer = requesterId === playerId || requesterId === 'PL-1';

    // ── 1. Личность исполнителя ──
    // attitude (0..100) — общая покорность/лояльность к оператору.
    const attitude = core?.attitude ?? 0;         // 0 = враждебный, 100 = покорный
    const openness = core?.openness ?? 0;         // 0..100
    const plasticity = core?.plasticity ?? 0;     // податливость разума

    // ── 2. Статус исполнителя ──
    // Сотрудник (staff) отходит от протокола ТОЛЬКО при очень сильных вводных.
    const sceneRow = db.prepare(
        `SELECT role FROM scene_characters WHERE character_id = ? AND scene_id = 'scene_lab_calibrator'`
    ).get(executorId) as { role?: string } | undefined;
    const isStaff = sceneRow?.role === 'staff' || sceneRow?.role === 'assistant';

    // ── 3. Отношение к требующему ──
    const relToRequester = requesterIsPlayer
        ? null // отношение к игроку уже внутри attitude
        : characterRelationRepo.get(executorId, requesterId);
    const attitudeToRequester = relToRequester?.attitude ?? 50;

    // ── Расчёт compliance (0..100) ──
    // База: личная покорность + податливость.
    let score = attitude * 0.55 + openness * 0.15 + plasticity * 0.1;
    reasons.push(`покорность ${Math.round(attitude)}, открытость ${Math.round(openness)}`);

    // Отношение к требующему: если исполнитель уважает/боится требующего — выше.
    score += (attitudeToRequester - 50) * 0.3;
    reasons.push(`отношение к требующему ${Math.round(attitudeToRequester)}`);

    // ── Статус: сотрудник почти не отступает от протокола ──
    if (isStaff) {
        score -= 40; // протокол для сотрудника почти нерушим
        reasons.push('исполнитель — сотрудник (протокол устойчив к отмене)');
    } else {
        score += 5; // актив более податлив контр-приказу
        reasons.push('исполнитель — актив');
    }

    // Требующий — игрок/калибратор: почти всегда послушается (власть оператора).
    if (requesterIsPlayer) {
        score += 25;
        reasons.push('требует оператор лаборатории');
    }

    const threshold = isStaff ? 80 : 55;
    const comply = score >= threshold;
    reasons.push(`итог ${Math.round(score)}${comply ? ' ≥' : ' <'} порога ${threshold}`);

    return { comply, score: Math.round(score), reasons };
}
