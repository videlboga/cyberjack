import { db } from '../infrastructure/db';
import { deriveAcquiredTraits, parsePreferences } from '../domain/conditioning';
import { traitInterpretationRepo } from '../infrastructure/repositories';
import type { MemoryEpisode } from './memoryEpisodes';

/**
 * ИНТЕРПРЕТАЦИЯ ОБУЧЕНИЯ / ТРЕЙТОВ (слой F).
 *
 * Цель: персонаж должен «чувствовать» собственное обучение — не как сухие числа
 * («pain 0 → 0.04»), а как осмысленную историю: «помню, как это началось,
 * свежее помню лучше». Храним по дням {day, value, note}, где note — краткое
 * описание СВОБИТИЯ, которое изменило обучение (из атома-факта). Числа остаются
 * внутри системы для детекции изменения, но в заметку НЕ попадают.
 *
 * Ключ истории — исходная метрика (точка или тег), а не id трейта, потому что
 * значение обучения меняется у метрики, а трейт появляется/исчезает при порогах.
 */

/** Явный маппинг trait_id → метрика (точка или тег), чьё значение двигает трейт. */
export const TRAIT_TO_METRIC: Record<string, { bucket: 'tags' | 'points'; key: string; label: string }> = {
  trait_masochist: { bucket: 'tags', key: 'pain', label: 'боль' },
  trait_knismolagnia: { bucket: 'tags', key: 'tickling', label: 'щекотка' },
  trait_restraint_fetish: { bucket: 'tags', key: 'restraint', label: 'фиксация' },
  trait_conditioned_submission: { bucket: 'tags', key: 'submission', label: 'покорность' },
  trait_exhibitionist: { bucket: 'tags', key: 'exposure', label: 'демонстрация' },
  trait_clinical_fetish: { bucket: 'tags', key: 'clinical', label: 'клинические процедуры' },
  trait_electrophile: { bucket: 'tags', key: 'electronic', label: 'электростимуляция' },
  trait_technophile: { bucket: 'tags', key: 'machine', label: 'машины' },
  trait_sexual_dependency: { bucket: 'tags', key: 'sexual', label: 'сексуальное' },
  trait_sensory_deprivation: { bucket: 'tags', key: 'deprivation', label: 'сенсорная изоляция' },
  // point-трейты: id вида trait_point_<pointId>.
};

/** Точка для trait_point_<pointId>. */
export function metricForTrait(traitId: string): { bucket: 'tags' | 'points'; key: string; label: string } | null {
  const direct = TRAIT_TO_METRIC[traitId];
  if (direct) return direct;
  if (traitId.startsWith('trait_point_')) {
    const key = traitId.slice('trait_point_'.length);
    return { bucket: 'points', key, label: key };
  }
  return null;
}

/** Текущее значение метрики обучения для субъекта (число — только для детекции). */
export function metricValue(subjectId: string, metric: { bucket: 'tags' | 'points'; key: string }): number {
  const prefs = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(subjectId) as any;
  if (!prefs) return 0;
  const parsed = parsePreferences(prefs.preferences);
  return Number((metric.bucket === 'tags' ? parsed.tags : parsed.points)[metric.key] || 0);
}

/** Текущий день (1-индексированный) из world_state. */
export function currentDay(): number {
  const row = db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any;
  return Math.floor(Number(row?.total_minutes || 0) / 1440) + 1;
}

/**
 * Записывает «день обучения» для метрик, затронутых обработанным воспоминанием.
 * Вызывается из syncAssociationEffects (Слой 3) после применения дельт к тегам.
 *
 * note — осмысленное событие из текста эпизода (без чисел), а не дельта.
 */
export function recordLearningDay(subjectId: string, episode: MemoryEpisode, changedTags: string[]) {
  if (!changedTags.length) return;
  const day = currentDay();
  // Краткая выжимка события: первый атом эпизода (что произошло).
  const firstMoment = episode.moments?.[0]?.text || episode.text || '';
  const note = firstMoment.replace(/\s+/g, ' ').trim().slice(0, 200);
  const prefs = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(subjectId) as any;
  if (!prefs) return;
  const parsed = parsePreferences(prefs.preferences);
  // Трейты субъекта (для проверки «метрика относится к трейту»).
  const traits = deriveAcquiredTraits(prefs.preferences).filter(trait => trait.level > 0);
  const traitMetrics = new Set(traits.map(trait => {
    const m = metricForTrait(trait.id);
    return m ? m.key : trait.id;
  }));
  for (const tag of changedTags) {
    // Запись создаём, только если: (а) метрика является трейтом с ненулевым
    // обучением, или (б) запись уже была (сохранить историю после обнуления).
    const isTrait = traitMetrics.has(tag);
    const hasRecord = !!traitInterpretationRepo.get(subjectId, tag);
    if (!isTrait && !hasRecord) continue;
    const value = Number((parsed.tags as Record<string, number>)[tag] || 0);
    traitInterpretationRepo.recordDay(subjectId, tag, day, value, note || undefined);
  }
}

/** Тип эпизода, используемый recordLearningDay. */

/**
 * Разрежение истории до максимум `max` пунктов (по умолчанию 10).
 * Первое (о формировании) подаётся всегда; свежие дни идут подряд и гуще,
 * старые — реже. Пример: при 20 днях → 1, 5, 9, 13, 15, 16, 17, 18, 19, 20.
 * (свежие ~6 дней подряд, старые разрежены шагом ~4).
 */
export function selectHistoryPoints(
  history: Array<{ day: number; value: number; note?: string }>,
  max = 10,
): Array<{ day: number; value: number; note?: string }> {
  if (history.length <= max) return history;
  // Сколько свежих дней держим подряд (густо).
  const FRESH = 6;
  const fresh = history.slice(-FRESH);
  // Старая часть (до свежих) разрежается до max - FRESH точек, включая первый.
  const oldPart = history.slice(0, Math.max(0, history.length - FRESH));
  const oldSlots = Math.max(1, max - FRESH);
  const out: Array<{ day: number; value: number; note?: string }> = [];
  if (oldPart.length) {
    // Первый день всегда; остальные равномерно по старой части.
    const first = oldPart[0];
    out.push(first);
    if (oldSlots > 1 && oldPart.length > 1) {
      const remaining = oldPart.slice(1);
      const step = remaining.length / (oldSlots - 1);
      for (let i = 1; i < oldSlots; i++) {
        const idx = Math.min(remaining.length - 1, Math.round(step * i) - 1);
        const pick = remaining[Math.max(0, idx)];
        if (pick && out[out.length - 1].day !== pick.day) out.push(pick);
      }
    }
  }
  // Свежие дни — подряд, без пропусков.
  for (const point of fresh) {
    if (out[out.length - 1]?.day !== point.day) out.push(point);
  }
  return out;
}

/**
 * Собирает текстовый блок «[Интерпретация обучения]» для субъекта.
 * История изменений по дням (каждый пункт — день), без чисел: только событие.
 * Первое воспоминание (о формировании) подаётся всегда, свежие гуще.
 */
export function traitInterpretationBlock(subjectId: string): string | null {
  const rows = traitInterpretationRepo.listForSubject(subjectId).filter(row => row.history.length >= 1);
  if (!rows.length) return null;
  const blocks = rows.map((row) => {
    const metric = metricForTrait(row.traitKey) || { bucket: 'tags' as const, key: row.traitKey, label: row.traitKey };
    const points = selectHistoryPoints(row.history, 10);
    const lines = points.map((p) => {
      const dayLabel = p.day === row.firstDay ? `первый день` : `${p.day - row.firstDay + 1} день`;
      const note = p.note && p.note.trim() ? ` — ${p.note}` : '';
      return `- ${dayLabel}${note}`;
    });
    return `- ${metric.label}: ${lines.join('\n  ')}`;
  });
  return `[Интерпретация обучения]\n${blocks.join('\n\n')}\nЭто твоя история собственного обучения: ты помнишь, с чего оно началось, но свежее помнишь лучше.`;
}
