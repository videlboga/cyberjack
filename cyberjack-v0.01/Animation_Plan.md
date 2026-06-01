# План внедрения параметров анимации (Cyberjack)

## Текущая архитектура пайплайна (Backend -> AnimationIntent -> Unity)

Backend не должен пересылать сырую бухгалтерию параметров (десятки формул и трейтов). Вместо этого Ядро формирует сжатый **AnimationIntent** и передаёт его через WebSocket. Unity принимает этот Intent и распределяет его между Animator (базовые позы) и Процедурными контроллерами (Decay/Recovery System).

### Формат AnimationIntent (WebSocket Payload)

```json
{
  "type": "sync_animator",
  "payload": {
    "poseId": "standing",
    "idle": {
      "openness": 0.72,
      "tension": 0.44
    },
    "reaction": {
      "targetPoint": "chest",
      "valence": -0.8,
      "intensity": 0.76,
      "direction": "away",
      "duration": 0.9
    },
    "attention": {
      "target": "actor_face",
      "eyeContact": 0.2
    }
  }
}
```

---

## 1. Архитектура Unity Animator (База)

Мы начинаем с минимального жизнеспособного прототипа (Milestone 1). Отказываемся от создания десятков анимаций для первой итерации.

### Слой 1: Stance Layer
- Пока берется только одна поза: **Standing**.
- Переходы к другим позам (Sitting, Suspended) закладываются архитектурно, но без имплементации самих State на 1 этапе.

### Слой 2: Core Blend Layer (Динамический Idle)
Внутри позы `Standing` находится **2D Blend Tree**, управляемое параметрами из `intent.idle`:
- **Ось X (Openness):** `0.0` (Закрытая) ↔ `1.0` (Открытая).
- **Ось Y (Tension):** `0.0` (Расслабленная) ↔ `1.0` (Взвинченная).
- *Milestone 1:* Достаточно 4 коротких зацикленных айдлов или даже простых статичных поз (stand-ins), чтобы доказать, что оси корректно деформируют силуэт.

### Слой 3: Reaction Layer (Additive)
Вес additive-анимации завязывается не жестко на `1.0`, а динамически вычисляется:
```csharp
impactWeight = clamp(reaction.intensity, 0, 1)
```
- Слой гасится через curve/Lerp за время `reaction.duration` (0.5 – 1.5 секунды), чтобы персонаж не дёргался при спаме тиков.

---

## 2. Процедурная генерация (Overlays & Decay System)

Не должно быть ситуации, когда тик ядра напрямую "дергает" кости. Используется система постепенного смещения и затухания.

### Взгляд и слежение (Gaze Budget)
Управляется объектом `intent.attention`. LookAt-система работает не бинарно (смотрит/отвернулся), а распределяет "бюджет взгляда" (eyeContact):
- Высокий `eyeContact` -> уверенно и долго смотрит на цель (`target`).
- Низкий `eyeContact` -> срывается со зрительного контакта, смотрит короткими бросками, уводит глаза от цели.

### Смещение позы от Импакта (ReactionPoseController)
Специальный контроллер, который принимает `intent.reaction`. Вместо прямого скручивания Spine, он генерирует **временные оффсеты (transforms)**:
- Torso lean.
- Head turn.
- Shoulder tension.
- Pelvis shift.
Они накатываются поверх текущего Idle и плавно затухают (decay system), учитывая `direction` (away/towards).

### Лицевая мимика (Face Blendshapes)
Вместо трансляции pleasure/discomfort, на лице отыгрывается единый сжатый `valence` и интенсивность реакции, выданные в `intent.reaction`.

---

## Milestone 1 (Тестовая сборка)

Для проверки работоспособности пайплайна реализуем следующий минимальный объем:

1. **Standing idle** (одно состояние).
2. **2D Blend Tree** (4 тестовые позы на оси `openness/tension`).
3. **LookAt Target** подсистема (на одну цель - лицо актора с учетом `eyeContact`).
4. **Procedural impact** (один на грудь или руку, с затуханием).
5. **Face blendshape** (один шэйп - улыбка/прищур/оскал, реагирующий на `valence`).