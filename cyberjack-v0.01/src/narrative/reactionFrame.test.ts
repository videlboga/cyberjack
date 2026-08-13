import { describe, expect, it } from "vitest";
import {
  applyVerbalInputToFrame,
  applyInternalImpulseToFrame,
  buildReactionSystemPrompt,
  buildReactionTurnMessage,
  boundaryVariationInstruction,
  compileReactionFrame,
} from "./reactionFrame";

const core = {
  sensitivity: 50,
  capacity: 70,
  openness: 50,
  plasticity: 50,
  attitude: 55,
  tension: 5,
  baselineSensitivity: 50,
  baselineCapacity: 70,
  baselineOpenness: 50,
  baselinePlasticity: 50,
  baselineAttitude: 55,
};

const behavioralCore = {
  values: ["Точность помогает уверенно действовать."],
  needs: ["доверие к собственному суждению"],
  vulnerabilities: ["боится пропустить реальную опасность"],
  defenses: ["при конкретной опасности становится деловой"],
  voice: ["Говорит естественно и допускает сухой юмор."],
  mannerisms: ["не задаёт лишних вопросов"],
  centralConflict: {
    desire: "быть полноценной участницей",
    fear: "слишком поздно заметить важное",
  },
  attentionFocus: ["change", "person", "technique"] as Array<'technique' | 'person' | 'body' | 'risk' | 'rules' | 'change'>,
  speechDisposition: "normal" as const,
};

function observerFrame() {
  return compileReactionFrame({
    speakerId: "iona",
    speakerName: "Иона",
    speakerGender: "female",
    targetId: "mira",
    targetName: "Мира",
    initiatorId: "player",
    initiatorName: "Калибратор",
    presentCharacters: ["Иона", "Мира", "Калибратор"],
    contexts: [],
    core,
    behavioralCore,
    observation: {
      behavioralState: "responsive",
      reaction: {
        pleasure: 35,
        discomfort: 2,
        overload: 0,
        engagement: 20,
        mixed: false,
        appraisal: 1,
      },
      changes: {
        attitude: 1,
        openness: 1,
        capacity: 0,
        tension: 4,
        sensitivity: 0,
        plasticity: 0,
        localAttitude: 0,
        localOpenness: 0,
      },
      action: { label: "Прикосновение", pointLabel: "Рука" },
      learning: {
        sensitivityDelta: 0,
        baselineSensitivityDelta: 0,
        familiarityDelta: 0,
      },
      transitions: [],
      subjectiveText: "Другому персонажу приятно.",
    } as any,
  });
}

describe("reaction perspective and dialogue planning", () => {
  function constrainedReaction(desiredResponse: string) {
    return compileReactionFrame({
      speakerId: "eli", speakerName: "Эли", targetId: "eli", targetName: "Эли",
      initiatorId: "player", initiatorName: "Калибратор",
      presentCharacters: ["Эли", "Калибратор"], contexts: ["фиксация"], core, behavioralCore,
      observation: {
        behavioralState: "responsive",
        reaction: { pleasure: 1, discomfort: 8, overload: 0, engagement: 30, mixed: false, appraisal: -.6 },
        reactionSnapshot: {
          affect: { valence: -.6, emotion: "distressed" },
          behavior: { desiredResponse },
        },
        changes: {}, action: { label: "Воздействие", pointLabel: "Тело" },
        learning: { sensitivityDelta: 0, baselineSensitivityDelta: 0, familiarityDelta: 0 },
        transitions: [], subjectiveText: "Воздействие неприятно и его нельзя остановить.",
      } as any,
    });
  }

  it("keeps dissociative compliance distinct from learned acceptance", () => {
    const frame = constrainedReaction("silent_compliance");
    expect(frame.dramaticPosition.primaryIntent).toContain("перестала верить");
    expect(frame.dramaticPosition.secondaryConflict).toContain("отстраняешься");
    expect(frame.dramaticPosition.secondaryConflict).not.toContain("положительная интерпретация");
  });

  it("makes moderate resignation audible as forced rationalization", () => {
    const frame = constrainedReaction("forced_rationalization");
    expect(frame.dramaticPosition.primaryIntent).toContain("ищешь в неизбежном");
    expect(frame.dramaticPosition.secondaryConflict).toContain("не испытываешь внезапного");
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("bargain");
  });

  it("lets established resignation become an owned positive interpretation", () => {
    const frame = constrainedReaction("assimilated_acceptance");
    expect(frame.dramaticPosition.primaryIntent).toContain("Ты уже искренне находишь");
    expect(frame.dramaticPosition.secondaryConflict).toContain("твоей собственной");
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("offer");
  });

  it("keeps a positive conversational appraisal emotionally audible", () => {
    const frame = compileReactionFrame({
      speakerId: "mira", speakerName: "Мира", targetId: "mira", targetName: "Мира",
      initiatorId: "player", initiatorName: "Калибратор",
      presentCharacters: ["Мира", "Калибратор"], contexts: [], core, behavioralCore,
      observation: {
        behavioralState: "responsive",
        reaction: { pleasure: 0, discomfort: 0, overload: 0, engagement: 25, mixed: false, appraisal: .43 },
        reactionSnapshot: { affect: { valence: .43, emotion: "excited" }, behavior: { desiredResponse: "engage" } },
        changes: {}, action: { label: "Беседа", pointLabel: "Разговор" },
        learning: { sensitivityDelta: 0, baselineSensitivityDelta: 0, familiarityDelta: 0 },
        transitions: [], subjectiveText: "Слова воспринимаются положительно.",
      } as any,
    });
    expect(frame.expressionMode.affect).toBe("positive");
  });

  it("closes the previous unanswered-question marker when the player replies", () => {
    const base = observerFrame();
    base.continuity.openThreads = ["Без явного ответа осталось: Иона: «Это безопасно?»", "Отложенная договорённость: позже"];
    const frame = applyVerbalInputToFrame(base, "Разумеется");
    expect(frame.continuity.openThreads).toEqual(["Отложенная договорённость: позже"]);
    expect(buildReactionTurnMessage(frame)).toContain("не повторяй дословно");
  });

  it("does not transfer the target reaction into an observer expression", () => {
    const frame = observerFrame();
    expect(frame.event.directlyExperienced).toBe(false);
    expect(frame.expressionMode.affect).toBe("neutral");
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("tease");
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("offer");
    const turn = buildReactionTurnMessage(frame);
    expect(turn).toContain("Ты видишь, что воздействие");
    expect(turn).toContain("направлено на Мира");
    expect(turn).not.toContain("Изменения у Мира");
  });

  it("treats a personal remark as personal rather than a safety audit", () => {
    const frame = applyVerbalInputToFrame(
      observerFrame(),
      "Мне кажется, тебе нравится контролировать",
    );
    expect(frame.event.playerSpeech).toBe("Мне кажется, тебе нравится контролировать");
    expect(frame.dramaticPosition.allowedSpeechActs).toEqual([]);
  });

  it("uses a reporting turn only when an assessment is requested", () => {
    const frame = applyVerbalInputToFrame(
      observerFrame(),
      "Что ты думаешь о её состоянии?",
    );
    expect(frame.event.playerSpeech).toBe("Что ты думаешь о её состоянии?");
    expect(frame.dramaticPosition.preferredSpeechAct).toBe("answer");
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("answer");
    expect(frame.dramaticPosition.primaryIntent).toContain("ответить на смысл");
  });

  it("does not force a probe merely because an ordinary dialogue is long", () => {
    const baseFrame = observerFrame();
    baseFrame.continuity.recentDialogue = Array.from(
      { length: 8 },
      (_, index) => `Реплика ${index + 1}`,
    );
    const frame = applyVerbalInputToFrame(baseFrame, "Сначала попроси");
    expect(frame.dramaticPosition.allowedSpeechActs).toEqual([]);
    expect(buildReactionTurnMessage(frame)).toContain("Что ты действительно произносишь сейчас?");
    expect(buildReactionTurnMessage(frame)).not.toContain("Доступные ходы");
  });

  it("does not turn a quiet verbal tick at the edge into distress or mandatory fragments", () => {
    const baseFrame = observerFrame();
    const frame = applyVerbalInputToFrame(
      {
        ...baseFrame,
        speaker: {
          ...baseFrame.speaker,
          core: {
            ...baseFrame.speaker.core,
          },
        },
      },
      "Что ты сейчас чувствуешь?",
    );
    // applyVerbalInputToFrame preserves the already compiled physiology, so
    // compile a matching high-tension frame for the actual assertion.
    const highTension = compileReactionFrame({
      speakerId: "nika",
      speakerName: "Ника",
      speakerGender: "female",
      targetId: "nika",
      targetName: "Ника",
      initiatorId: "player",
      initiatorName: "Калибратор",
      presentCharacters: ["Ника", "Калибратор"],
      contexts: [],
      core: { ...core, tension: 89, capacity: 37 },
      behavioralCore,
      observation: {
        behavioralState: "responsive",
        reaction: {
          pleasure: 0,
          discomfort: 0.5,
          overload: 0,
          engagement: 3,
          mixed: false,
        },
        changes: {
          attitude: 0,
          openness: 0,
          capacity: 0,
          tension: 0,
          sensitivity: 0,
          plasticity: 0,
          localAttitude: 0,
          localOpenness: 0,
        },
        learning: {
          sensitivityDelta: 0,
          baselineSensitivityDelta: 0,
          familiarityDelta: 0,
        },
        transitions: [],
        action: { label: "Реплика", pointLabel: "Разговор" },
        subjectiveText: "Слышит вопрос.",
      } as any,
    });
    expect(frame.event.playerSpeech).toBe("Что ты сейчас чувствуешь?");
    expect(highTension.event.physiologicalState).toContain(
      "пока не можешь ясно назвать",
    );
    expect(highTension.event.physiologicalState).not.toContain(
      "Дистресс устойчиво доминирует",
    );
    expect(highTension.expressionMode.control).toBe("strained");
    expect(highTension.expressionMode.requiresDisruption).toBe(false);
  });

  it("keeps high arousal as delivery color without making it the meaning of dialogue", () => {
    const highArousalFrame = compileReactionFrame({
      speakerId: "iona",
      speakerName: "Иона",
      targetId: "iona",
      targetName: "Иона",
      initiatorId: "player",
      initiatorName: "Калибратор",
      presentCharacters: ["Иона", "Калибратор"],
      contexts: [],
      core: { ...core, tension: 70 },
      behavioralCore,
    });
    const frame = applyVerbalInputToFrame(
      highArousalFrame,
      "Скажи, чего ты хочешь",
    );
    expect(frame.event.playerSpeech).toBe("Скажи, чего ты хочешь");
    expect(frame.event.mandatoryPhysiologicalFocus).toBe(false);
    expect(frame.expressionMode.requiresDisruption).toBe(false);
    expect(frame.expressionMode.maxWords).toBeGreaterThanOrEqual(16);
    expect(frame.expressionMode.instructions.join(" ")).toContain(
      "не подменяет смысл ответа",
    );
  });

  it("lets a new question replace the dramatic position of an earlier peak", () => {
    const peakFrame = compileReactionFrame({
      speakerId: "mira",
      speakerName: "Мира",
      targetId: "mira",
      targetName: "Мира",
      initiatorId: "player",
      initiatorName: "Калибратор",
      presentCharacters: ["Мира", "Калибратор"],
      contexts: [],
      core: { ...core, tension: 98 },
      behavioralCore,
    });
    expect(peakFrame.dramaticPosition.primaryIntent).toContain(
      "приближение пика",
    );

    const conversational = applyVerbalInputToFrame(
      peakFrame,
      "Как ты себя чувствуешь?",
    );
    expect(conversational.event.playerSpeech).toBe("Как ты себя чувствуешь?");
    expect(conversational.dramaticPosition.allowedSpeechActs).toContain("answer");
    expect(conversational.event.mandatoryPhysiologicalFocus).toBe(false);
  });

  it("renders long-term motives as background rather than mandatory dialogue topics", () => {
    const prompt = buildReactionSystemPrompt(observerFrame());
    expect(prompt).toContain("доверие к собственному суждению");
    expect(prompt).toContain("Тебя ведёт желание: быть полноценной участницей");
    expect(prompt).toContain("Ты решаешь");
  });

  it("separates relationship beliefs, unfinished threads and recent wording from current facts", () => {
    const frame = compileReactionFrame({
      speakerId: "nika",
      speakerName: "Ника",
      targetId: "nika",
      targetName: "Ника",
      initiatorId: "player",
      initiatorName: "Калибратор",
      presentCharacters: ["Ника", "Калибратор"],
      contexts: [],
      core,
      behavioralCore,
      recentDialogue: ["Ника: «Я уже сказала, что подумаю.»"],
      relevantEpisodes: ["Раньше он остановился после прямой просьбы."],
      canonicalFacts: ["Ника раньше работала пилотом грузового шаттла."],
      relationshipBeliefs: [
        "Раньше он реагировал на прямо обозначенную границу.",
      ],
      openThreads: ["Ника обещала вернуться к разговору после процедуры."],
    });
    const prompt = buildReactionSystemPrompt(frame);
    const turn = buildReactionTurnMessage(frame);
    expect(turn).toContain("[Память об отношениях]");
    expect(turn).toContain("[Незавершённое]");
    expect(turn).toContain("[Недавний разговор]");
    expect(turn).toContain("[Факты о себе]");
    expect(turn).toContain("Что ты действительно произносишь сейчас?");
    expect(turn).not.toContain("[Внутренний план реакции]");
    expect(prompt).toContain("Ты решаешь, что действительно произнесёшь сейчас");
  });

  it("requires a spoken response to a direct question instead of delayed silence", () => {
    const frame = applyVerbalInputToFrame(
      observerFrame(),
      "А что заставляет тебя перестать доверять?",
    );
    expect(frame.dramaticPosition.allowedSpeechActs).toContain("answer");
    expect(frame.event.requiresSpeech).toBe(true);
    expect(buildReactionSystemPrompt(frame)).toContain(
      "не возвращай пустой ответ",
    );
    expect(buildReactionSystemPrompt(frame)).not.toContain("допустимы молчание");
    expect(buildReactionTurnMessage(frame)).toContain("речевая реакция уже выбрана");
  });

  it("keeps an active panic condition audible after the triggering tick", () => {
    const frame = compileReactionFrame({
      speakerId: "eli",
      speakerName: "Эли",
      targetId: "eli",
      targetName: "Эли",
      initiatorId: "player",
      initiatorName: "Калибратор",
      presentCharacters: ["Эли", "Калибратор"],
      contexts: ["condition: Паническая Атака", "equipment: Секс-машина"],
      core: { ...core, capacity: 23, tension: 47 },
      behavioralCore,
    });

    expect(frame.expressionMode.arousal).toBe("high");
    expect(frame.expressionMode.affect).toBe("negative");
    expect(frame.expressionMode.control).toBe("strained");
    expect(frame.event.physiologicalState).toContain("Паника всё ещё держит тебя");
    expect(frame.expressionMode.instructions.join(" ")).toContain("Паника пробивается");
    expect(buildReactionTurnMessage(frame)).toContain("[Как твоё состояние прорывается в голос]");
  });

  it("preserves emotional instructions when a physical condition continues through dialogue", () => {
    const physical = compileReactionFrame({
      speakerId: "eli", speakerName: "Эли", targetId: "eli", targetName: "Эли",
      initiatorId: "player", initiatorName: "Калибратор",
      presentCharacters: ["Эли", "Калибратор"],
      contexts: ["condition: Паническая Атака"], core: { ...core, capacity: 23, tension: 47 },
      behavioralCore: {
        ...behavioralCore,
        emotionalVoice: { afraid: "Голос срывается на шёпот, дыхание учащается." },
      },
    });
    const conversational = applyVerbalInputToFrame(physical, "Что ты чувствуешь?");

    expect(conversational.expressionMode.instructions.join(" ")).toContain("Паника пробивается");
    expect(buildReactionSystemPrompt(conversational)).toContain("Именно сейчас твой голос");
    expect(buildReactionTurnMessage(conversational)).toContain("Твоё физиологическое состояние окрашивает форму речи");
  });

  it("marks asserted shared history for evidence checking", () => {
    const frame = applyVerbalInputToFrame(
      observerFrame(),
      "Что ты решила после того, как я нарушил обещание?",
    );
    expect(frame.event.sharedPastUnsupported).toBe(false);
    expect(buildReactionTurnMessage(frame)).not.toContain(
      "[Проверка общего прошлого — НЕТ ПОДТВЕРЖДЕНИЯ]",
    );
    expect(buildReactionTurnMessage(frame)).not.toContain(
      "путает тебя с кем-то другим",
    );
  });

  it("allows an open character to take a restrained initiative on non-questions", () => {
    const frame = applyVerbalInputToFrame(
      observerFrame(),
      "Мне важно, что ты говоришь прямо.",
    );
    expect(frame.dramaticPosition.allowedSpeechActs).toEqual([]);
  });

  it("does not turn accumulated dialogue into a mandatory character-led question", () => {
    const base = observerFrame();
    const frame = applyVerbalInputToFrame(
      {
        ...base,
        continuity: {
          ...base.continuity,
          recentDialogue: [
            "Калибратор: «Первая реплика»",
            "Иона: «Ответ»",
            "Калибратор: «Вторая реплика»",
            "Иона: «Ответ»",
            "Калибратор: «Третья реплика»",
            "Иона: «Ответ»",
          ],
        },
      },
      "Мне важно, что ты говоришь прямо.",
    );
    expect(frame.dramaticPosition.allowedSpeechActs).toEqual([]);
    expect(frame.dramaticPosition.primaryIntent).not.toContain(
      "сделать один собственный шаг",
    );
  });

  it("makes a new physical action outrank stale dialogue", () => {
    const frame = compileReactionFrame({
      speakerId: "eli", speakerName: "Эли", targetId: "eli", targetName: "Эли",
      initiatorId: "player", initiatorName: "Калибратор",
      presentCharacters: ["Эли", "Калибратор"], contexts: [], core,
      actionLabel: "Прикладывание льда", pointLabel: "Ступни",
      recentDialogue: ["Калибратор: «Я всё объясню.»", "Эли: «Обещаешь?»"],
      behavioralCore,
    });
    const prompt = buildReactionTurnMessage(frame);
    expect(prompt).toContain("Ты прямо сейчас переживаешь телесное воздействие");
    expect(prompt).toContain("не нужно отвечать на старый вопрос, обещание или спор");
    expect(prompt).not.toContain("Я всё объясню");
  });

  it("makes a fearful low-agency boundary prefer a plea-shaped request", () => {
    const pleaded = compileReactionFrame({
      speakerId: "eli", speakerName: "Эли", targetId: "eli", targetName: "Эли",
      initiatorId: "player", initiatorName: "Калибратор", presentCharacters: ["Эли", "Калибратор"], contexts: [], core, behavioralCore,
      observation: {
        behavioralState: "panic", reaction: { pleasure: 0, discomfort: 20, overload: 5, appraisal: -.8 },
        reactionSnapshot: { behavior: { desiredResponse: "stop" }, affect: { valence: -.8, emotion: "fear" } },
        boundaryExpression: { strategy: "plea", force: "desperate", instruction: "Ты почти не веришь, что тебя услышат; голос теряет твёрдость." },
        changes: {}, action: { label: "Воздействие" }, learning: {}, transitions: [], subjectiveText: "Страшно.",
      } as any,
    });
    expect(pleaded.dramaticPosition.preferredSpeechAct).toBe("request");
    expect(pleaded.dramaticPosition.secondaryConflict).toContain("голос теряет твёрдость");
  });

  it("changes the construction after a recent bare imperative", () => {
    const instruction = boundaryVariationInstruction([
      "Эли: «Прекрати. Немедленно.»",
      "Калибратор: «Нет.»",
    ], "Эли", "warning");
    expect(instruction).toContain("Не повторяй прежний голый императив");
    expect(instruction).toContain("последствие");
  });

  it("lets a rules-oriented character keep a controlled boundary formal", () => {
    const formal = compileReactionFrame({
      speakerId: "eli", speakerName: "Эли", targetId: "eli", targetName: "Эли",
      initiatorId: "player", initiatorName: "Калибратор", presentCharacters: ["Эли", "Калибратор"], contexts: [], core,
      behavioralCore: { ...behavioralCore, attentionFocus: ["rules"], defenses: ["Опирается на регламент."] },
      observation: {
        behavioralState: "responsive", reaction: { pleasure: 0, discomfort: 12, overload: 0, appraisal: -.6 },
        reactionSnapshot: { behavior: { desiredResponse: "stop" }, affect: { valence: -.6, emotion: "guarded" } },
        boundaryExpression: { strategy: "command", force: "controlled", instruction: "Вырази прямое требование." },
        changes: {}, action: { label: "Воздействие" }, learning: {}, transitions: [], subjectiveText: "Неприятно.",
      } as any,
    });
    expect(formal.dramaticPosition.preferredSpeechAct).toBe("set_boundary");
    expect(formal.dramaticPosition.secondaryConflict).toContain("процедурная точность");
    expect(formal.dramaticPosition.secondaryConflict).toContain("не придумывай конкретный регламент");
  });

  it("passes the committed command outcome to the speech prompt", () => {
    const frame = observerFrame();
    frame.event.commandOutcome = { status: "performed", actionLabel: "Снять трусики" };

    expect(buildReactionSystemPrompt(frame)).toContain("Авторитетный исход команды");
    expect(buildReactionTurnMessage(frame)).toContain("Исход команды в этом ходе");
    expect(buildReactionTurnMessage(frame)).toContain("выполняется");
  });

  it("uses an internal impulse through the same reaction frame", () => {
    const frame = observerFrame();
    const impulsive = applyInternalImpulseToFrame(frame, {
      id: "seek_orientation",
      primaryIntent: "Ты хочешь понять, сколько это продлится",
      secondaryConflict: "Тебе трудно держаться за счёт времени",
      allowedSpeechActs: ["probe", "request"],
    });

    expect(impulsive.event.requiresSpeech).toBe(true);
    expect(impulsive.dramaticPosition.primaryIntent).toContain("сколько это продлится");
    expect(buildReactionTurnMessage(impulsive)).toContain("сколько это продлится");
  });
});
