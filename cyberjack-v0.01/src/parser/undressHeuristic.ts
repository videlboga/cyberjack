/**
 * Единая эвристика распознавания обобщённой команды раздевания.
 *
 * Раньше существовали две отдельные регулярки для одной команды:
 * - semanticVerbalParser.isGenericUndressCommand (подстрока, без границ слов);
 * - verbalParser (с границами слов, поддержка «сними с себя одежду»).
 *
 * Объединены в один модуль. `isGenericUndressCommand` — широкая проверка
 * (используется semantic-парсером для перенаправления на
 * command_remove_worn_clothing). `matchAggregateUndressCommand` — строгая
 * проверка с границами слов (используется детерминированным verbal-парсером
 * для массового снятия одежды).
 */

const GENERIC_UNDRESS = /(?:сними(?:те)?\s+(?:всю\s+)?одежду|раздень(?:ся|тесь)|сними(?:те)?\s+вс[её])/iu;

const AGGREGATE_UNDRESS = /(?:^|\s)(разденься|сними\s+(?:с\s+себя\s+)?(?:всю\s+)?одежду|сними\s+вс[её])(?:[.!?\s]|$)/i;

/** Широкая проверка: матчит подстроку без границ слов. */
export function isGenericUndressCommand(text: string): boolean {
  return GENERIC_UNDRESS.test(text);
}

/** Строгая проверка: требует границы слов (начало/пробел и конец/знак препинания). */
export function matchAggregateUndressCommand(text: string): boolean {
  return AGGREGATE_UNDRESS.test(text);
}
