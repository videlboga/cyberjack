# UE5 C++ Module — CyberJack Phase 1

**Branch:** `ue5/cj-003-colliders`
**Issue:** VID-47 (Paperclip)

## Что добавлено

| File | Lines | Назначение |
|---|---|---|
| `CyberJack.uproject` | 30 | UE5 project с плагинами MetaHumanCharacter / MetaHumanSDK |
| `Config/DefaultEngine.ini` | 10 | Collision channel `UIInteractable` (ECC_GameTraceChannel1) |
| `Config/DefaultGame.ini` | 6 | Project metadata |
| `Source/CyberJack/CyberJack.Build.cs` | 35 | UBT module rules + AutomationController (Editor only) |
| `Public/CyberJackAnchorRow.h` | 78 | FTableRowBase struct для DT_CyberJackAnchors |
| `Public/CyberJackPartInterface.h` | 28 | BlueprintNativeEvent интерфейс для partId |
| `Public/CyberJackAnchorComponent.h` | 53 | USphereComponent + PartId + tag `CyberPart:` |
| `Private/CyberJackAnchorComponent.cpp` | 45 | Реализация + ExtractPartIdFromTags static helper |
| `Public/CyberJackColliderManager.h` | 90 | Спавнер коллайдеров (читает DataTable) |
| `Private/CyberJackColliderManager.cpp` | 165 | Спавн + зеркалирование + парсинг |
| `Public/CyberJackPlayerController.h` | 95 | Рейкаст + hover/click events |
| `Private/CyberJackPlayerController.cpp` | 130 | LineTraceSingleByChannel по ECC_GameTraceChannel1 |
| `Private/Tests/CyberJackAutomationTest.cpp` | 320 | 6 FAutomationTestBase тестов |
| `README.md` | 130 | Документация модуля |

## Соответствие требованиям VID-47

✅ `BP_CyberJackColliderSpawner` или C++ `ACyberJackColliderManager` — **UCyberJackColliderManager** (UCLASS, UActorComponent, монтируется на любой Actor с SkeletalMesh)
✅ Читает `DT_CyberJackAnchors` (FCyberJackAnchorRow : FTableRowBase)
✅ Спавнит SphereComponent на каждой кости MetaHuman с тегом `CyberPart:{partId}`
✅ Для парных коллайдеров — зеркалирование по X + суффиксы `_left` / `_right`
✅ PlayerController: `LineTraceSingleByChannel` по `ECC_GameTraceChannel1` (UIInteractable)
✅ Парсинг тегов: `ExtractPartIdFromTags` статический хелпер
✅ Automation Test (FAutomationTestBase) — 6 тестов покрывают:
  - все коллайдеры созданы и привязаны к правильным сокетам
  - LineTraceByChannel возвращает hit по каждому коллайдеру (sweep в тесте)
  - partId матчится с ядром (ExpectedCorePartIds список)

## Что НЕ сделано (по требованию)

❌ Компиляция — Windows отключён, написано в задаче "Без компиляции — чистый код в PR"
❌ GUI-проверка — человек проверит в PIE

## Тестирование (после компиляции на Windows)

```cmd
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" CyberJack.uproject -ExecCmds="Automation RunTests CyberJack.Phase1; Quit" -unattended -nopause -testexit="Automation Test Queue Empty" -log
```

После прогона — приложить скриншот/лог в комментарий VID-47.
