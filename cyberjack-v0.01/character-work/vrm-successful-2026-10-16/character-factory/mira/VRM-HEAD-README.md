# Сменная VRM 1.0 голова и параметрическое тело

## Что работает

Основной редактор `evanescia-keys.html` имеет два варианта головы:
Mira (настоящий VRM 1.0 runtime) и прежнюю геометрию Evanescia. Mira сохраняет
151 исходный morph target, 18 preset expressions, глаза, зубы и язык. Выражения
применяет `VRMExpressionManager`, взгляд — `VRMLookAt` из three-vrm 3.5.4.
Выбор головы, выражения, взгляд, материалы и параметры волос сохраняются в URL.

Шея полностью принадлежит телу. Из модуля Mira удалён весь шейный примитив
`KK cf_m_body`: остаются 10 частей головы, а соединение проходит по оригинальной
границе Face из 26 вершин под челюстью и затылком. Морфы на этом контуре имеют
нулевые смещения (проверяется при подготовке), поэтому речь и эмоции не открывают щель.

Верхняя область шеи тела перестроена в регулярные кольца и включена в тот же
меш тела с общими вершинами у основания. Отдельного переходного меша и разреза
посередине шеи нет. Форма опирается на родные сечения тела у основания шеи и
контур головы у черепа. Каждый угол контура головы представлен на верхнем крае
тела; дополнительные вершины тела делят те же рёбра. Общие нормали согласованы
на границе головы. Подгонка пересчитывается после пропорций и анимации.

Для CPU измерений используется `updateMatrixWorld`, обновляющий также
bindMatrixInverse SkinnedMesh; одного Object3D.updateWorldMatrix недостаточно.
Анатомический материал кожи общий для головы и тела. Режим исходных VRM-материалов
головы сохраняет текстуры/MToon донора, но не переносит его тон кожи и UV на тело.

## Базовая посадка Mira / Evanescia

Модуль головы версии 3 подготовлен под родное сечение шеи тела на высоте 1.375 м.
Посадочный контур самой головы расширен до 66.9 × 61.5 мм. Правится нижняя область
головы по геодезической маске: 333 вершины вокруг отверстия, с плавным затуханием
по поверхности. Передняя область лица закреплена; 1572 проверенные передние вершины
и их морфы совпадают с предыдущим модулем точно. Глаза, зубы, язык и остальные
девять частей головы не изменены. Все 151 морф и 18 выражений сохранены.

Точка крепления и поворота головы смещена вперёд на 16.31 мм, чтобы посадочное
отверстие оказалось над осью поверхности шеи тела. В анимации этот сдвиг переносится
поворотом шейной кости, поэтому меняется положение сустава, а не только визуальный
вынос головы при её вращении. Волосы получают тот же перенос. Экспорт меняет rest
положение head в целевом риге и сохраняет калибровку в extras `canonicalFit`.

Это базовая подгонка конкретной пары моделей; стык шеи фиксирован.
Подготовка воспроизводится `python prepare-vrm-head.py`, источник VRM не меняется.
Результат и исходная сборка для сравнения сохранены в `work/head-face/fit-v2-backup/`.
Проверки: `check-canonical-asset.py`, `check-socket.cjs`
в `work/head-face/`; отдельный импорт и повороты готового файла —
`check-export-socket.cjs`. Отчёты находятся там же. Проверки границы не являются
доказательством отсутствия любых самопересечений при произвольных движениях.


## Экспорт

«Экспорт VRM 1.0» → «Скачать VRM» создаёт стандартный бинарный glTF с
`VRMC_vrm.specVersion = 1.0`, humanoid, expressions, lookAt и firstPerson.
Экспортируется выбранная фигура в T-позе, независимо от текущего кадра танца.
Карта выражений перепривязывается к узлам экспортированных частей лица;
151 морф сохраняется. Нейтральное лицо является базой, а не запечённой эмоцией.
Метаинформация и условия использования исходного VRM сохраняются.

Тело имеет 21 основной сустав и две кости глаз. Скиннинг экспорта использует
четыре нормализованных влияния на вершину. Параметры фигуры запечены в геометрию;
служебные extras сцены `characterFactory` дополнительно сохраняют значения
редактора. Это не универсальный стандарт параметрического редактирования VRM.

Материалы экспортируются в glTF PBR, включая необходимые текстуры; MToon-шейдер
не экспортируется как идентичный исходнику. Текстуры ограничиваются 2048 пикселями.
Волосы экспортируются с текущей посадкой и привязкой к голове; отдельные пружинные
цепочки волос, VRMC_springBone и независимые кости пальцев в этом этапе не входят.

`vrm-preview.html` — отдельный стандартный загрузчик VRM 1.0: открытие локального
файла, просмотр T-позы, приближение лица, выбор выражения и его силы. Он не использует
буферы/состояние основного редактора. Это просмотр и проверка, а не универсальный
параметрический импорт произвольного VRM.

## Запуск и файлы

Запуск из этой директории: `python serve-editor.py`. Адрес:
`http://127.0.0.1:8767/evanescia-keys.html`.
Сервер доступен только на localhost и сохраняет экспорт по единственному маршруту
`POST /api/exports/vrm` в `work/exports/Mira-Anatomy.vrm`, проверяя заголовок GLB
и версию VRM. На простом статическом сервере остаётся скачивание через Blob-ссылку.

- `prepare-vrm-head.py` — воспроизводимое извлечение головы из существующего
  `viewer/models/x20/mira/Mira_outfit_00.vrm`, без изменения источника. Сохранены
  индексы узлов выражений и морфы/UV; шейный примитив удалён целиком.
- `assets/heads/mira/head.vrm` — подготовленная голова, около 19 МБ.
- `assets/heads/mira/module.json` — источник, положение головы, посадочный масштаб,
  контур под челюстью, принадлежность шеи телу и данные выражений.
- `viewer-head.js`, `viewer-neck.js` — переключение, VRM runtime, цельная шея тела и посадка головы.
- `export-viewer-vrm.js` — сборка стандартного VRM 1.0 в T-позе.
- `vendor/three-vrm/` — локальная MIT-библиотека с LICENSE.

Для добавления другой головы нужен свой модуль с сохранёнными выражениями,
анатомической привязкой и проверенным контуром у основания черепа. Примерка произвольного VRM
не должна автоматически объявляться совместимым сменным модулем.

## Проверки и ограничения

`node work/head-face/check-socket.cjs` запускает проверки без рендера:
455 кадров × три варианта фигуры (база, все пропорции +0.3 и −0.3).
Граничные точки сравниваются с фактически скинненными точками головы и тела;
максимальный зазор 6.56e-8 м. Координаты конечны. Проверено применение выражений,
сборка VRM и повторный импорт через VRMLoaderPlugin: версия 1 и 18 выражений.
Отчёт `work/head-face/socket-validation.json`. Это проверка непрерывности границы,
а не доказательство отсутствия всех самопересечений и не тест всех крайних ползунков.

В браузере проверены переключение голов, смесь happy/blink/aa, сохранение URL,
показ стыка без волос, экспорт с текстурами, независимое повторное открытие и
полное моргание готового VRM. Работа во всех сторонних приложениях не проверялась.
Исходные Blender/VRM и прежняя голова сохранены.

## Встроенный редактор формы лица — прототип

Внешнее ПО не требуется. `viewer-face.js` строит кубическую B-spline решётку
19×29×19 управляющих точек в исходном пространстве головы. 31 семантический
параметров управляют контуром, скулами, челюстью, подбородком, глазами, бровями,
носом и ртом. Один и тот же объём деформирует все 10 частей головы и конечные
позиции каждого из 151 исходного морфа. Нормали преобразуются обратным
транспонированным локальным якобианом; GPU-текстуры морфов обновляются при
изменении формы. Поворотные точки глаз и обратные матрицы привязки следуют форме.
Контур соединения с шеей фиксирован; плечи и грудь не редактируются этим слоем.
Ручка `neck_base_w` удалена, старое значение URL игнорируется.

Панель: «Голова и лицо» → контур / глаза и брови / нос / рот. Диапазоны −1…1,
двойной щелчок сбрасывает один ползунок. «Сбросить форму лица» не меняет эмоции,
«Нейтральное лицо» не меняет внешность. Три заготовки — узкое, скульптурное и
округлое лицо — только пробы пропорций для Mira/Kai/Kate, не копии портретов.
В этой итерации нет редактора рисовки, новых текстур, ручного перемещения точек
решётки или полноценной системы корректирующих морфов для всех сочетаний эмоций.
Сложные смеси исходной мимики всё ещё требуют визуального контроля.

Кнопка «Сохранить в адресе» пишет `face_*`. «Сохранить лицо JSON» готовит ссылку
скачивания; загрузчик принимает только известные конечные числовые параметры,
версию 1 и основу `mira-canonical-1`. Форма сохраняется в геометрии экспорта VRM,
а параметры — в `scene.extras.characterFactory.head.face`. Сам редактор пока
не импортирует этот проект из произвольного VRM: для повторного редактирования
используйте JSON или URL. Исходный подготовленный `head.vrm` не изменяется.

Проверки: `check-face-cage.cjs` — 46 наборов параметров, положительный якобиан
на выборке пространства, нулевое смещение стыка; `check-face-editor.cjs` — крайние
сочетания, конечные координаты, точный сброс, URL; `check-face-integration.cjs` —
три заготовки × шесть выражений × три позы, перенос конечных точек морфов,
экспорт и повторная загрузка VRM 1.0. Это не доказательство отсутствия любых
самопересечений: художественная настройка и дополнительные корректоры впереди.

## Внешность и портреты

Встроенная панель «Кожа, глаза и брови» управляет цветом кожи, радужки и бровей.
В анатомическом режиме используется один материал кожи на лице, шее и теле.
При исходных материалах VRM цвет лица дополнительно взаимодействует с исходной
текстурой и освещением MToon — для единого вида кожи выбирайте анатомический режим.
Радужка перекрашивается по насыщенности пикселей, с сохранением нейтральных бликов,
чёрного зрачка и альфы. Брови перекрашиваются отдельно, включая тёмные исходные
пиксели. Исходные изображения текстур не меняются; новый Texture.Source и материалы
принадлежат только редактору. «Исходные цвета» освобождает созданные текстуры и
возвращает оригинальные материалы. Выражения продолжают работать независимо.

«Сравнить с портретом» показывает Mira, Kai или Kate прямо во вьюпорте. Доступны
четыре исходных портрета: neutral/smile/angry/surprise. Переключение референса не
изменяет модель; «Показать эту эмоцию» отдельно включает соответствующий VRM-пресет.
«Взять пробную палитру» меняет только три цвета. Это приблизительные палитры,
не извлечение внешности из изображения и не готовые копии персонажей. Рисунок ресниц, геометрия губ, волосы и художественное затенение пока не редактируются.

Цвета сохраняются в URL (`color_skin`, `color_iris`, `color_brows`), JSON проекта
(`appearance`) и metadata экспорта VRM. Экспорт использует текущие материалы и
текстуры, а не исходные. JSON версии 1 без `appearance` совместим и возвращает
исходные цвета. После «Сохранить лицо JSON» доступен и текст проекта для копирования.
Проверка: `node work/head-face/check-face-appearance.cjs`; дополнительно проверены
в браузере смена палитр, сброс, URL после перезагрузки, загрузка JSON и полный
текстурированный экспорт. У экспортированной радужки проверены зелёные пиксели.

## Процедурная рисовка кожи

`viewer-face-paint.js` один раз растеризует исходные треугольники лица в UV-атлас
1024×1024, сохраняя положение поверхности для каждого текселя. Из него строится
текстура веснушек, румянца и оттенка губ. Веснушки детерминированы, различаются
размером, вытянутостью и непрозрачностью, распределены на щеках и переносице с
плавным затуханием. Регулируются интенсивность, размер, количество и цвет;
для румянца и губ — интенсивность и цвет. Это процедурные маски на текущей голове,
а не инструмент свободного рисования или новые геометрические губы.

Текстура использует исходную UV-развёртку: следует форме и мимике без отдельного
меша или экранной наклейки. На затылке и шее маска нейтральная. В анатомическом
режиме материал лица клонируется из общей кожи, а тело сохраняет тот же базовый
цвет; в режиме VRM маска умножается на исходные карты MToon. Исходные текстуры и
геометрия не меняются. Генерируемые материалы и текстуры освобождаются при смене
настроек. «Убрать макияж и веснушки» сохраняет остальные цвета внешности.

Параметры рисовки сохраняются как числовые поля `appearance` в JSON и metadata
VRM, в URL — `paint_*`; цвета по-прежнему `color_*`. Палитра Kate включает
пробную рисовку. Старые JSON без этих полей совместимы. Экспорт содержит готовую
текстуру и не требует выполнения генератора для показа в другом VRM-вьюере.

`node work/head-face/check-face-paint.cjs` проверяет детерминизм, нейтральную
маску, защиту затылка, нулевое количество веснушек, неизменность геометрии,
сброс и URL. Дополнительно в браузере проверены два режима материалов,
моргание+AA, сброс и восстановление из URL. Полный экспорт прошёл структурную
проверку VRM и проверку замкнутого стыка; в PNG из GLB проверены размер и наличие
рисовки (`paint-export-validation.json`).

## Губы и ресницы

В группе «Рот» добавлены четыре параметра формы: полнота верхней и нижней губы,
изгиб центра верхней губы и положение уголков. Это локальная гладкая деформация
поверх базовой B-spline решётки, применяемая также к конечным точкам исходных
морфов. Ноль точно сохраняет исходную геометрию. Это настройка текущей топологии,
не замена аниме-рта фотореалистичной моделью губ. Сложные смеси эмоций по-прежнему
требуют художественных корректоров.

«Кожа, глаза и макияж» → «Ресницы и подводка»: длина, толщина подводки,
дополнительные ресницы и цвет. Исходные ресницы — альфа-текстуры на поверхностях
век. `viewer-lashes.js` находит внутренний и наружный контуры в UV, оставляет
область контакта с веком и меняет наружную часть рисунка. Дополнительные штрихи
рисуются с перекрытием существующей линии. Нижняя и верхняя подводки учитывают
разное направление роста. Геометрия век не перемещается этим слоем; native
моргание продолжает деформировать ту же поверхность. Для изменённых ресниц
используется материал с альфа-маской; при сбросе возвращаются исходные материалы.

Копии MToon-материалов, которые не входят в исходный список VRM.materials,
теперь явно получают update(0), включая обновление uniform alphaTest. Это
устраняет непрозрачные пятна бровей и глаз после редактирования внешности.

Все параметры сохраняются в прежних JSON/URL/VRM: губы — `face_*`, ресницы —
`appearance` и `paint_lash*`, цвет — `color_lashColor`. «Исходные ресницы»
сбрасывает только ресницы; общий сброс рисовки также удаляет их настройки.
Проверки: `check-lashes.cjs` — направление длины и толщины, альфа в области
контакта, неизменность источника; `check-face-cage.cjs` — 54 набора параметров,
положительный якобиан на выборке и неподвижный стык; `check-lips-integration.cjs`
— 90 сочетаний формы, мимики и поз, конечные точки морфов, маски MToon,
экспорт и повторный импорт. В браузере проверены изменение формы, blink+AA,
загрузка проекта и экспорт. Положительный якобиан не гарантирует отсутствие
всех самопересечений в произвольных сочетаниях исходной мимики.

## Контуры глаз и форма бровей

Добавлены группы «Форма глаз» (внутренний/внешний уголок, верхнее/нижнее веко)
и «Форма бровей» (изгиб, наклон, расстояние). Семь параметров — гладкие локальные
поля деформации поверх базовой решётки. Одно поле применяется к коже, векам,
ресницам и конечным точкам исходных морфов; точки поворота глаз следуют ему.
Параметры внешности не подменяют эмоции. Ноль возвращает исходную форму.
В каждом разделе формы теперь есть «Сбросить эту группу», не меняющий другие
разделы и рисовку. Пробные заготовки Mira/Kai/Kate получили параметры глаз и
бровей, но по-прежнему не являются копиями портретов.

Проверены 68 наборов параметров на выборке объёма (минимальный якобиан >0,
стык неподвижен); `check-eyes-integration.cjs` — 126 сочетаний формы, мимики и
поз. Браузерная проверка: крайние значения уголков/верхнего века, загрузка JSON,
моргание с новыми бровями и ресницами, экспорт VRM. Диапазон консервативный:
эта итерация уточняет существующую голову, а не меняет её топологию.

## История и библиотека вариантов лица

`viewer-face-workflow.js` добавляет историю до 60 состояний лица: форма,
рисовка/цвета, выражения, взгляд и режим материалов. Одно движение ползунка
объединяется в один шаг; новый шаг после отмены отбрасывает ветку повтора.
Поддерживаются кнопки и Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y. В текстовых
полях остаётся стандартная отмена текста. История действует в текущей вкладке
до перезагрузки; это история лица, не сцены, тела или волос.

«Мои варианты лица» хранит именованные копии формы и внешности в localStorage
(`cyberjack.face-library.v1`). Загрузка варианта сохраняет текущую эмоцию и
взгляд; её можно отменить. Повторное сохранение создаёт новую копию, даже при
одинаковом имени. Библиотека сохраняется при перезагрузке, содержит до 50
вариантов; перенос между браузерами/устройствами — через существующий JSON.
Облачной синхронизации нет. При ошибке хранилища показывается сообщение,
несохранённая запись не объявляется сохранённой. Повреждённая библиотека не
перезаписывается автоматически.

Загрузчик JSON и библиотека используют общую проверку `cleanFaceProject`:
версия/основа, конечные числовые параметры с ограничением диапазонов, цвета,
отбрасывание неизвестных ключей. Исходная схема JSON версии 1 совместима.
Риг, геометрия и формат экспорта этим модулем не меняются.

Проверка: `node work/head-face/check-face-workflow.cjs` — группировка жеста,
отмена/повтор, ветвление, лимит истории, неизменность снимков, проверка проектов,
повторное чтение библиотеки, одинаковые имена, отказ записи и повреждённые данные.
В браузере проверены сохранение рабочего варианта Kate, смена заготовки,
отмена/повтор кнопками и клавиатурой, загрузка варианта и сохранность после
перезагрузки. Рабочий вариант сохранён в локальной библиотеке пользователя.

## Kate likeness pass (2026-10-24)
Added cheek volume, chin rounding, nose tip, brow alpha thickness and iris tone controls. All identity controls transform the original expression endpoints through the common cage; the socket stays fixed. Saved candidate: work/head-face/kate-likeness-v2.json (also in browser library as Kate · сходство v2). Face and palette study only: hair, nose/nostril definition and original iris highlights still differ substantially from the portrait. Head close-up now uses a frontal camera.
Validation: 74 cage cases, positive sampled Jacobian; 144 expression/animation cases including this Kate candidate, 18 expressions and 151 targets retained through VRM export/reimport; appearance pixel and workflow regression tests pass.

### Kate eyes and nose
Independent irisSize scales only the two iris meshes in their original local planes, before the shared cage. Base, expression endpoints and normal Jacobians use the same transform; zero restores source data. irisHighlights attenuates neutral bright texture pixels; noseShade adds UV-anchored soft nostril/alar shading (paint, not nostril geometry). Candidate: work/head-face/kate-eyes-study.json; browser library: Kate · глаза и нос. 144 expression/animation cases plus export/reimport pass; cage 76 variants, paint/reset and workflow tests pass.

### Lip alignment correction
Actual rest mouth seam is around source Y=1.4355; previous detail masks used 1.438. Upper/lower fullness now uses separate continuous bands around 1.4367/1.4338, with two cupid-bow lobes. Lip paint uses asymmetric upper/lower contours and front-surface gating, following original UVs through expressions. Existing saved identities use the corrected implementation. Browser candidate: Kate · исправленные губы. Cage 76 variants positive; 144 expression/animation cases and VRM roundtrip pass; paint deterministic, reset exact.

## Rest-surface mouth prototype
viewer-mouth.js adds an opt-in mouthSculpt (0..1) rest-surface reconstruction on the existing face topology. It expands upper/lower vermilion bands from the neutral seam and reconnects them to surrounding skin with a monotone transition, plus independent upper/lower projection profiles. This is a geometric rest-shape prototype, not replacement topology or a finished Kate mouth. No overlay mesh or external tool.
FaceEditor transports expression endpoint offsets from their original rest vertices onto the reconstructed base before the common face cage; it no longer reclassifies an open-mouth endpoint against the neutral lip mask. Zero preserves the previous engine. Normals use the rest-map Jacobian. The patch keeps the analytic seam and protected neck fixed. Candidate: work/head-face/kate-mouth-surface.json.
check-mouth-patch.cjs checks sampled Jacobians, fixed seam and exact zero; check-mouth-surface.cjs checks 144 expression/animation cases plus VRM roundtrip with mouthSculpt retained. Visual shape remains a prototype and requires refinement against the portrait.

Saved final prototype in browser as Kate · новая основа губ. Neutral, happy and surprised were visually inspected. The new surface expands the full lip band (rather than only bulging its middle); the transition to surrounding skin remains smooth. Sampled patch Jacobian minimum 0.60797, analytic seam fixed. Test VRM roundtrip now exports the actual mouthSculpt candidate, retaining mouthSculpt=1. Final appearance remains stylized and has a pronounced lip rim; portrait likeness is not complete.

### Softer lip contour
Reduced additional lip-patch projection while retaining full band expansion. Added appearance.lipCoverage (0..1), exposed as Ширина окраски губ: it widens the UV-anchored upper/lower pigment bands so the expanded outer lip does not retain a pale skin rim. Existing identities default to 0. New study: work/head-face/kate-mouth-soft.json, browser Kate · мягкий контур губ. Pixel coverage regression: 696 to 956 tinted pixels at 512px, no changes outside the mouth; 144 expression/animation cases and VRM parameter roundtrip pass.

## Mouth contour editor
viewer-mouth-curves.js provides 15 vertical knot offsets (5 each for upper/seam/lower), fixed corner endpoints and 2 profile depth offsets. Knots use bounded cubic smoothstep interpolation, applied to the reconstructed rest surface with a smooth transition to adjacent skin. Outer contours are constrained to remain on their respective side of the shared seam. FaceEditor transports native expression offsets from original rest vertices through the new identity shape.
UI: Голова и лицо → Кривые формы рта, schematic front and profile editors, symmetry toggle, pointer drag and arrow keys, neutral/happy/aa/ih/ou previews, reset. Front knots currently move vertically only, width uses mouthWidth; corners and horizontal knot placement are not editable in this version. The diagrams are controls, not overlays or measured render projections.
Parameters are flattened mouthCurve_* numeric face keys so history, library, JSON, URL and VRM metadata share the existing pipeline. A pointer gesture groups as one undo. Tests: check-mouth-curves.cjs (identity reset, symmetry, positive sampled Jacobians), check-mouth-curves-integration.cjs (144 expression/animation cases and actual edited-contour VRM roundtrip), workflow suite. Browser drag and undo verified. This remains a prototype; extreme combinations need further art-direction and expression-specific correction, no new corrective expression library is claimed.

### Kate portrait contour fit
Candidate work/head-face/kate-portrait-mouth.json / browser Kate · портретный контур: reduced mouth width and band expansion, separate cupid peaks, flatter lower contour and less saturated pigment. Fixed chinRound: its old displacement was suppressed by the broad donor-neck mask, so it now acts as a direct continuous front-chin field before the exact aperture pin. Aperture stays fixed. 112 cage variants have positive sampled Jacobians; 144 expression/animation cases and VRM roundtrip of this candidate pass. Neutral and surprised inspected in browser. Likeness remains partial, especially nose, eyelids and hair.

## Direct lip-row binding
prepare-mouth-bindings.py extracts four real edge chains from the immutable head.vrm using topology and fixed neutral seeds. It writes mouth-bindings.json and viewer-mouth-binding-data.js, including source SHA256 and original vertex IDs. viewer-mouth-bound.js maps these source rows directly onto upper border / upper seam / lower seam / lower border target curves; intermediate vertices retain band coordinates, surrounding skin has a bounded transition. Enabled only by mouthCurve_binding=1; prior saved shapes remain on the previous path. The UI checkbox is Привязка к краям сетки. In bound mode the front diagram samples the same target curves used by geometry, instead of the former schematic arch.
viewer-mouth-normals.js reconstructs local lip normals and all normal morph endpoints from deformed triangles with welded duplicate positions; transported artist normals alone gave a false rim at the compressed seam. Mouth position morph offsets are transported from the original rest vertex, preserving original VRM expressions. No new topology, UV or vertex count is introduced.
Tests: check-bound-mouth.cjs validates source hash, 96 exact edge-anchor targets (zero error), disabled exact reset and positive sampled Jacobians. check-bound-mouth-integration.cjs checks edited shape with 144 expression/animation combinations and VRM roundtrip retaining the binding flag. Candidate work/head-face/kate-bound-mouth.json. This proves binding/compatibility, not finished portrait likeness or absence of every possible self-intersection.

Final binding uses visible front seam seeds (1.43631/.06438 upper, 1.43415/.06299 lower), not inner oral folds. Bound lips are protected in a local affine mouth frame from broad chin/jaw compression. Transition is deliberately broad enough to avoid a fold found in the initial narrow blend; check-bound-mouth-frame.cjs samples the composed map, minimum determinant 0.103216 on the current candidate. check-bound-mouth-anchors.cjs verifies 48 actual mesh vertices after the entire face pipeline, maximum world error 5.86e-8 m. Original outer-border depth is retained, with convex band profiles between border and seam.

Bound paint now samples the same source edge rows; appearance cache includes binding mode so switching modes repaints correctly. Saved browser entry: Kate · привязанные контуры. Checked neutral clay at close range, restored colour and visually checked aa/open mouth. Final candidate uses restrained seam/upper knot offsets; portrait shape is still provisional, not a claim of matched Kate lips.


### Kate: softer bound lip profile (2026-10-24)

`work/head-face/kate-bound-fit.json` is a separate editable fitting trial, saved in the browser library as “Kate · мягкий профиль”. It reduces mouth width and projection, flattens the lower arc and uses a softer lip pigment. The previous bound contour trial remains available. This is not a finished portrait match: the closure line still has excessive contrast and the upper lip shading needs further work. Front and three-quarter views, smile and surprise were inspected. `node work/head-face/check-bound-fit.cjs` passed 144 shape/expression/dance combinations and the VRM 1.0 round trip (18 expressions, 151 morph targets); numerical transport checks do not establish visual correctness of every expression.


### Bound mouth profile v10

The closure rows are recessed by 1.2 mm times the lateral falloff, while the upper lip receives a convex belly (2.5 mm default, depth control retained). Outer boundary positions remain unchanged. The latest Kate trial is viewed with original VRM materials: anatomy lighting still exaggerates the dark upper-lip fold. This is a shading comparison, not a finished portrait match. Source-row anchor checks, positive sampled Jacobians, 454 front triangle orientation checks and 144 shape/expression/dance cases with VRM round trip passed.


### Independent lip bow controls

The “Изгиб губ” group exposes peak spacing, peak height, central notch and corner curvature. Editing these controls enables the mesh-bound contour mode. Geometry and the curve diagram share targetMouthRows; the four controls are serialized through face JSON, history, library and VRM metadata. Kate trial: work/head-face/kate-lip-bow.json, library “Kate · изгиб губ”. The upper edge has 15 source vertices; strong settings visibly become angular, so this trial uses a moderate bow. Tests: independent control response and ordered contour rows across all 16 extreme combinations, positive sampled composed Jacobian (~0.100), workflow/history, 144 integration cases and VRM round trip including retained peak/notch values.


### Lower lip contour

Added independent lipLowerHeight and lipLowerArc controls to “Изгиб губ”. They deform only the lower outer row, leaving both closure rows and upper contour unchanged; the same outer-row displacement fades into adjacent skin. Kate trial increases lower height (.55), broadens arc (.45), and uses existing lower profile depth .35. Saved as “Kate · нижняя губа”, work/head-face/kate-lower-lip.json. Tested contour isolation/order, composed Jacobian (~.100), 144 expression/dance integration cases and VRM metadata round trip.


### Full lip profile and local refinement

Added lipProjection (moves all four lip rows forward, fading into surrounding skin) and lipRoundness (additional cross-section belly). Kate trial work/head-face/kate-full-lips.json is saved as “Kate · объёмные губы”. viewer-mouth-refine.js conformingly splits local mouth edges in two passes before FaceEditor caching. Original vertex IDs remain stable; UVs and all morph deltas interpolate, skin influences merge and normalize. Refined skin outline shells are hidden in bound mode because expanded outline geometry draws duplicate contours around the new lip volume. This removes the face outline too. Validation: synthetic refinement triangle orientation and normalized weights; 144 shape/expression/dance integration cases and VRM1 round trip retaining 151 targets, 18 expressions and lipProjection. Profile is fuller but portrait likeness remains a work in progress.


### Vertical lip section correction

User correctly identified thin projecting lips. Added lipVerticalVolume: .0035 times value increases each outer contour height away from the fixed closure. Projection now contributes only 20% at outer skin boundaries and 65% at the closure, while band bellies carry the volume. Kate uses vertical volume .7 and reduced projection .45. Central section heights are ~4.06 mm upper and 5.92 mm lower, versus ~1.61/3.47 mm previously. Saved as “Kate · полнота сечения”, work/head-face/kate-lip-section.json. Lower profile is rounder; upper profile remains sharper than the likeness target. Vertical displacement/isolation and boundary setback tests, positive sampled Jacobian, 144 integration cases and VRM round trip passed.


### Rounded sections (bound-mouth-20)

Replaced additive transport of donor depth folds with smooth target-depth interpolation plus the residual from the source linear section. Roundness now uses a zero-slope squared-sine belly at the band boundaries. Softened the adjacent skin depth transition without collapsing its depth dimension (retains at least 50% residual). No new control or candidate settings were needed. Visually checked front, side and open mouth. The upper lip silhouette still has a sharper tip than desired, so this is an incremental rounding correction, not a finished anatomical result. Anchor checks preserve 96 exact target positions and sampled Jacobians remain positive (minimum ~.100 for the current composed face frame).


### Curved lip rolls

New opt-in mouthCurve_rolls mode replaces the old depth-bulge profile with two half-superellipse sections transported along the authored mouth curves. lipRoll_upperHeight/lowerHeight and upperDepth/lowerDepth independently control section dimensions; lipRoll_roundness changes the section exponent, preserving maximum depth; lipRoll_seamDepth controls closure recession. viewer-lip-rolls.js supplies both geometry and the new UI side-section preview. A 3% linear height term keeps the band mapping invertible at boundaries. Old profiles remain available when the mode checkbox is off, and their controls are hidden in roll mode. The obsolete profile drag diagram is hidden too. Reused UI groups are now merged rather than duplicated. Kate trial: work/head-face/kate-lip-rolls.json. Tests: 1212 section samples across height/depth/roundness extremes (monotonic height, fixed depth, symmetric rounded front), 48 exact mesh-chain anchors, positive composed sampled Jacobian (.092), workflow/history and 144 expression/dance combinations with VRM round trip retaining roll mode and all 151 morph targets. Overall likeness is still unfinished.


### Reference fitting comparison

Compared Kate neutral portrait and editor front at approximately matching interpupillary scale in work/head-face/kate-comparison.html (screenshots are uniformly scaled, no axis stretching). Trial work/head-face/kate-reference-fit.json broadens mouthWidth to .1, reduces upper roll height to -.3, softens peaks/notch, lengthens face to .45, noseLength .55, mouthHeight -.1, eyeOpening -.5 and browArch .35. Saved in browser as “Kate · сверка с портретом”. Nose/mouth vertical placement is closer, but likeness is unfinished: brows are thin, lids simpler, chin pointed, nose/nostrils differ, lip seam lacks reference contrast and lower-lip highlights. Comparison HTML and screenshot make these differences reviewable.


### Local-mass mouth prototype

Open `http://127.0.0.1:8767/lip-lab.html`. Separate prototype, not attached to the character or VRM exporter. `lip-surface.js` generates two sampled lip surfaces with three upper and two lower Gaussian mass fields; depth fullness vanishes toward corners independently of outer contour height. Rounded section parameters preserve local anatomy while explicit expression coordinates stretch/thin smile, open the jaw for AA, and narrow/evert OU. Controls include centre/side mass strengths, widths/spacing, bow and lower contour height. Neutral/happy/AA/OU transition smoothly, with an intensity slider and automatic cycle; front/profile/three-quarter views and wireframe are available. JSON format `cyberjack-lip-surface` version 1 is intentionally separate from face JSON.

Validation: `node work/head-face/check-lip-surface.cjs` checks 20,790 surface samples in neutral, smile, AA, OU and a mixed pose: finite coordinates, ordered seam, symmetric neutral, localized fullness, independent upper/lower masses and valid indices. Browser visually checked neutral/profile/AA/OU/smile. This is an analytic prototype, not transplanted VRM expressions. No volume conservation, lip contact solver, teeth/tongue, integrated per-expression corrective morphs, or VRM baking are implemented yet.


### Mouth corner falloff

Added fullnessWidth, cornerMass and taperSharpness to the standalone lab. A shared super-Gaussian envelope now attenuates both vertical section height and depth/closure volume toward corners; previously only depth mass was localized, leaving a visible thick ribbon. Existing prototype JSON receives these defaults on load. Tests additionally verify corner section height below 10% of central height and unchanged central volume under envelope edits. This remains an analytic shape exploration tool, not an authored production neutral face or a full facial rig.

### Lip lab: редактирование направляющих (2026-10-24)

В `lip-lab.html` добавлены 27 точек: общая линия смыкания, края и середины поверхности верхней и нижней губы. Точки перемещаются в плоскости экрана; профиль позволяет менять глубину. Есть числовые смещения в мм, симметрия, отмена/повтор и сброс точки. Нейтральные правки и корректирующие слои happy/aa/ou разделены; нейтральная правка переносится через локальные масштабы выражения, корректирующая включается с интенсивностью своей эмоции. JSON v2 сохраняет слои, загрузка v1 остаётся совместимой. JSON также доступен текстом для браузеров без скачивания Blob.

Проверено: перетаскивание, зеркальная числовая правка, отмена жеста, сохранение и восстановление через JSON в браузере; 6970 выборок направляющих и 20790 выборок поверхности. Это отдельный прототип: перенос на VRM, полноценный контакт губ и интеграция с окружающей кожей ещё не реализованы. Текущий перенос выражений — приближение локальным масштабом, а не полноценный лицевой риг.

Lip lab: добавлены независимые ширины полной зоны верхней/нижней губы и два параметра изгиба смыкания. Кнопка «Кейт · пробная форма» применяет отменяемый эскиз с более низкой верхней губой и полной нижней. Это ориентир для подгонки, не завершённое сходство. Исходная пользовательская форма перед заменой сохранена в outputs/face-engine/lip-before-kate.json текущего чата. Проверены нейтраль, улыбка, А/У; отсутствие окружающей кожи всё ещё даёт вид отдельных лент на раскрытии.

### Lip lab: окружающая кожа
Добавлен переключаемый тестовый участок кожи вокруг рта. Внутренняя граница берётся непосредственно из внешнего края губ для каждой позы и правки направляющих, внешняя фиксирована. Нормали совпадающих вершин усредняются между поверхностями; наклон края затухает в локальной зоне. Проверка check-lip-skin.cjs: 15390 вершин, совпадение границы и фиксированный внешний контур на пяти состояниях с направляющими. Это не сетка головы: отсутствуют нос, подбородок, внутренняя полость с зубами и контактный решатель. Край уголка теперь сходится в общей точке без искусственного зазора 2 мкм.

### Проверка родного VRM, 2026-10-24
`vrm-mouth-check.html` загружает две независимые копии assets/heads/mira/head.vrm через VRMLoaderPlugin. Слева исходная, справа FaceEditor из основного редактора; родные aa/happy/ou управляются VRMExpressionManager. Лабораторная геометрия не используется. Перестроение bound/rolls включается явно: оно само меняет основу губ, даже при нулевых ручках, поэтому не следует считать скачок от включения результатом небольшой правки. Полный пересчёт FaceEditor блокирует UI на несколько секунд; это ещё требует оптимизации. Проверены загрузка VRM1, изменение нижней губы и родной aa=1. Экспорт изменённого VRM не реализован этим стендом.

### Относительные правки родной основы VRM
В FaceEditor добавлен опциональный mouthNative. Он вычисляет разницу boundMouth(values) − boundMouth(нулевой профиль), а не заменяет исходную нейтраль профилем валиков. Нули дают тождественную геометрию. На морфах добавляется тот же нейтральный offset: исходные векторные смещения мимики сохраняются. Это намеренно ограниченный базовый перенос, без переноса вращений локальных рамок и корректирующих форм. Проверочный vrm-mouth-check использует этот режим; ранее сохранённые лица без mouthNative работают по прежней схеме. Кэш смещений в пределах apply устраняет повторный расчёт одного offset на каждом morph endpoint. check-native-mouth: 819 точек, тождество при нулях и конечные значения.

### Перенос правок по поверхности морфа
mouthNative теперь переносит нейтральный offset через ортонормированные рамки треугольников донорского морфа, усредняя поворот по площади. Объём не масштабируется растяжением треугольника. Пересчитываются существующие morph targets, отдельный runtime-риг не добавляется. Индексы затронутых треугольников отбираются один раз на apply. Модульные проверки: тождество, поворот90°, нулевая правка, вырожденная грань. Интеграционная проверка на реальном VRM: крайние сочетания всех71контролов конечны, сброс точный, maxSocketGap 5.75e-8м. Контакт губ, корректоры сочетаний и точные нормали смешанных морфов ещё не решены; полное изменение формы пока тяжёлое для интерактивного UI.

### Крупный план и видимая полнота
Проверочный стенд теперь рисует два синхронных крупных плана: исходник слева, правки справа. Есть профиль, матовый материал, числовые показания и кнопка умеренно полных губ. Новый mouthNative больше не использует разность двух перестроенных сечений: она давала заломы. Вместо неё применяются плавные поля по исходной поверхности с закреплённой линией открытия и затуханием к уголкам. Высота и глубина независимы. Сила 0–3 — диагностический диапазон стенда, экстремумы не гарантируют приемлемую анатомию.
Подбор формы пересчитывает нейтраль без морфов (previewNeutralOnly), отключая интенсивность эмоции. Кнопка «Пересчитать эмоции» отдельно обновляет все морфы — операция остаётся тяжёлой. Визуально проверены заметная разница нейтрали спереди и профиля; новую сильную форму на эмоциях в этом проходе не оценивали. Смыкание и сходство с Кейт не завершены.

### Проверка полной формы на выражениях
В диагностическом матовом режиме отключены outline-материалы VRM, чтобы их оболочка не имитировала складки. Перенос offset теперь объединяет совпадающие вершины швов (с одинаковыми исходной и целевой позициями), сглаживает только поправки поворота по соседям. Добавлено консервативное ограничение силы правки отдельно для каждой цели морфа: отбирается максимальный из дискретных коэффициентов, не меняющий ориентацию донорских треугольников и не схлопывающий их площадь. Это может уменьшать полноту при эмоции; это не контактный решатель и не гарантия отсутствия самопересечений/проблем между endpoint-позами.
Стенд пересчитывает только bindings aa/happy/ou (в этом ассете 40 целей в сумме). check-native-expressions.cjs: 122912 сравнений треугольников, до ограничения608 перегибов>90°, после0; конечные вершины при трёх выражениях, незатронутые цели не меняются, точный сброс. Добавлены check-transport-seams и check-transport-safety. Исходный happy в этом ассете почти не меняет рот; полноценная улыбка требует отдельной работы.

### Сведение и общая зона смыкания
Уточнение: старые rows.upperSeam/lowerSeam отмечают складки поверхности, а не точные края отверстия. Попытка жёстко закрепить эти строки ухудшала нейтраль и отклонена. Новый вариант оценивает узкую зону смыкания относительно этих ориентиров: внутри неё у верхней/нижней поверхности общее смещение Z и нет вертикальной деформации от высоты валиков. Это приближённое поле, не топологически точная привязка к краю. Добавлен lipSeal — ограниченное сведение к средней линии; в пробном пресете .8. Отрицательные значения lipSeal ничего не делают. Это не контактный решатель; самопересечения не исключены. Шаг ручек стенда .01 соответствует значениям пресета .55/.65.
Проверка check-native-closure: 164 отсчёта, общая глубина и отсутствие вертикального раздвигания от ручек полноты. Проверочный preset и интеграционный тест включают lipSeal=.8.

Коррекция по визуальной проверке: общее смещение Z в полосе смыкания давало лишнюю складку на раскрытии и удалено; сохранено прежнее плавное поле полноты. lipSeal теперь исключается из целевых offset при пересчёте морфов: сведение отпускается с интенсивностью выражения, а полнота переносится. Это не фиксирует контакт в произвольных смесях. check-native-closure теперь проверяет само сведение, отсутствие перехода через среднюю линию и тождество при gain0 (738 отсчётов), а не отвергнутую модель общей глубины.
Сведение отпускается только для целей, у которых есть донорское движение в зоне губ. Морфы глаз/бровей без движения рта сохраняют сведение, чтобы blink/happy без артикуляции не меняли нейтраль рта сами по себе.

### Контур губ Кейт: первый вариант
viewer-mouth-presets.js содержит kateMouthPreset; кнопка «Кейт · пробный контур» на VRM-стенде задаёт его отдельно от общего пресета полноты. Добавлены lipFullnessWidth (локализация полной зоны) и lipSeamCurve (изгиб линии смыкания с узким затуханием по Y, чтобы не придавать W-форму нижнему краю). Контролы зарегистрированы в FaceEditor. Рядом показан кроп нейтрального портрета. Это геометрический эскиз по фронтальному референсу; профиль — проверка объёма, не реконструкция по референсу профиля. Формат проекта для основного редактора: work/head-face/kate-mouth-study.face.json. Интеграционная проверка --kate: 122912 сравнений, 0 перегибов>90°, 40 целей, конечные позы и точный сброс. Сходство не завершено.

### Лёгкий макияж на VRM-стенде
`viewer-mouth-makeup.js` задаёт плавную маску по исходным координатам губ. Стенд хранит цвет на вершинах, поэтому он следует за геометрией/морфами. Справа в матовом режиме доступны включение, оттенок (#ba7882), интенсивность (.48), мягкость (.55) и локальный блеск (.35). Блеск меняет roughness только в маске губ; белые точки референса не нарисованы на геометрии. Выключение возвращает исходный color attribute, если он был. Исходная модель слева не окрашивается.
Это диагностический материал стенда, не экспортированный VRM-материал и не изменение основного FaceAppearance. Проверен shader в браузере без ошибок, включение/выключение, 3721 отсчёт маски (диапазон, локальность и симметрия). Для VRM-экспорта маску понадобится запечь в текстуру/поддерживаемый материал; этот экспорт не реализован.

### Рисунок макияжа по референсу
Равномерная заливка заменена управляемым градиентом: верх темнее у смыкания, нижняя центральная часть теплее, цвет нижнего внешнего края слабее. Раздельные слои pigment/shade/warmth/gloss привязаны к исходной поверхности. «Рисунок по рефу» 0 возвращает равномерную тонировку,1включает новый рисунок. Добавлены два небольших стилизованных светлых акцента на верхней части нижней губы, с отдельной силой; это рисованные акценты, а не физические отражения. Они следуют за вершинами при морфах. Проверка check-makeup-pattern:3721отсчёт, диапазоны, различие центра/края, тёплый нижний центр, локальный блеск и режим равномерной заливки. Материал по-прежнему только диагностический, в экспорт VRM не запечён.

### Стабильная гладкость губ
Найдена разница shading до/после «Пересчитать эмоции»: раньше native-предпросмотр пересчитывал геометрические нормали только в нейтрали, а при полном пересчёте возвращался к донорским нормалям через другую схему. Теперь локальные нормали и normal morph endpoints восстанавливаются одинаково из актуальных треугольников. Добавлены два ограниченных прохода сглаживания нормалей, без усреднения через противоположные направления.
Добавлен viewer-mouth-smooth.js: локальные пары Taubin для геометрии нейтрали и морфов, с группировкой совпадающих вершин. Полоса смыкания и внешний край патча закреплены. lipSurfaceSmooth управляет силой; пресет Кейт .7. Сглаживание применяется только при реальном изменении native-геометрии, чтобы включение режима с нулевыми правками не сглаживало донорскую голову само по себе. Это уменьшение мелких неровностей, не контактный решатель и не гарантия отсутствия всех складок в смешанной мимике.
Проверка check-mouth-smoothing: конечность, нулевая сила, ослабление пика, закреплённые края. check-native-expressions --kate после сглаживания:122912 сравнений,0 перегибов>90°,40целей, точный сброс.
check-normal-consistency подтвердил: разница нормалей нейтрали до/после полного пересчёта0, позиции совпадают побитово, normal morph targets конечны. Проверена поверхность в браузере без макияжа, затем раскрытиеaa=1; после проверки возвращена нейтраль с макияжем.

### Замена источника складок, а не дополнительное сглаживание
Предыдущие нормали по треугольникам и Taubin не дали требуемой гладкости даже в нейтрали. В native-пути они больше не применяются, ручка lipSurfaceSmooth убрана из редактора/пресета. viewer-mouth-smooth.js остаётся только экспериментальным модулем, не подключённым к FaceEditor.
Новая деформация: гладкая аналитическая средняя линия вместо кусочно-линейных rows; сумма двух Gaussian пиков вместо abs(x)-пика с изломом в нуле; более широкие поля объёма. Высота/сведение задаются интегралом положительного локального масштаба (12 отсчётов), чтобы сочетание ручек не схлопывало высоту. Сила высоты и контура насыщается при gain1; дополнительное усиление до3 касается глубины. В native-пути сохраняются авторские сглаженные нормали, преобразованные обратным транспонированным якобианом; треугольные нормали их больше не заменяют. Это сохраняет гладкую светотень исходной головы.
check-native-warp-smooth:21960отсчётов, gain0/1/3, крайние комбинации, минимальная производная по Y .127, без центрального cusp. Проверены нейтраль без макияжа и объём в профиль. Изменение полей немного меняет прежнюю посадку пресета Кейт, она требует дальнейшей подгонки; гладкость важнее прежних узких искусственных складок.

### Макияж с акцентом на центральную округлость
Добавлен makeup-centre (0–1, default.8). Пигмент и тень смыкания в режиме рисунка затухают Gaussian-огибающей к краям; прежнее дополнительное затемнение уголков удалено. Тёплый центр нижней губы и блеск используют ту же центральную зону. При pattern0 сохраняется прежний равномерный режим. check-makeup-central проверяет край/центр<12%, ослабление тени края и работу концентрации. Геометрия не менялась, пользовательские нулевые ручки формы сохранены при проверке.

### Повторная подгонка формы к рефу после гладкого warp
Обновлён kateMouthPreset: upperHeight.65/lowerHeight1, upperDepth.5/lowerDepth.75, roundness.65, peaks.75/notch.55, seal.35 вместо.85, центральная зона-.35. Слишком сильное сведение скрывало высоту; теперь оно слабее. Уточнены широкие Gaussian-валики (верх centre+.0014/радиус.0019, низ centre-.0017/радиус.0025 с roundness-множителем). Поле пиков верхнего контура усилено до.0010 с плавным переходом tanh по.004м — без узкого излома. Новая проверка положительного масштаба:21960точек, минимум dY/dy .10595; real-VRM --kate:122912сравнений,0перегибов>90°,40целей, resetточный. Макияж.88 сохранён как стартовая интенсивность по пользовательской настройке. Это эскиз формы по фронтальному рефу, не утверждение достигнутого сходства.

### 2026-10-24 · Separate target surface study

`viewer-mouth-target.js` defines one authored neutral study, selected by
`mouthNative:1, mouthTarget:1`. This is a separate path from the earlier relative
Gaussian warp. Upper outline, closure curve, lower outline and front cross-sections
are explicit; their added mass tapers toward the mouth corners. The target front
surface replaces the sampled donor section, with a continuous transition to skin.
No new mouth object or skeleton is created. The reference is Kate's frontal neutral
portrait; the depth is an authored hypothesis, not a fitted profile reference.

The source surface (`viewer-mouth-source-surface.js`) is generated by
`work/head-face/prepare-mouth-source.cjs` from the unchanged donor geometry.
Rays passing through the oral opening must be bridged over the outer skin: using
cavity hits as front-surface samples caused severe corner folds in the first trial.
The historical `upperSeam/lowerSeam` rows are surface folds, not opening boundaries.

`vrm-mouth-check.html`: «Кейт · новая поверхность без макияжа» selects the study,
turns makeup off, and exposes target blending plus mouth width. Legacy volume
controls are disabled in this mode because they belong to the other model.
Buttons stay disabled until the head loads. The comparison light now has ambient
fill on both heads. Neutral and expression normals are rebuilt from the edited
surface, with additional normal smoothing for this path only. «Пересчитать эмоции»
uses the existing donor-frame transport for aa/happy/ou. Happy mostly affects eyes
on this donor and is not evidence of a successful smile. The study does not yet
establish reference likeness, expression combinations, contact solving, or a
validated VRM export.

Validation: `check-target-surface.cjs` samples 42,336 points, checks finite outputs,
identity at zero and a positive local Jacobian (minimum 0.0267), and rejects cavity
samples in the front surface. `check-target-neutral.cjs` checks finite vertices and
normals, unchanged indices/UVs and exact reset. `check-target-expressions.cjs
--target` checks selected real VRM expression targets, finite posed vertices,
unchanged unselected morphs, exact reset, and donor-relative triangle orientation
at the expression endpoints. These are integrity checks, not an aesthetic approval.
Preset: `work/head-face/kate-mouth-target.face.json`.

2026-10-25 follow-up: lower-pad target height increased centrally, with smaller
fullness radius (15 mm). Neutral closure now integrates a positive local vertical
scale. The target path honours `lipSeal:0` when computing open-expression offsets,
so neutral sealing is released at aa/ou endpoints. `check-target-closure.cjs`
checks a positive gap, narrowing from 0.356 mm to 0.042 mm at the central donor
opening samples, and identity at zero target strength. These numbers describe
those two samples, not a complete collision/contact test. Zero strength remains
in target mode rather than falling back to the legacy sealing warp. Diagnostic
controls preserve that mode at zero; legacy presets explicitly clear it.

The target's expression transport additionally calls `thinStretchedMouth`: a
welded rest/posed area ratio reduces added thickness on stretched surface patches
(clamped to 0.45–1, smoothed across neighbouring welded vertices). This is an
approximate volume response, not a tissue or collision solver. It changes only
the new target path and is verified by `check-mouth-stretch.cjs` on identity and
4× surface-area stretch. Geometry safety checks run after this thickness step.

### 2026-10-25 · Shading experiment reverted

The author-normal blending experiment was rejected visually by the user.
Restored the previous target-mouth geometric normal reconstruction, including
its six smoothing passes. Removed mouthShading from controls and presets.
Target geometry, neutral closure and stretch-aware expression transport remain
as before the experiment. Continue future adjustments from this restored mouth.

### 2026-10-25 · Extend geometric shading to the rest of the face

User-directed alternative to flattening the lips: `faceSurfaceShading` /
«Рельеф кожи лица» blends smoothed, welded geometric skin normals into the rest
of the face. The accepted mouth's central region has exactly zero influence from
this pass. A broad transition outside the mouth joins it to the nose, cheeks,
orbital area and chin. Scalp, ears and rear/neck regions fade back to the authored
style. The accepted mouth normal reconstruction itself remains unchanged.

The pass (`viewer-face-normals.js`) runs after the original mouth normal pass.
It changes normals only, with support for existing normal-morph endpoints; it
creates no new normal morph rig when the donor has none. No vertex displacement,
material, light or position-morph changes. The separate control ranges from 0
(exact previous shading) to 1; the current comparison preset uses 0.8. Makeup
remains off. This is a reversible visual study, not a reference-likeness claim.

`check-face-surface-shading.cjs` verifies bit-identical base and morph positions,
unchanged normals at 5,805 protected vertices, finite unit normals, 2,070 visibly
changed skin vertices, and exact shading reset at zero.

### 2026-10-25 · Lighting diagnostic for the weak face-normal difference

The user correctly reported little visible change under the existing soft light.
The diagnostic now exposes «Боковой свет · одинаковый для обеих голов» (0–1).
Zero reproduces the previous hemisphere/ambient/key setup. One reduces uniform
fill and uses a stronger, more lateral key on both heads equally. This is only a
viewer lighting study: it changes no face asset, geometry, normal setting, skin
colour or animation. Under the contrast light the restored nose/orbital forms are
more apparent, but the mouth also receives stronger contrast. This does not by
itself prove that the mouth/face style mismatch is solved.

### 2026-10-25 · Gentle irregular skin normal relief

User-directed study: `skinIrregularity` / «Мягкая неровность кожи» adds coherent
rest-space normal relief to the skin around the accepted mouth. It does not add
colour variation or move vertices. A deterministic C2 value-noise height field
at 22 mm and 9 mm scales supplies a tangent gradient; the final low-amplitude
coefficients are 1.2 mm and 0.45 mm before the strength/mask factors. These are
virtual bump-field coefficients, not mesh displacement. The first stronger trial
was visibly too crumpled and was reduced threefold before delivery.

The existing face-surface mask excludes the mouth core, neck, ears and back/scalp;
an additional elliptical mask protects the eyelids. The pass runs after the
accepted mouth and face normal reconstruction. Existing normal-morph endpoints
are treated consistently when present; no new expression rig is created.
Current strength is 0.7; zero restores the previous normals exactly. Ordinary soft
light is restored by default (light contrast 0). Full geometric face shading is
still an independent control.

`check-skin-irregularity.cjs` checks identical base and position-morph arrays,
protected normals, finite unit output normals and exact reset. It tests settings
0 and 1, so the delivered intermediate strength remains within that range. This
study does not claim that the mouth/face contrast is aesthetically solved.

### 2026-10-25 · Expression intensity no longer waits for a manual rebuild

The previous diagnostic deliberately disabled expression intensity after every
shape/shading edit and reset its value to zero until the manual rebuild button
was pressed. This left users unable to move the slider after appearance edits.

Shape edits now schedule a debounced automatic expression update (300 ms after
the last preview). Selected expression and intensity are preserved and applied
again on completion. Controls are temporarily disabled only while that update
is pending/running; a visible error permits manual retry. Reset cancels pending
work and restores the original expression-ready geometry.

For `faceSurfaceShading` and `skinIrregularity`, FaceEditor caches normals just
before these two passes. `updateSurfaceShading` restores that baseline and reruns
only the normal passes, invalidating the GPU normal/morph cache as needed. It
keeps position morphs, current expression weights, pose and intensity untouched;
these controls do not disable expression intensity. `check-fast-surface-update.cjs`
verifies exact equality with the full apply path, unchanged geometry and position
morphs, preserved expression influences, and exact restoration.

### 2026-10-25 · Local skin transition smoothing

`mouthTransitionSmooth` filters shading normals in a rest-space ring around the
mouth, leaving the lip core protected. A welded adjacency filter runs 24 passes
and fades back to the current normals at the ring boundaries. It runs after face
shading and skin irregularity; zero restores the previous shading exactly.
The target preset uses 0.9. The control uses the fast appearance path and does
not disable expression intensity.

No vertex positions, position morphs, UVs or lip-core normals are changed.
`check-mouth-transition.cjs` verifies these invariants, finite unit normals and
exact reset; `check-fast-surface-update.cjs` verifies parity with full rebuilding
and preserved expression influences. Visual improvement is deliberately subtle:
this pass softens surrounding skin shading, but cannot remove geometric folds
inside the lips (including the inner lower-lip crease at full aa).

### 2026-10-25 · Kate full-face starting preset

`viewer-kate-preset.js` keeps the accepted mouth preset unchanged and composes it
with independently editable cheek, jaw/chin, eye, iris, brow and nose settings.
Appearance adds olive irises, copper brows, warm skin, freckles, blush and lashes.
`work/head-face/kate-character.face.json` is a portable face project.
The main editor has a “Кейт · лицо по референсу” button; the mouth diagnostic has
“Кейт · всё лицо по референсу” plus whole-face controls and the full portrait.
The diagnostic uses FaceAppearance with the same matte skin geometry lighting
used during the accepted mouth study, rather than flattening it with MToon.
Existing mouth-only presets switch the portrait material mode off.

This is a first face fit, not a completed likeness: donor eye/lash topology,
paint distribution and hairstyle still differ from the portrait. No hairstyle
is synthesized by this preset. Shape and colors remain editable and native VRM
expressions are retained. `check-kate-character.cjs` checks the unchanged accepted
mouth parameter baseline and finite geometry, position morphs and posed vertices
for neutral, blink, aa, ou, happy and blink+aa. These numeric checks do not assert
artistic likeness or collision-free expression combinations.

### 2026-10-25 · Preserve accepted mouth during full-face fitting

The initial Kate composition reused mouth parameters but then passed the mouth
through the broader face cage, changing its geometry. It also added lip paint.
Kate now enables `preserveTargetMouth`: a rest-space protected mouth region uses
the mouth-only cage, blended smoothly into the full face cage outside it. The
same rest-space binding is used for neutral and transported expression endpoints.
Lip paint is disabled in the character preset to match the accepted unpainted
study. `check-kate-mouth-preserved.cjs` compares actual geometry rather than just
preset values: 5447 protected vertices have zero position error in neutral and
selected aa/ou/happy position morphs compared with the accepted mouth preset.

### 2026-10-25 · Chin transition correction

The first mouth protection used a bounded patch whose lower fade crossed the
chin. Blending the shortened chin with the original mouth there introduced a
visible horizontal shelf. Protection now continues down the central chin, with
broad lateral and upper fades; it no longer ends across the chin surface.
This intentionally preserves more of the original central chin when mouth
preservation is enabled, rather than forcing incompatible local chin shortening.
The accepted mouth geometry and expression endpoints remain protected.

### 2026-10-25 · Kate head/body starting fit

The main editor's “Кейт · голова и тело по референсу” applies the accepted head
and a separate `viewer-kate-body-preset.js`. Body controls and native shape keys
remain editable. The reference is calibration-core/kate/standing/underwear neutral,
copied to assets/body-references/kate/standing.png; it is shown beside the viewport.
Front/side framing buttons support silhouette comparisons. The whole setup can
be retained through “Сохранить в адресе”; work/head-face/kate-character-body.url
is a reproducible editor URL and kate-character-body.json documents the preset.

The fit enlarges the head about 28%, adds softer torso/arm volume, a wider waist,
fuller bust and slightly wider hips. Absolute height is unchanged: the reference
is cropped above the lower legs, so height, calves and feet are not inferred.
This is a visual starting fit rather than a measured reconstruction. No hairstyle
or clothing is created. `check-kate-body.cjs` samples the aerobic dance at seven
times (including aa=.5 at 7.65), checks finite body/neck coordinates and validates
the head/socket boundary. Maximum boundary error is 6.02e-8 metres. The test limits
head morph rebuilding to aa/ou/happy and does not establish body self-collision.

### 2026-10-25 · Full-body reference correction

The earlier cropped-reference limitation was a search omission: full-body Kate
references exist. The user's supplied image matches rendered/kate/tpose nude
neutral exactly. It and calibration-v4/kate/standing_exposed/underwear neutral
now appear in the body reference selector alongside the previous torso crop.
The preset is revised toward wider pelvis/waist, fuller thighs/calves and slightly
larger feet/head. Absolute height stays unchanged. These are visual silhouette
estimates across differently posed illustrations, not physical measurements.
The accepted head face/mouth settings are unchanged.

### 2026-10-25 · Hip/thigh displacement transition

Larger hip/thigh controls exposed the boundary between torso soft-tissue fields
and limb skin-weight fields. Anatomy.deform now filters the deformation delta
locally across pelvis/upper thighs (20 adjacency passes with a spatial fade),
welding duplicate source vertices. It smooths displacement rather than the base
mesh, protects the groin/upper torso and is disabled when hip/thigh controls are
neutral. check-hip-transition.cjs checks finite output, exact neutral identity
relative to the previous deformation, and reduced local displacement roughness.
The Kate body/neck dance check is rerun after the correction.

### 2026-10-25 · Neck length and user-approved fullness

The user's current Voluptuous slider value (0.77) is retained in the Kate body
preset. New `neck_len` controls the calibrated neck-to-head segment, with a
0.55–1.5 length ratio range and the existing nonlinear slider response. The neck
transform scales along its actual rest axis; the head anchor follows its endpoint
without changing face geometry. Shoulders and lower torso anchors stay fixed.
Kate starts at -0.55 (about 83.6% of the original neck segment).
`check-neck-length.cjs` checks both extremes, neutral and Kate's setting: exact
neck/head joint agreement and requested length, finite mesh output and unchanged
lower body. The body/neck dance test is rerun with the updated preset.

### 2026-10-25 · Jaw-side neck tangent

Positional coincidence alone did not remove the under-chin seam: the neck bridge
arrived along a fixed head-up direction even where the jaw surface turns inward.
The upper cubic control tangent now follows actual adjacent interior head
vertices at each socket knot, interpolated around the ring. The bridge still ends
at the exact head boundary; face/lip geometry and user neck length are unchanged.
The existing normal matching remains in place. The seven-pose socket boundary
check passes after this change; that check measures gaps, not artistic smoothness.

The upper 28% of bridge shading now fades to the head's original boundary normals
instead of averaging them with bridge normals only on the final row. This avoids
changing the head edge while leaving its adjacent vertices unchanged, which had
created a narrow shading stripe. check-jaw-tangent.cjs checks boundary normal
agreement as well as position agreement and median tangent alignment.

### 2026-10-25 · Preserve anatomical detail at the neck base

The bridge smoothed all rings equally, immediately blurring circumferential
relief above the chest. Angular normal smoothing now ramps gradually over the
lower 45% of the bridge. The original lower cut and guide (z=1.335/1.345) remain:
a trial retaining more source neck at z=1.36/1.37 produced a collar-like bulge
and was reverted after visual inspection. Jaw tangents and head-boundary normal
agreement remain unchanged. This change preserves lower-ring normal detail;
it does not introduce a new sculpted muscle model.

Gradual angular smoothing alone left an obvious lower boundary. The retained
chest now uses normals evaluated on the original full deformed body (before
clipping), and those boundary normals are transported into the lower 45% of the
bridge with a smooth fade. This explicitly preserves chest shading continuity
instead of relying on normals from the bridge's replacement triangles. Geometry
and jaw-side boundary constraints are unchanged.

### 2026-10-25 · Kate hair from local VRoid guide assets

`work/hair-kate/extract.py` reads Snow Spirit's JSON paths/widths and decodes a
limited protobuf wire structure from LongWavy's .vroidcustomitem. The resulting
assets/hair/kate/guides.json contains 95 Snow Spirit paths and 74 LongWavy paths.
This is a guide reconstruction, not a complete VRoid importer: LongWavy group
transforms, original width/flow curves, textures and spring bones are not imported.
Snow paths provide scalp roots and sections; decoded LongWavy lateral deviations
contribute to reconstructed side/back waves. The editor renders rounded flattened
strand meshes with procedural longitudinal shading and a scalp cap.

“Кейт · волны из VRoid-ассетов” has separate bang, side and back length, wave,
tip-curl and lock-width controls, plus existing attachment/scale/color controls.
Settings round-trip through URL; strands regenerate only when shape controls
change. Attachment uses the current head joint and body/neck proportions.
There is no dynamic hair physics/collision in this study. Export skips hidden
hairstyles and includes visible strand meshes as ordinary head-bound geometry.
`work/hair-kate/check.cjs` tests both control extremes, finite positions/normals,
URL roundtrip, reset and attachment matrices at seven dance times.

Initial visual inspection found exposed crown skin and overly straight, thick
locks. The scalp cap was raised, lock sections flattened and broad alternating
waves strengthened. `check-export.cjs` exports the reconstructed 95 meshes to
work/hair-kate/kate-hair-study.glb and verifies position/normal attributes. This
standalone GLB is a geometry study, not a full VRM character or physics validation.
Vertex colors are preserved by the character export's material conversion.

Hair fitting correction: the active editor parameters were confirmed as accepted
Kate (mouthTarget=1, preserveTargetMouth=1, chinLength=-.85), though the donor menu
still reads Mira. `ViewerHair.fitHead` now builds the scalp cap from the active
edited VRM socket mesh, transforms it into the hair attachment frame, and fits
crown height/root width to that surface. It no longer uses the generic scalp cap
for Kate once the active head is ready. It does not replace or reset face values.
`check-head-fit.cjs` verifies active-head fitting, finite cap geometry and unchanged
face settings. This remains a first hairstyle study, with no spring physics.

VRM loading fallback correction: ViewerHead previously showed the legacy face
whenever ready=false, even when the selected head was Mira/VRM. The viewer also
changed settings.style to legacy on any head-load rejection (including a callback
error). The legacy face is now visible only when explicitly selected; load errors
remain visible without changing the selection. Hair-fit failures have their own
status and do not reject head loading. check-head-loading.cjs verifies the loading
visibility states. This removes the temporary old-head appearance during the long
full expression rebuild; it does not change the accepted Kate geometry.

### 2026-10-25 · Kate hair silhouette, second pass

Reconstruction now has staggered side/back lengths rather than a uniform lower
edge. Tip curl is a turning arc in the X/Z plane instead of only a sideways tip
offset. Side guides stay outside the jaw region; back guides stay behind the neck.
Bang tips have modest alternating heights and outward curvature; crown lift is
applied near roots rather than translating the whole bang away from the forehead.
The accepted head and its proportions remain unchanged. These are procedural
artistic constraints on imported paths, not a full VRoid preset reproduction.

Visual correction: extra root lift caused a visible crown gap on the fitted cap
and was removed. Current review URL uses wave=.6, lockWidth=.85 for a softer study.
The hairstyle remains an early silhouette study: locks still need material/flow
refinement and have not been validated for all body collisions or spring dynamics.

## 2026-10-25: Installed VRoid hair part library
- Exported 355 unmodified native hair transferable records from the user's Steam installation into assets/hair/vroid-builtin/native, indexed by their embedded source paths.
- Decoded 344 brush path previews (9,401 strands) with original group transforms and width curves; unsupported records remain disabled. Base hair textures are not decoded.
- Added `VRoid · библиотека частей` to the main hair selector: independently selectable Front, Back, Sideburns, Tied, Hanege, Ahoge and AllHair; AllHair temporarily overrides Front/Back without erasing their saved choices.
- Preview geometry is reconstructed by our renderer, not exported from VRoid. No native textures or spring physics imported. Local use provenance and licensing notes in assets/hair/vroid-builtin/SOURCE.md.
- Current trial on accepted Kate: Front-032 + Back-133. Hair selection roundtrips through the URL, including empty slots. Added an active-head scalp underlay to cover gaps in reconstructed strands.
- Validation: all 344 previews produce finite positions/normals; existing Kate guide tests and head-fit test pass.

## Kate hair silhouette trial
Added three non-destructive adapted guide variants in the builtin picker: Kate-Front-014 (raised low bang tips and sideways tip turns), Kate-Sideburns-603 (cheek curls raised 22 mm in donor coordinates and brought forward), Kate-Back-133 (additional outer S waves). Source native presets remain unchanged. The assembly and all existing character weights are stored in the URL. Script: work/hair-vroid-library/tailor-kate.py. Geometry checks pass for 347 previews including the three variants; all adapted strand roots preserved.

## 2026-10-25: Hair Studio
Replaced single part-per-category selection with independent layers. Catalog filters, guide thumbnails, search, multiple instances per category, show/hide, duplicate/delete/reset, per-layer length/volume/width/waves/curl, XYZ placement, rotation/tilt, color, opacity and textures. Added hairstyle JSON save/load and URL layer persistence (backwards-compatible old hair_part_* links). Imported GLB session support and layer metadata in VRM exports.
Catalog: 376 entries, 365 usable (359 guide assets + 6 mesh assets, including the local Tripo wig), 109 local textures. 11 unsupported native records remain disabled. Local archives have source-specific terms; this is a local study library.
Verification: all decoded strands finite at control extremes, independent duplicate editing, JSON restore and validation, URL roundtrip, GLB parse/import. Legacy Kate guide, head-fit and export checks retained.

## Hair fitting reference correction
Use rendered/kate/standing__costume__none__neutral.png as the full hairstyle silhouette reference, sitting__costume__none__neutral.png for side layers. Portrait remains a secondary close-up reference. Added these clothed references inside Hair Studio.
New, non-destructive KateRef-* donor variants plus an original KateRender-Outer-Curls guide layer. Wider lower/back mass and staggered outward hooks replace portrait-driven emphasis on nose-level cheek curls. Trial JSON: assets/hair/vroid-builtin/kate-reference-hairstyle.json.
Added per-layer tip taper, with smooth seam normals and 12-sided ribbon sections, to avoid blunt cut ends. Original accepted Kate layers remain available.
