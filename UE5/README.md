# CyberJack — UE5 Module (Phase 1)

C++ модуль для UE5 проекта CyberJack. Реализует Фазу 1: коллайдеры на костях MetaHuman + рейкастинг через `UIInteractable` collision channel.

## Структура

```
UE5/
├── CyberJack.uproject             # UE5 project file
├── Config/
│   ├── DefaultEngine.ini          # UIInteractable collision channel (ECC_GameTraceChannel1)
│   └── DefaultGame.ini            # Project metadata
└── Source/CyberJack/
    ├── CyberJack.Build.cs         # UBT module rules
    ├── Public/
    │   ├── CyberJackAnchorRow.h          # FCyberJackAnchorRow — FTableRowBase struct для DT_CyberJackAnchors
    │   ├── CyberJackPartInterface.h      # ICyberJackPartInterface (BlueprintNativeEvent)
    │   ├── CyberJackAnchorComponent.h    # UCyberJackAnchorComponent — USphereComponent + PartId + tag
    │   ├── CyberJackColliderManager.h    # UCyberJackColliderManager — спавнер
    │   └── CyberJackPlayerController.h   # ACyberJackPlayerController — рейкаст + hover/click
    └── Private/
        ├── CyberJackAnchorComponent.cpp
        ├── CyberJackColliderManager.cpp
        ├── CyberJackPlayerController.cpp
        └── Tests/
            └── CyberJackAutomationTest.cpp   # FAutomationTestBase тесты
```

## Архитектура

```
                    [DT_CyberJackAnchors]   ← DataTable (30+ строк)
                              │
                              ▼
       [UCyberJackColliderManager]   ← читает DataTable, спавнит коллайдеры
                              │
                              ▼
        [UCyberJackAnchorComponent]   ← USphereComponent на кости, тег "CyberPart:{partId}"
                              ▲
                              │ рейкаст по ECC_GameTraceChannel1 (UIInteractable)
                              │
   [ACyberJackPlayerController]   ← FHitResult → парсит тег → broadcast OnPartHover/OnPartClicked
                              │
                              ▼
              [GET /api/state?subjectId=...&pointId={partId}]   ← ядро CyberJack (Node.js, :3000)
```

## Ключевые решения

1. **Collision channel `UIInteractable`** — кастомный `ECC_GameTraceChannel1`, объявлен в `Config/DefaultEngine.ini`. Это позволяет отделить интерактивные коллайдеры от игровых коллизий.
2. **Тег + переменная** — каждый `UCyberJackAnchorComponent` хранит `PartId` (FString) и дублирует в `ComponentTags` как `CyberPart:{partId}`. Тег — для рейкаста (когда Hit не cast'ится в наш тип), переменная — для type-safe Blueprint.
3. **Зеркалирование по X** — для парных строк (`BodySide = Both`) автоматически спавнится второй коллайдер с `MirrorOffsetX(Offset)` и суффиксом `_left`/`_right`. Пример: `shoulders` → `shoulders_left` + `shoulders_right` с зеркальным X.
4. **Системные слоты** — строки с `bIsSystemSlot = true` (posture, systemic, slot_room, slot_social) не спавнят коллайдер. Исключение: mind_state имеет bone (head) — спавнится, но в ядре это абстрактный слот.
5. **TDD-тесты** — `Private/Tests/CyberJackAutomationTest.cpp` содержит 6 автотестов:
   - `SpawnColliders_CreatesComponentsAndAttachesToBones` — корректность спавна
   - `ExtractPartIdFromTags` — парсинг тега
   - `SetCyberJackPartId` — обновление переменной и тегов
   - `MakePairedPartId` — формирование _left/_right
   - `MirrorOffsetX` — зеркалирование offset
   - `LineTraceByChannel_HitEachCollider` — sweep по каждому коллайдеру

## Использование (Blueprint)

1. На актор с MetaHuman положить `USkeletalMeshComponent` (в Blueprint — `SkeletalMesh`).
2. Добавить компонент `CyberJackColliderManager` (`Add Component → Cyber Jack → Collider Manager`).
3. Создать `DataTable` на основе `CyberJackAnchorRow` (row struct), назвать `DT_CyberJackAnchors`. Заполнить строками из `docs/CyberJack-UE5-integration-plan.md` (раздел 1.2).
4. В `CyberJackColliderManager`:
   - `AnchorTable` = `DT_CyberJackAnchors`
   - `TargetSkeletalMesh` = ваш SkeletalMeshComponent
   - `bSpawnOnBeginPlay` = true
5. В `GameMode` указать `PlayerControllerClass = CyberJackPlayerController`.
6. В Input Mapping Context добавить action "Interact" (Left Mouse Button).

## Использование (C++)

```cpp
#include "CyberJackColliderManager.h"
#include "CyberJackPlayerController.h"

void ACyberJackCharacter::BeginPlay()
{
    Super::BeginPlay();

    UCyberJackColliderManager* Manager = FindComponentByClass<UCyberJackColliderManager>();
    if (Manager && Manager->AnchorTable)
    {
        Manager->SpawnColliders();
    }
}
```

## Компиляция (Windows, UE 5.7)

```cmd
"C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" CyberJackEditor Win64 Development -Project="D:\Projects\cyberjack-ue5\CyberJack.uproject" -WaitMutex -FromMsBuild
```

## Запуск тестов (Editor, после компиляции)

```cmd
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" CyberJack.uproject -ExecCmds="Automation RunTests CyberJack.Phase1; Quit" -unattended -nopause -testexit="Automation Test Queue Empty" -log
```

## Зависимости

- UE 5.7
- MetaHuman SDK (плагин `MetaHumanCharacter`, `MetaHumanSDK`)
- Модули: `Core`, `CoreUObject`, `Engine`, `InputCore`, `EnhancedInput`
- Editor-only: `AutomationController`, `UnrealEd`, `Slate`, `SlateCore`

## Связь с ядром CyberJack (Node.js, :3000)

`partId` в UE5 ↔ `pointId` в REST API ↔ `anatomy.ts` в ядре. Список ожидаемых partId для регрессии — в `CyberJackAutomationTest.cpp::ExpectedCorePartIds`.

## Phase Plan

- [x] Phase 0 (CJ-002): UE5 project + DataTable + C++ structs (in progress)
- [x] **Phase 1 (CJ-003, этот PR): Colliders + raycasting + Automation tests**
- [ ] Phase 2 (CJ-004): HTTP client to CyberJack API
- [ ] Phase 3 (CJ-005): UMG widgets (UI overlay)
- [ ] Phase 4 (CJ-006): WebSocket client
- [ ] Phase 5 (CJ-007): MetaHuman animations
- [ ] Phase 6 (CJ-008): Integration + first launch
