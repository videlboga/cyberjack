# CyberJack UE5 Integration Plan

## Общая архитектура

Движок CyberJack работает как **внешний сервер** (Node.js), с которым UE5 общается через HTTP REST и WebSocket. **Ничего переписывать не нужно** — движок уже имеет все необходимые API.

```
┌─────────────────────────────────────────────────────────────┐
│                    UE5 (Unreal Engine 5.7)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WebUI Overlay (CEF / UMG)                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │MetaHuman │  │Radial    │  │Speech Bubbles    │   │   │
│  │  │3D View + │  │Menu (на │  │(над MH)          │   │   │
│  │  │Raycasting│  │клик)     │  │+ логи            │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  │         ↕ HTTP (REST)       ↕ WebSocket              │   │
│  └──────────────────────────────────────────────────────┘   │
│         ↕                           ↕                       │
└─────────────────────────────────────────────────────────────┘
         ↕                           ↕
┌─────────────────────────────────────────────────────────────┐
│            Engine Server (Node.js, :3000, SQLite)             │
│  POST /api/tick     POST /api/wait                           │
│  GET  /api/state    POST /api/subject/update                 │
│  GET  /api/scenes   POST /api/scene/move                     │
│  GET  /api/contexts POST /api/contexts/toggle                │
│  WS: broadcastEvent (анимации, речь)                         │
└─────────────────────────────────────────────────────────────┘
```

## Поток взаимодействия (игровой тик)

```
[Hover MH bone] → GET /api/state?subjectId=S-01&pointId=chest
                   ← { localAttitude, localSensitivity, availableActions[] }

[Click → Radial Menu] → пользователь выбирает действие

[Submit action] → POST /api/tick { subjectId, pointId, presetId, textMessage }
                   ← { tickResult, reply: { speech }, state, diagnostics, actionApplied }

[WebSocket] → broadcastEvent("ANIMATION", { clip: "flinch_hard", ... })
              broadcastEvent("SPEECH", { actorId: "S-01", text: "«А-ах...»" })
```

---

## 1. Анатомические якоря (Colliders на костях MetaHuman)

### 1.1. DataTable для конфигурации

В UE5 создаётся **DataTable** (`DT_CyberJackAnchors`) со следующей структурой:

```
RowName (FName) | PartId (FString) | BoneName (FName) | ColliderType (FString) | Offset (FVector) | Radius (float) | ParentPartId (FString) | Label (FString) | SensDefault (float) | AttDefault (float)
```

### 1.2. Полный маппинг (30+ точек)

Источник: `VrmAnatomyView.tsx` (VRM bone mapping) + `anatomy.ts` (анатомические определения) + `docs/Unreal_MetaHuman_Mapping.md`

#### Виртуальные слоты (системные, не привязаны к костям)

| PartId | Label | Bone (MH) | Offset | Collider | Примечание |
|--------|-------|-----------|--------|----------|------------|
| `posture` | Поза (положение тела) | — | — | — | Системный слот, не рендерить |
| `mind_state` | Психика/Разум | `head` | (0, 30, 0) | Sphere R=5 | Парящий над головой |
| `systemic` | Организм (системное) | — | — | — | Системный слот |
| `slot_room` | Окружение (комната) | — | — | — | Системный слот |
| `slot_social` | Социальное | — | — | — | Системный слот |

#### Голова и лицо (скелет: Face_Archetype_Skeleton)

| PartId | Label | Bone (MH) | Offset | Radius | Примечание |
|--------|-------|-----------|--------|--------|------------|
| `head` | Голова/Волосы | `head` | (0, 0, 0) | 10 | Top of head |
| `face` | Лицо | `head` | (0, 0, 10) | 8 | Спереди лица |
| `lips` | Губы | `jaw` или `mouth_lower_lip_mid_m` | (0, 0, 2) | 3 | |
| `neck` | Шея | `neck_01` | (0, 0, 0) | 5 | |

#### Торс (скелет: metahuman_base_skel)

| PartId | Label | Bone (MH) | Offset | Radius | Примечание |
|--------|-------|-----------|--------|--------|------------|
| `shoulders` | Плечи | `clavicle_l` / `clavicle_r` | (0, 0, 0) | 6 | Два коллайдера |
| `chest` | Грудь | `spine_05` | (0, 0, 0) | 10 | |
| `nipples` | Соски | `spine_04` | (0, 8, 6) и (0, -8, 6) | 3 | Два коллайдера L/R |
| `belly` | Живот | `pelvis` | (0, 0, 0) | 8 | |
| `waist` | Талия | `spine_02` | (0, 0, 0) | 7 | |
| `back` | Спина | `spine_02` | (0, 0, -8) | 8 | Offset back |
| `buttocks` | Ягодицы | `pelvis` | (0, 0, -8) | 8 | Offset back-down |

#### Конечности

| PartId | Label | Bone (MH) | Offset | Radius | Примечание |
|--------|-------|-----------|--------|--------|------------|
| `arms` | Руки | `upperarm_l` / `upperarm_r` | (0, 0, 0) | 4 | |
| `left_arm` | Левая рука | `upperarm_l` | (0, 0, 0) | 4 | |
| `right_arm` | Правая рука | `upperarm_r` | (0, 0, 0) | 4 | |
| `hands` | Кисти | `hand_l` / `hand_r` | (0, 0, 0) | 4 | |
| `left_hand` | Левая кисть | `hand_l` | (0, 0, 0) | 4 | |
| `right_hand` | Правая кисть | `hand_r` | (0, 0, 0) | 4 | |
| `legs` | Ноги | `thigh_l` / `thigh_r` | (0, 0, 0) | 5 | |
| `left_leg` | Левая нога | `thigh_l` | (0, 0, 0) | 5 | |
| `right_leg` | Правая нога | `thigh_r` | (0, 0, 0) | 5 | |
| `knees` | Колени | `calf_l` / `calf_r` | (0, 0, 0) | 5 | |
| `feet` | Ступни | `foot_l` / `foot_r` | (0, 0, 0) | 4 | |
| `inner_thighs` | Вн. сторона бедер | `thigh_l` / `thigh_r` | (3, -6, 3) | 4 | Offset внутрь |

#### Интимные зоны

| PartId | Label | Bone (MH) | Offset | Radius | Примечание |
|--------|-------|-----------|--------|--------|------------|
| `groin` | Пах | `pelvis` | (0, 4, 6) | 5 | Offset down-forward |
| `penis` | Член | `pelvis` | (0, 6, 8) | 3 | Male |
| `testicles` | Яички | `pelvis` | (0, 10, 6) | 3 | Male, ниже |
| `vulva` | Вульва | `pelvis` | (3, 6, 7) | 3 | Female |
| `vagina` | Влагалище | `pelvis` | (0, 8, 5) | 3 | Female |
| `clitoris` | Клитор | `pelvis` | (-3, 5, 7) | 2 | Female |
| `anus` | Анус | `pelvis` | (0, 4, -6) | 3 | Offset back-down |
| `prostate` | Простата | `pelvis` | (0, 4, 3) | 2 | Male, глубже |

> **Система координат:** Z+ вперёд (из экрана), Y+ вверх, X+ вправо (вид персонажа).
> Offsets задаются в сантиметрах, в локальном пространстве кости.

### 1.3. Скрипт навешивания коллайдеров

**BP_CyberJackColliderSpawner** (или C++ `ACyberJackColliderManager`):

```
On MetaHuman Loaded:
  For each row in DT_CyberJackAnchors:
    If BoneName != "" :
      Bone = SkeletalMeshComponent.GetBone(BoneName)
      Collider = SpawnActor(SphereCollider)
      Collider.AttachToComponent(Bone)
      Collider.SetRelativeLocation(Offset)
      Collider.SetSphereRadius(Radius)
      Collider.ComponentTags = ["CyberPart:" + PartId]
      Collider.SetCollisionChannel(ECC_GameTraceChannel1 / "UIInteractable")
  
  For paired bones (L/R), spawn second collider mirrored on X axis
```

### 1.4. Рейкастинг (PlayerController)

```cpp
// PlayerController::Tick
FHitResult Hit;
GetWorld()->LineTraceSingleByChannel(
    Hit, CameraLocation, CameraLocation + Direction * 5000,
    ECC_GameTraceChannel1  // UIInteractable
);

if (Hit.Component.IsValid() && Hit.Component->ComponentHasTag(FName("CyberPart:")))
{
    FString PartId = /* extract from tag */;
    // GET /api/state?subjectId=S-01&pointId=PartId
    // Show hover info on overlay
}
```

---

## 2. API Reference для UE5 клиента

Базовый URL: `http://localhost:3000/api`

### 2.1. GET /api/state — Состояние субъекта

**Параметры:** `subjectId` (default: S-01), `pointId` (default: hands), `sceneId` (опционально)

**Ответ (основные поля):**
```json
{
  "success": true,
  "subject": {
    "id": "S-01",
    "name": "Актив",
    "sensitivity": 62.5,
    "capacity": 48.2,
    "openness": 55.0,
    "plasticity": 40.3,
    "attitude": 73.1,
    "tension": 24.7,
    "anatomy": {
      "chest": { "localSensitivity": 75, "localAttitude": 30, "familiarity": 0.5 },
      "nipples": { "localSensitivity": 95, "localAttitude": 10, "familiarity": 0.3 },
      ...
    },
    "contexts": [
      { "id": "...", "actionId": "pose_standing", "label": "Стоя", "type": "pose", "ticksActive": 5 }
    ]
  },
  "availableActions": [
    { "id": "soft_caress", "label": "Мягкое поглаживание", "costs": { "ap": 1 }, "occupiesPoints": ["hands"] }
  ],
  "scene": { "id": "scene_lab_calibrator", "characters": [...] },
  "player": { "resources": { "ap": { "amount": 10, "maxAmount": 10 } } },
  "relations": [...]
}
```

### 2.2. POST /api/tick — Выполнить действие

**Body:**
```json
{
  "subjectId": "S-AV-01",
  "pointId": "nipples",
  "playerId": "PL-1",
  "sceneId": "scene_lab_calibrator",
  "presetId": "soft_caress",
  "textMessage": null,
  "playerIntensity": 0.8,
  "skipLLM": false
}
```

**Ответ (ключевые поля):**
```json
{
  "success": true,
  "tickResult": {
    "pleasure": 72.3,
    "discomfort": 12.1,
    "overload": 8.4,
    "engagement": 65.2,
    "learningEffect": 3.1,
    "finalValence": 0.45,
    "experiencedIntensity": 58.7
  },
  "reply": { "speech": "«А-ах... ещё... пожалуйста...»" },
  "diagnostics": { "reactionSummary": "Субъект вздрагивает, дыхание учащается" },
  "state": { "core": { ... }, "point": { ... } },
  "actionApplied": true
}
```

### 2.3. POST /api/wait — Пропуск времени

**Body:** `{ "subjectId": "S-AV-01", "ticks": 5, "deltaTime": 20.0 }`

Пропускает N тиков с ускоренным временем. Для режима ожидания / быстрой прокрутки.

### 2.4. POST /api/subject/update — Прямая правка состояния

Для debug-панели / администратора. Позволяет вручную менять core параметры субъекта.

### 2.5. GET /api/scenes — Список сцен
### 2.6. POST /api/scene/move — Перемещение персонажа между слотами
### 2.7. GET /api/contexts — Список активных контекстов
### 2.8. POST /api/contexts/toggle — Включить/выключить контекст

---

## 3. WebSocket протокол

**Подключение:** `ws://localhost:3000`

**Сообщения от сервера:**

```json
{ "type": "ANIMATION", "payload": { "clip": "flinch_hard", "subjectId": "S-01", "intensity": 0.7 } }
{ "type": "SPEECH", "payload": { "actorId": "S-01", "text": "«А-ах...»" } }
{ "type": "MOVE", "payload": { "target": "S-01", "slotId": "sector_b_table" } }
{ "type": "CONTEXT_CHANGE", "payload": { "subjectId": "S-01", "context": "pose_kneeling", "active": true } }
```

**Сообщения от клиента (UE5 → Engine):**

```json
{ "type": "CLICK", "payload": { "subjectId": "S-01", "pointId": "chest", "screenX": 0.5, "screenY": 0.3 } }
```

---

## 4. Пошаговый план реализации

### Фаза 0: Подготовка движка (сейчас на Manjaro)

- [x] **Сделано:** REST API работает, WS работает, SQLite persistence
- [ ] **Надо:** Добавить `/api/point-info` для хит-тестов (лёгкий эндпоинт без полного стейта)
- [ ] **Надо:** Разделить WS на каналы (по subjectId)
- [ ] **Надо:** systemd unit для движка (автозапуск)

### Фаза 1: Colliders на MetaHuman

- [ ] Импортировать `DT_CyberJackAnchors` DataTable
- [ ] Написать `BP_CyberJackColliderSpawner`
- [ ] Проверить рейкастинг на все 30+ точек
- [ ] Протестировать Hover Info на оверлее

### Фаза 2: API-клиент в UE5

- [ ] HTTP-клиент (C++/BP): обёртка над `/api/state`, `/api/tick`, `/api/wait`
- [ ] WS-клиент: приём `ANIMATION`, `SPEECH`, `MOVE`, `CONTEXT_CHANGE`
- [ ] Обработка ошибок (reconnect, таймауты)

### Фаза 3: WebUI Overlay

- [ ] **Вариант A:** CEF — React-оверлей из существующей кодовой базы (`src/ui/`)
- [ ] **Вариант B:** UMG-виджеты — переписать DiegeticUI на UE-натив
- [ ] Привязать к рейкасту: hover → info, click → radial menu, action → POST /api/tick

### Фаза 4: Анимации (MetaHuman)

- [ ] Определить список animation-клипов в движке (в `eventTemplates.ts` или конфиге)
- [ ] Маппинг: `result.overload > 50` → `broadcastEvent("ANIMATION", { clip: "overload_heavy" })`
- [ ] В UE5: проигрывать анимации через LiveLink / Animation Blueprint

### Фаза 5: Запуск

- [ ] systemd unit на Manjaro для Engine Server
- [ ] UE5 авто-подключение к engine при старте сцены
- [ ] Тест: полный цикл hover → click → action → animation → speech

---

## 5. Известные проблемы движка (чинить до/вовремя порта)

### 🔴 Критично

1. **`DEFAULT_CONFIG` типизирован как `any`** — `engine/config.ts`: `any` вместо `EngineConfig`. Ошибки в формулах уйдут в runtime.
2. **`noveltyService.ts` — заглушка** — новизна всегда 0.5, learningEffect не работает.
3. **`runGameTick.ts` монолит (552 строки)** — commandHandler, contextManager, discharge, resourceRegen — всё в одной функции. При порте нужно разбить.

### 🟡 Важно

4. **5× дублирование baseline-демпфирования** в `applyLearning.ts` — 100+ строк кода, сворачивается в цикл.
5. **Массив `['intensity', 'valence', 'contact', 'sharpness', 'novelty']` определён 3 раза** — в `compileAction.ts`, `mergeVectors.ts`, `compileContextVector.ts`.
6. **WS без каналов** — один broadcast на всех клиентов. Необходимо для UE5+React одновременно.
7. **`any` в типах** — `compileAction.ts`, `applyLearning.ts`, `runGameTick.ts` проскальзывают.

### 💡 Улучшения

8. **Добавить `/api/point-info`** — лёгкий эндпоинт для UE5 hit-test.
9. **DeltaTime не параметризован** — wait=20.0, normal=1.0 — магические числа.
10. **JSONL-логи не ротируются** — съедят диск на проде.
11. **`/api/state` возвращает слишком много** — для оверлея нужна лёгкая версия.

---

## 6. Структура UE5 проекта

```
Документы/Unreal Projects/cyberjack/
├── cyberjack.uproject              ← UE 5.7
├── Config/                         ← DefaultGame.ini, Engine.ini
│   └── DT_CyberJackAnchors.csv     ← Таблица якорей (CSV импорт в DataTable)
├── Content/
│   ├── Characters/                 ← MH-персонажи
│   ├── CyberJack/                  ← Плагин/модуль интеграции
│   │   ├── Blueprints/
│   │   │   ├── BP_CyberJackColliderSpawner.uasset
│   │   │   ├── BP_CyberJackHUD.uasset
│   │   │   └── BP_CyberJackPlayerController.uasset
│   │   ├── Data/
│   │   │   └── DT_CyberJackAnchors.uasset (импортирован из CSV)
│   │   └── WebUI/
│   │       └── overlay.html         ← React-оверлей (CEF) или UMG
│   ├── FirstPerson/                ← FP-шаблон (временная база)
│   └── LevelPrototyping/           ← Тестовые уровни
├── Source/                         ← C++ код (опционально)
└── Plugins/                        ← MetaHuman, GameplayStateTree
```

### Материалы для скачивания/подготовки

| Ресурс | Где взять |
|--------|-----------|
| UE 5.7 | `~/UnrealEngine/Linux_Unreal_Engine_5.7.4.zip` (уже установлен) |
| MetaHuman | Плагины подключены в `.uproject` (MetaHumanCharacter, Runtime, Calibration, LiveLink) |
| Анатомия (DataTable CSV) | `docs/CyberJack-UE5-integration-plan.md` — таблица выше |
| API-спека | Раздел 2 этого документа |
| Маппинг UE5 | `docs/Unreal_MetaHuman_Mapping.md` |

---

*Документ создан: 2026-06-01*
*Основание: архитектура v2 (`docs/Architecture_v2.md`), код движка (cyberjack-v0.01/src/), VRM-маппинг (VrmAnatomyView.tsx), API-сервер (api/server.ts)*