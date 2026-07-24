# Чек-лист генерации Visual Matrix v4

Актуально после инвентаризации 20 июля 2026 года.

## Файлы

- Полный CSV: `/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/visual-assets/visual-generation-v4-checklist.csv`
- Полный JSON: `/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/visual-assets/visual-generation-v4-checklist.json`
- Только недостающие CSV: `/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/visual-assets/visual-generation-v4-missing.csv`
- Только недостающие JSON: `/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/visual-assets/visual-generation-v4-missing.json`
- Сводка: `/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/visual-assets/visual-generation-v4-summary.json`

Пересборка:

```bash
npm run build:visual-index-v4
npm run build:visual-checklist-v4
```

## Состояние покрытия

| Матрица | Целевых | Уже покрыто точно | Не хватает | Есть legacy-кандидат |
|---|---:|---:|---:|---:|
| Calibration avatar | 15 792 | 1 176 | 14 616 | 138 |
| Calibration interaction | 5 880 | 0 | 5 880 | 1 302 |
| Device | 1 638 | 0 | 1 638 | 549 |
| Всего | 23 310 | 1 176 | 22 134 | 1 989 |

`legacyCandidate` не считается готовым покрытием. Это изображение из `interactions-expanded`, которое можно просмотреть и либо принять как alias, либо заменить новым кадром.

## Куда генерировать

### Калибровочные аватары

```text
/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/calibration-v4/{character}/{pose}/{clothing}__{equipmentPreset}__{affect}.png
```

### Ручные продолжительные воздействия

```text
/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/calibration-interactions-v4/{character}/{family}/{variant}/{clothing}__{equipmentPreset}__{affect}__{phase}.png
```

### Автономные устройства

```text
/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/devices-v4/{character}/{device}/{configuration}/{wardrobe}__{affect}__{phase}.png
```

В каждой строке missing-чек-листа поле `targetFile` уже содержит полный абсолютный путь конечного PNG.

## Очерёдность

| Приоритет | Содержание | Не хватает | Legacy-кандидаты |
|---|---|---:|---:|
| P0 | четыре новые позы без экипировки | 672 | 138 |
| P1 | повязка для всех калибровочных поз | 1 848 | 0 |
| P2 | кляп и повязка + кляп | 3 696 | 0 |
| P3 | наручники и наручники + повязка | 3 024 | 0 |
| P4 | ножные манжеты, полные манжеты, пояс | 2 520 | 0 |
| P5 | стол, рама, подвес | 1 008 | 0 |
| P6 | ошейник | 1 848 | 0 |
| P7 | ручные interactions без экипировки | 1 176 | 294 |
| P8 | ручные interactions с экипировкой | 4 704 | 1 008 |
| P9 | обязательные устройства | 1 512 | 525 |
| P10 | optional device-конфигурации | 126 | 24 |

## Первый генерационный пакет

Начинать следует с P0 и P1.

P0 состоит из четырёх поз, по 168 кадров каждая:

| Поза | Не хватает | Legacy-кандидаты |
|---|---:|---:|
| `sitting_spread` | 168 | 36 |
| `standing_exposed` | 168 | 54 |
| `covering` | 168 | 30 |
| `feet_presented` | 168 | 18 |

После аудита 138 legacy-кандидатов реальный объём перегенерации P0 может уменьшиться с 672 до 534.

P1 — повязка:

```text
3 персонажа × 11 поз × 7 комплектов одежды × 8 affect = 1848 PNG
```

Если первый пакет слишком велик, контрольная волна P1:

```text
3 персонажа × 11 поз × underwear × 8 affect = 264 PNG
```

После утверждения внешности, положения повязки и эмоционального диапазона комплект размножается по остальным шести вариантам одежды.

## Значения status

- `generated_v4` — целевой V4-файл уже существует;
- `covered_by_exact_legacy` — существующий `rendered` полностью совпадает по смыслу и используется через alias;
- `missing_generate` — целевого покрытия нет, строка входит в генерационную очередь.

## Обновление после генерации

После появления новых PNG обязательно выполнить:

```bash
npm run build:visual-index-v4
npm run build:visual-checklist-v4
npm run validate:visual-v4
```

После пересборки runtime resolver начнёт использовать новые файлы без изменения UI-кода.
