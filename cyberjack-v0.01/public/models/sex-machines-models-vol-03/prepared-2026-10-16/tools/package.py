from pathlib import Path
import json,shutil,os,hashlib
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');O=P/'prepared-2026-10-16';B=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16');W=Path(__file__).parent;L=Path('/home/cyberkitty/Projects/control-room/dashboard-frontend');catalog=json.load(open(O/'catalog.json'));v=json.load(open(O/'reports/gltf-validation.json'));check=json.load(open(O/'reports/source-verification.json'));blends=json.load(open(O/'reports/blender-import.json'));assert catalog['complete'] and len(blends)==24 and not check['errors'] and not v['errors'];catalog['materialRevision']='materials-20261016-3'
tmp=O/'catalog.json.tmp';tmp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2));tmp.replace(O/'catalog.json')
counts={'models':len(catalog['models']),'figureInstances':check['figureInstancesRemoved'],'blends':len(blends),'glbs':v['files'],'validatorErrors':v['errors'],'validatorWarnings':v['warnings']}
material_report=O/'reports/material-correction.json'
if material_report.exists():assert not json.load(open(material_report))['errors']
readme=f'''# Исправленные SKP-модели vol-03

Отдельная подготовленная версия всех {counts['models']} моделей. Старые SKP, glb/ и glb-nohuman/ не изменены.

- `models/` — 24 GLB в метрах, Y-up, с исходной иерархией размещений и без демонстрационных фигур.
- `blend/` — 24 настоящих Blender-файла, собранных из проверенных чистых GLB. Единицы: метр. Лишних исходных коллекций нет.
- `reference-full/` — 24 исправленные полные версии исходных сцен для численной сверки. В каталог просмотра они не включены.
- `metadata/` — определения удалённых фигур, поэкземплярные мировые матрицы/позиции/масштабы, quaternion XYZW для представимых мировых вращений, точная карта исходных узлов.
- `catalog.json` — каталог для загрузчика.
- `reports/` — glTF Validator, независимая сверка мировых габаритов/треугольников и Blender-импорт.
- `tools/` — воспроизводимые конвертеры и проверки.

Удалено {counts['figureInstances']} размещённых экземпляров фигур из 24 моделей. Имена STL с суффиксами `#1`, `#2`, `#8` теперь распознаются. Фильтрация выполняется по исходным определениям, а не цвету или размеру. Дерево и дочерние узлы сохранены: снята только геометрия соответствующих фигур и их собственные линии. Неиспользованные библиотечные меши отдельно в сцену не добавляются. Грани, материалы и действительные размещения механики сохранены.

Исправлено отображение неокрашенных поверхностей: они белые, как на авторском превью, а не красные от служебного цвета Layer0. Явно назначенные материалы и наследуемая краска компонентов сохранены. Это профиль обычных материалов SketchUp, без режима Color by Layer. Цвета исходных слоёв сохранены отдельно в metadata.materialProfile. Разные текстуры, прозрачность и UV лицевой/обратной сторон сохраняются раздельно, даже если RGB совпадает. Используется напрямую разобранная сцена, без скрытого повторного чтения SKP, которое сбрасывало параметры отображения. Используемые изображения также сохраняются. Нормали приведены к единичной длине. Конструкционные линии сохранены как линии glTF. В галерее они выключены по умолчанию и включаются флажком; Blender содержит отдельную скрытую коллекцию Construction lines для объектов без граней. Используется исходная метровая матрица, без промежуточного перевода в миллиметры и без переэкспорта библиотечных Blender-коллекций.

## Просмотр

На работающем сервере: `http://127.0.0.1:8765/scene_objects.html?kind=skp`.
Раздел «SKP · механические модели» показывает все 24 чистые модели. Доступны поиск, вращение, приближение и скачивание GLB. Для редактирования открыть соответствующий файл из `blend/` в Blender.
Самостоятельная копия этого набора также включена в общую библиотеку `scene-objects/skp-vol03/`.

## Что подготовлено для VRM

В Blender есть коллекция `Figure references · no pose` с осями на местах исходных фигур. Численные привязки находятся в `metadata/*.json`. Позиция, вращение и масштаб берутся из одной и той же **мировой** матрицы, с учётом всей родительской цепочки. Сами `.blend` используют преобразование Y-up → Z-up, исходные матрицы в свойствах остаются в метрах/Y-up.

Это ориентиры исходной статичной геометрии, а не готовая поза VRM и не матрица крепления его корня. STL-фигура содержит геометрию уже в позе, и её локальное начало не обязано совпадать с pelvis/root аватара. Применять её матрицу напрямую к Rin/Mira/Kai неправильно. Точные точки опор, углы костей и IK требуют отдельной настройки под пропорции конкретного VRM.

Геометрия механики разделена по исходным компонентам и готова к выбору деталей в Blender. Однако механические оси, ограничения, скелетный риг, новые позы персонажей и функциональные анимации этой пересборкой не создавались. Непроверенных движений или фиктивных контактов в файлы не добавлено.

## Проверки

Проверено {counts['glbs']} GLB: {counts['validatorErrors']} ошибок, {counts['validatorWarnings']} предупреждений glTF Validator. Независимый читатель GLB сверил полные сцены с исходными SKP по габаритам и числу треугольников. В чистых сценах число треугольников равно полному исходнику минус ровно выбранные экземпляры фигур. Проверены все 24 повторных импорта в Blender. Подробности — `reports/`. Материальная поправка отдельно проверяется по физическому множеству треугольников и сохранению акцентных цветов: `reports/material-correction.json`. Перегруппировка лицевой/обратной сторон по материалам может изменить число треугольников, не меняя физические поверхности.
'''
(O/'README_RU.md').write_text(readme);(O/'reports/summary.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2))
for p in W.glob('*'):
 if p.suffix in ['.py','.cjs','.html'] and p.resolve()!=(O/'tools'/p.name).resolve():shutil.copy2(p,O/'tools'/p.name)
reader=W.parent/'skp-audit/glb_audit.py'
if not reader.exists():reader=W/'glb_reader.py'
if reader.resolve()!=(O/'tools/glb_reader.py').resolve():shutil.copy2(reader,O/'tools/glb_reader.py')
material_tool=W.parent/'skp-materials/verify_materials.py'
if material_tool.exists():shutil.copy2(material_tool,O/'tools/verify_materials.py')
# Copy into the standalone bundle, using hardlinks for immutable generated files.
D=B/'scene-objects/skp-vol03';D.mkdir(exist_ok=True)
allpaths=list(O.rglob('*'));allpaths.sort(key=lambda p: p.name=='catalog.json')
for p in allpaths:
 dest=D/p.relative_to(O)
 if p.is_dir():dest.mkdir(exist_ok=True)
 elif p.is_file():
  temporary=dest.with_name(dest.name+'.publish-tmp')
  if dest.exists() and os.path.samefile(p,dest):
   if temporary.exists():temporary.unlink()
   continue
  if temporary.exists():temporary.unlink()
  try:os.link(p,temporary)
  except OSError:shutil.copy2(p,temporary)
  temporary.replace(dest)
  if temporary.exists():temporary.unlink()
for root in [L,B/'viewer']:
 tmp=root/'scene_objects.html.tmp';shutil.copy2(W/'gallery.html',tmp);tmp.replace(root/'scene_objects.html')
p=B/'scene-objects/README_RU.md';s=p.read_text();entry='\n## Подготовленные SKP-модели\n\n`skp-vol03/` содержит исправленные GLB и Blender-файлы всех 24 моделей vol-03, без демонстрационных фигур, в метрах. Во вьювере предметов появился раздел «SKP · механические модели»: `scene_objects.html?kind=skp`. Привязки, проверки и ограничения — `skp-vol03/README_RU.md`.\n'
if '## Подготовленные SKP-модели' not in s:p.write_text(s+entry)
print(json.dumps(counts))
