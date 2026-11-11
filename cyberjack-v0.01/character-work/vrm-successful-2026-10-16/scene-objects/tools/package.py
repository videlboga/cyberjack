from pathlib import Path
import shutil,json
B=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16');O=B/'scene-objects';W=Path(__file__).parent
r=json.load(open(O/'reports/extraction.json'));v=json.load(open(O/'reports/gltf-validation.json'));c=r['counts']
(O/'tools').mkdir(exist_ok=True);(O/'native-code').mkdir(exist_ok=True)
for name in ['extract.py','finalize.py','validate.cjs','audit.py','audit.json','package.py','verify_references.py','preview.cjs']:
 shutil.copy2(W/name,O/'tools'/name)
shutil.copy2(W/'ItemObject.cs',O/'native-code/ItemObject.cs');shutil.copy2(W.parent/'scene-placement/HSceneProc.cs',O/'native-code/HSceneProc.cs')
# Validator resolves dependencies in this bundle when copied, and in the working directory.
p=O/'tools/validate.cjs';s=p.read_text().replace("require('../validation/node_modules/gltf-validator')","require(require('fs').existsSync(require('path').join(__dirname,'../../../tools/validation/node_modules/gltf-validator'))?'../../../tools/validation/node_modules/gltf-validator':'../validation/node_modules/gltf-validator')")
# Leave dependency discovery explicit: npm install gltf-validator or use the bundled validator.
s=s.replace("const v=require(require('fs').existsSync(require('path').join(__dirname,'../../../tools/validation/node_modules/gltf-validator'))?'../../../tools/validation/node_modules/gltf-validator':'../validation/node_modules/gltf-validator');", "const v=require(process.env.GLTF_VALIDATOR_MODULE||'gltf-validator');")
p.write_text(s)
text=f'''# Предметы и мебель Koikatsu Sunshine

Извлечено из исходных архивов установленной игры. Каталог дополняет библиотеку персонажей и анимаций.

## Содержимое

- {c['objects']} префаба, на которые непосредственно ссылаются таблицы сцен: {r['propModels']} с видимой геометрией, остальные — служебные корни. Это не пропущенные модели.
- {c['placements']} префабов HPoint с иерархией точек размещения.
- {c['maps']} карт; {c['furniture']} корней мебели/меток в этих картах, из них {c['furnitureModels']} с GLB. Это экземпляры на картах, а не число уникальных дизайнов.
- {c['textures']} текстур PNG; текстуры основного материала также встроены в GLB.
- {r['animatedItemRows']} ссылок на собственные контроллеры предметов; неразрешённых ссылок: {len(r['unresolvedAnimatorRows'])}.

`catalog.json` — основной каталог: объект → модель → исходный архив, таблицы привязок, варианты сцен и мебель карт.
`models/` — GLB с иерархией, исходными локальными трансформациями, материалами и скиннингом там, где он есть.
`textures/` — текстуры всех обнаруженных слотов материалов, включая дополнительные карты, не подключённые к PBR-превью.
`native/` — исходные компоненты объектов, материалы, коллайдеры, параметры скриптов, хеши путей анимации и иерархии карт. `map-lists.json.gz` сохраняет таблицы карты.
`animation-links.json` — ссылки на уже извлечённые контроллеры в `../animation-links/`; соответствующие исходные клипы находятся в `../animations/`. Дублировать библиотеку не требуется.
`map-interactions.json` — {r['mapInteractions']} записей KindMap: категории, целевые узлы/группы, смещения и исходные указатели.
`sources/` — отдельные копии исходных архивов предметов, карт и общих материалов; для точного восстановления Unity-данных.
`native-code/` — исходная логика загрузки/родительства предметов и расстановки мебели после декомпиляции.
`reports/` — отчёты извлечения и проверки GLB.

## Привязки и размещение

В `itemTables` сохраняются `lstParent`, `nameParent`, `nameSelf`, `kindSetParent` и исходные пути контроллеров. `numToWhomParent`: 0 — мужчина; 1 — первая женщина; 11 — вторая женщина; 2 — объект карты; 100+ — другой предмет по ID. При `kindSetParent=0` игра переподчиняет узел, сохраняя локальные координаты. Другие режимы требуют логики следования из ItemObject.cs.

GLB использует правую систему координат с отражением Unity X; native-файлы сохраняют исходные Unity-координаты. Для мебели `worldMatrixUnity` и `worldPositionUnity` учитывают родительскую цепочку карты. Локальный корень GLB сам по себе не заменяет мировую расстановку.

Столы/стулья выбираются из контекста карты и HPoint. `useChair` и `useDesk` задают количество, но не определяют единственный префаб. Геометрия и точки взаимодействия часто находятся в разных узлах. Дополнительно извлечены узлы с именами bench/table/bed/sofa/stool; это поиск кандидатов, а не доказательство использования каждого в конкретной сцене. `fileHitObject` не является списком видимых предметов.

## Что уже готово и что требует подключения

Извлечение данных завершено. В существующий VRM-вьювер предметы пока не подключены. GLB содержит исходную позу и скиннинг; проигрывание собственных анимаций предметов нужно подключить через сохранённые контроллеры и пути узлов. Анимации не запечены внутрь GLB.

Unity-шейдеры сохранены в оригинальных архивах, материалы и все найденные текстурные слоты — в native-данных. GLB использует приближённый PBR-материал: свет, прозрачность, дополнительные текстурные эффекты могут отличаться от игры. Коллайдеры/скрипты сохранены, но GLB сам по себе не воспроизводит Unity-физику. Активность исходных узлов сохранена в `extras.unityActive`; приложение должно учитывать её при выборе игровых состояний.

## Битые ссылки в исходных данных

Одна таблица запрашивает `khh_p_61` из `h/anim/female/01_01_00.unity3d`, но такого контроллера и пути ассета в установленном архиве нет. Запись относится к невидимому `p_null`. Она сохранена как неразрешённая, без подмены контроллером тела `khh_f_61`. Доказательство и список контроллеров архива — `reports/source-missing-animator.json`. Остальные ссылки на контроллеры предметов разрешены.

Также четыре варианта сцен запрашивают две таблицы `item_khh_f_56` и `item_kht_f_05`, которых нет ни по имени, ни по пути ассета в девяти установленных архивах h/list. Они отмечены как отсутствующие в исходных данных; список просмотренных архивов и путей — `reports/source-item-tables.json`. Соответствующие предметы не выдуманы и не заменены похожими.

## Проверки

Проверено {v['models']} GLB: {v['errors']} ошибок glTF Validator. Подробности и предупреждения — `reports/gltf-validation.json`. Проверка ссылок и количества сеток — `reports/reference-validation.json`.

Конвертеры лежат в `tools/`. Для извлечения нужны Python, UnityPy, numpy, Pillow; для валидатора Node и gltf-validator. Пути исходной игры/каталога указаны в начале Python-скриптов; extract.py также принимает переменные KOIKATSU_ABDATA и CHARACTER_BUNDLE. Кэш `.record.json` ускоряет повторное извлечение; для полной пересборки удалите соответствующий кэш и GLB. После изменения генератора выполняются `extract.py`, `finalize.py`, `validate.cjs`, затем обновляется SHA256SUMS.json общего каталога.
'''
(O/'README_RU.md').write_text(text)
root=B/'README_RU.md';text=root.read_text();entry='\n## Предметы и мебель сцен\n\n`scene-objects/` содержит извлечённые предметы с текстурами, исходные привязки/контроллеры, мебель и точки взаимодействия карт. Геометрия доступна в GLB, исходные Unity-данные и архивы сохранены отдельно. Подключение предметов к VRM-вьюверу ещё не выполнено. Подробности и проверки — `scene-objects/README_RU.md`.\n'
if '## Предметы и мебель сцен' not in text:root.write_text(text+entry)
print('PACKAGED',O)
