from pathlib import Path
import json,shutil,collections,numpy as np
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');A=P/'analysis';s=json.load(open(A/'import-audit-source.json'));assert s['complete'];g=json.load(open(A/'import-audit-glb.json'))['files'];val=json.load(open(A/'import-audit-validation.json'))['files'];rem=json.load(open(A/'import-audit-removal.json'));m=json.load(open(A/'humanoid_manifest.json'));materials=json.load(open(A/'import-audit-materials.json'));blender=json.load(open(A/'import-audit-blender.json'))
for row in s['models']:
 for a in row['anchorChecks']:
  if 'rotationErrorDegreesWhenReadAsXYWZ' in a:a['rotationErrorDegreesWhenReadAsXYZW']=a.pop('rotationErrorDegreesWhenReadAsXYWZ')
(A/'import-audit-source.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
cleanfiles=[r for r in g if r['file'].startswith('glb-nohuman/')];scales=[]
for r in s['models']:
 f=next((g0 for g0 in cleanfiles if g0['file'].endswith(r['model']+'.glb')),None)
 if f:scales.extend((np.array(f['bounds']['size'])/np.array(r['boundsMeters']['size'])).tolist())
summary={'models':len(s['models']),'glbFiles':len(g),'validatorErrors':sum(r['errors'] for r in val),'validatorWarnings':sum(r['warnings'] for r in val),'originalExportsWithExtraTriangles':sum(r['blenderExport']['extraTriangles']>0 for r in s['models']),'nohumanExports':len(rem),'nohumanExportsRetainingFigureMesh':sum(bool(r['glbMeshesStillPresent']) for r in rem),'nohumanScaleRangeRelativeToFullSource':[min(scales),max(scales)],'nohumanMissing':[k for k,v in m.items() if not v.get('humanoid_defs')],'armaturesInFreshBlenderImport':blender['armatures'],'animationActionsInFreshBlenderImport':blender['actions'],'glbSkins':sum(r['skins'] for r in g),'glbAnimations':sum(r['animations'] for r in g),'sourceTexturedMaterialCount':sum(len(r['textures']) for r in materials),'anchorCount':sum(len(r['anchorChecks']) for r in s['models']),'anchorsWithNonIdentityParents':sum(a['parentRotationOrScalePresent'] for r in s['models'] for a in r['anchorChecks'])}
(A/'import-audit-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
table=['| Модель | Треугольники SKP | Лишние в Blender GLB | GLB без фигуры |','|---|---:|---:|---|']
for r in s['models']:table.append(f"| {r['model'].split('-')[-1]} | {r['counts']['triangles']:,} | +{r['blenderExport']['extraTriangles']:,} | {'Фигура осталась; ×1000' if 'nohumanExport' in r else 'Нет файла'} |")
text='''# Проверка импорта SKP / GLB, vol-03

Проверены все 24 SKP, 24 Blender-экспорта GLB и 18 экспортов `glb-nohuman`. Исходные модели и экспорты не изменены. В указанном каталоге `.blend` нет: проверены имеющиеся GLB и выполнен отдельный свежий Blender-импорт 065. Данные об остальных Blender-экспортах проверены непосредственно в GLB с сопоставлением исходным SKP.

## Результат

Импорт в Blender сохраняет компоненты и размещённые экземпляры, но существующие экспорты пока нельзя использовать как готовые сценовые ассеты. Все 42 GLB проходят структурный валидатор с 0 ошибками и 0 предупреждениями; это не подтверждает правильность состава сцены, единиц или привязок.

1. **Все 24 Blender GLB содержат лишнюю геометрию.** В экспорт попала библиотечная коллекция `source geometry` вместе с размещёнными экземплярами. Например, 065: в SKP 311 788 треугольников в размещениях, в GLB 533 850; лишние 222 062 — ровно объём уникальной исходной геометрии, который показывает Blender-импортёр. Это создаёт лишние экземпляры у локального начала координат и увеличивает габариты сцены. Скрипт `/tmp/skp_glb.py` вызывает экспорт без фильтра видимости/доступной коллекции. Исключённая source-коллекция должна остаться источником инстансов, но не экспортироваться как самостоятельные видимые объекты. Исправление надо проверять по мировым вершинам и количеству размещений, а не только по картинке.

2. **Во всех 18 `glb-nohuman` фигуры фактически остались.** В GLB присутствуют именно те `mesh_*`, которые объявлены удалёнными в humanoid_manifest. Число треугольников соответствует полной исходной сцене. Причина в `/tmp/skp_clean.py`: меняется `f.build_instanced_scene`, но установленный `openskp.export.instanced_glb.export()` вызывает модульную функцию `build_instanced_scene(parsed)` и строит сцену заново. Подготовленное фильтрованное дерево не используется.

3. **`glb-nohuman` записаны в миллиметровых координатах.** glTF использует метры, а этот экспортёр прямо переводит позиции и трансляции из метров в миллиметры. На уровне glTF Loader размеры оказываются в 1000 раз больше. Например, 065 должен иметь ширину примерно 1,7045 м, а файл даёт 1704,5 единицы. Соседние `_metadata.json` при этом содержат bounds в метрах — смешение единиц уже внутри одного набора результатов.

4. **Манифест фигур нельзя применять к VRM напрямую.** `quat_from_mat()` в скрипте возвращает WXYZ, но поле названо `quat_xyzw`. Кроме этого, позиция берётся из мировой матрицы, а quaternion/scale — из локальной. Простая перестановка четырёх чисел не устраняет влияние родителей. Для 065 исходная ошибка поворота около 166,7°, а после одной перестановки остаётся около 71,2°. Для размещения нужен согласованный мировой transform, с отдельной обработкой отрицательного масштаба/отражения, если оно встречается.

5. **Для шести исходников чистого экспорта нет:** 074, 075, 076, 083, 085, 086. Автоматическая эвристика не выделила фигуру. Это не доказательство отсутствия фигуры; нужно проверить компонентный состав/связные части. Нельзя автоматически удалять любую деталь подходящего размера и серого цвета: так можно удалить часть конструкции.

## VRM и анимация

Технически аппараты можно использовать рядом с Rin/Mira/Kai как отдельные GLB, а персонажа оставить VRM со своим скелетом, выражениями и физикой. Не требуется превращать всю конструкцию в VRM.

Во всех 42 GLB нет skins и animation clips; в свежем импорте 065 нет Armature и Actions. Статичная фигура — набор треугольников, а не гуманоидный риг. Её transform даёт только размещение объекта и не задаёт углы костей, позу или контакты VRM. Автоматического переноса позы или готовой анимации здесь нет.

Разумный порядок подготовки:

- исправить состав экспорта и единицы; сравнить геометрию с SKP;
- точно выделить демонстрационные фигуры по экземплярам, сохранить их как отдельные ссылки для проверки;
- подготовить общий корень и согласованные мировые координаты, не масштабировать скелет VRM неравномерно;
- для механики разметить самостоятельные подвижные детали, оси/pivot и допустимые диапазоны движения; компоненты SketchUp помогают выделению деталей, но не являются готовым кинематическим ригом;
- для обычной расстановки персонажа задать ориентиры опор и настроить позу VRM с учётом его пропорций; контакт и предотвращение пересечений требуют отдельной работы;
- анимации механических деталей хранить в GLB/контроллере, а анимации персонажа — на VRM-скелете, с общим временем воспроизведения.

Эта проверка не создаёт новые позы, риги или анимации и не меняет действующий VRM-вьювер.

## Материалы

В проверенных GLB нет встроенных изображений: используются цветовые материалы. Blender-импортёр явно поддерживает только сплошной base color, а instanced GLB exporter вызван без textures=True. Наличие текстурных записей исходных материалов отдельно проверено в `import-audit-materials.json`: найдено 92 записи с данными изображений, с повторениями между файлами. Это не означает 92 используемые текстуры: в отдельно проверенной 066 исходный список содержит четыре текстурных записи, но построенная сцена использует ноль текстур (`import-audit-used-textures.json`). Поэтому отсутствие картинок в GLB само по себе не доказывает потерю видимых текстур. Полная проверка назначения текстур на каждую грань всех моделей здесь не выполнена; перед окончательной пересборкой её стоит включить в сравнение материалов.

## По моделям

'''+ '\n'.join(table)+'''

## Область проверки

Сопоставление геометрии SKP выполнено парсером openskp, который использует и установленный импортёр Blender. Оно надёжно выявляет расхождения между его исходной сценой и экспортами, но не заменяет независимую поэлементную визуальную сверку с родным SketchUp. Проверены численные габариты, размещения, сетки, состав файлов и служебные данные; готовность нового рига или конкретной анимации этой проверкой не устанавливается.

## Доказательства и воспроизведение

- `import-audit-source.json`: мировые габариты и треугольники из всех SKP, сравнение с GLB, ошибки quaternion/родительских трансформаций.
- `import-audit-glb.json`: состав всех GLB, мировые габариты, сетки, skins, анимации и изображения.
- `import-audit-removal.json`: имена оставшихся в GLB ресурсов демонстрационных фигур.
- `import-audit-blender.json`: свежий Blender-импорт 065 и исключённые source-коллекции.
- `import-audit-validation.json`: структурная проверка всех 42 GLB.
- `import-audit-materials.json`: материалы/текстуры исходных SKP.
- `import-audit-summary.json`: краткие численные итоги.
- `import-audit-inputs.json`: размеры и SHA256 всех 66 проверенных исходных SKP/GLB.
- `audit-tools/`: скрипты проверки и копии проверенных временных конвертеров. Для openskp используются локальные зависимости плагина Blender; пути указаны в скриптах. Запускать numpy-проверку лучше с OPENBLAS_NUM_THREADS=1. source_audit.py использует кэш отчёта; флаг --force повторяет проверку всех SKP. Для Node-валидатора путь к модулю можно задать через GLTF_VALIDATOR_MODULE.
'''
text+=f"\nВ исходных материалах обнаружено текстурных записей с изображениями: {summary['sourceTexturedMaterialCount']}.\n"
(A/'IMPORT_AUDIT_RU.md').write_text(text);tools=A/'audit-tools';tools.mkdir(exist_ok=True)
for p in Path(__file__).parent.glob('*'):
 if p.suffix in ['.py','.cjs'] and p.resolve()!=(tools/p.name).resolve():shutil.copy2(p,tools/p.name)
for name in ['skp_glb.py','skp_clean.py']:
 shutil.copy2(Path('/tmp')/name,tools/('previous-'+name))
print(json.dumps(summary,ensure_ascii=False))
