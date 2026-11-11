import React, { useEffect, useMemo, useState } from "react";
import { portraitEmotions } from "../../domain/portraitEmotion";
import { applyVoiceTimbre, voiceTimbreLabels, type VoiceTimbre } from "../voiceTimbre";
import "./VocalizationAudit.css";

type Entry = {
  character: string;
  state: string;
  label?: string;
  oneShot: string;
  variants?: string[];
};
type Manifest = {
  version?: number;
  basePath: string;
  reactions: Record<string, Entry>;
};

const characterLabels: Record<string, string> = {
  generic: "Общий голос",
  nika: "Ника",
  mira: "Мира",
  iona: "Иона",
};
const conditionLabels: Record<string, string> = {
  neutral: "Нейтральное выражение без более сильного состояния.",
  curious: "Любопытство или вопросительная реакция.",
  guarded: "Настороженность и сохранённый самоконтроль.",
  defiant: "Открытый протест или сопротивление.",
  angry: "Злость; у персонажей без точного angry используется общий голос.",
  disgust: "Отвращение.", surprise: "Резкое удивление.", fear: "Страх или испуг.",
  distressed: "Выраженный дистресс.", pain: "Боль.", crying: "Плач или нервный срыв.",
  sad: "Печаль.", bored: "Скука или отсутствие вовлечённости.", smile: "Спокойная положительная реакция.",
  shy: "Смущение.", blush: "Заметное смущение или телесная положительная реакция.",
  receptive: "Принимающая реакция.", excited: "Сильное положительное возбуждение.",
  aroused: "Телесное возбуждение.", pleasure: "Удовольствие.", high_positive: "Сильная положительная реакция.",
  mixed: "Одновременно приятное и неприятное.", mixed_overload: "Смешанная сенсорная перегрузка.",
  submissive: "Податливая реакция.", subspace: "Сабспейс.", climax: "Физиологическая разрядка.",
  afterglow: "Состояние сразу после разрядки.", exhausted: "Истощение.", sleepy: "Сонливость.",
  smug: "Самодовольство.", high_negative: "Сильная отрицательная реакция.", unconscious: "Потеря контакта.",
};
const reviewKey = "cyberjack.vocalization-audit.v2";

function reachability(key: string, entry: Entry) {
  const suffix = key.slice(entry.character.length + 1);
  const direct = (portraitEmotions as readonly string[]).includes(suffix);
  if (direct) return { reachable: true, reason: `Выбирается при portraitEmotion = “${suffix}”.` };
  if (suffix === "voice_calibration") return { reachable: false, reason: "В runtime нет portraitEmotion “voice_calibration”; playReaction не запрашивает этот ключ." };
  if (suffix.startsWith("calm_")) return { reachable: false, reason: "Calm-состояние вычисляется, но точная generic/персональная эмоция выбирается раньше этого fallback." };
  if (suffix === "overload") return { reachable: false, reason: "Runtime запрашивает “mixed_overload”; ключ с суффиксом “overload” не совпадает." };
  return { reachable: false, reason: "Ключ не совпадает ни с одним текущим PortraitEmotion." };
}

export function VocalizationAudit() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [query, setQuery] = useState("");
  const [character, setCharacter] = useState("all");
  const [showDead, setShowDead] = useState(false);
  const [timbre, setTimbre] = useState<VoiceTimbre>("neutral");
  const [reviews, setReviews] = useState<Record<string, "keep" | "remove">>(() => {
    try { return JSON.parse(localStorage.getItem(reviewKey) || "{}"); } catch { return {}; }
  });
  useEffect(() => { fetch("/audio/reaction-audio-manifest.json").then(r => r.json()).then(setManifest); }, []);
  useEffect(() => { localStorage.setItem(reviewKey, JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => {
    document.querySelectorAll<HTMLAudioElement>(".vocal-audit audio").forEach(audio => applyVoiceTimbre(audio, timbre));
  }, [timbre, manifest]);
  const rows = useMemo(() => Object.entries(manifest?.reactions || {}).map(([key, entry]) => ({
    key, entry, ...reachability(key, entry), files: [entry.oneShot, ...(entry.variants || [])],
  })).filter(row => (character === "all" || row.entry.character === character)
    && (showDead || row.reachable)
    && `${row.key} ${row.entry.label || ""} ${row.entry.state}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [manifest, character, showDead, query]);
  const allRows = Object.entries(manifest?.reactions || {}).map(([key, entry]) => ({ key, ...reachability(key, entry) }));
  const deadCount = allRows.filter(row => !row.reachable).length;
  const reachableFiles = allRows.reduce((count, row) => {
    if (!row.reachable) return count;
    const entry = manifest?.reactions[row.key];
    return count + (entry ? 1 + (entry.variants?.length || 0) : 0);
  }, 0);
  const reviewedFiles = Object.keys(reviews).filter(key => key.includes("::")).length;
  const setReview = (key: string, file: string, value: "keep" | "remove") => setReviews(current => {
    const next = { ...current };
    const id = `${key}::${file}`;
    if (next[id] === value) delete next[id];
    else next[id] = value;
    return next;
  });
  const playOnlyThis = (current: HTMLAudioElement) => {
    applyVoiceTimbre(current, timbre);
    document.querySelectorAll<HTMLAudioElement>(".vocal-audit audio").forEach(audio => {
      if (audio !== current) audio.pause();
    });
  };

  return <main className="vocal-audit">
    <header className="vocal-audit__hero">
      <div><small>RUNTIME AUDIO DIAGNOSTICS</small><h1>Вокализации персонажей</h1><p>Только библиотека, которую сейчас читает <code>gameAudio.playReaction</code>. Каждый файл оценивается отдельно.</p></div>
      <aside><b>{reachableFiles}</b><span>используемых файлов</span><b>{reviewedFiles}</b><span>файлов проверено</span><b className="warn">{deadCount}</b><span>наборов недостижимы</span></aside>
    </header>
    <section className="vocal-audit__rules">
      <h2>Как выбирается звук</h2>
      <ol><li>Сначала ищется точный ключ <code>персонаж_эмоция</code>.</li><li>Затем точный <code>generic_эмоция</code>.</li><li>При интенсивности ниже 0.16 звук случайно пропускается в 55% случаев.</li><li>Из oneShot и variants выбирается случайный файл, отличный от предыдущего.</li></ol>
    </section>
    <nav className="vocal-audit__filters">
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск состояния или файла" />
      <select value={character} onChange={e => setCharacter(e.target.value)}><option value="all">Все голоса</option>{Object.entries(characterLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select value={timbre} onChange={e => setTimbre(e.target.value as VoiceTimbre)} aria-label="Тембровый профиль">{Object.entries(voiceTimbreLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <label><input type="checkbox" checked={showDead} onChange={e => setShowDead(e.target.checked)} /> показать недостижимые</label>
    </nav>
    {!manifest ? <p>Загрузка manifest…</p> : <section className="vocal-audit__grid">{rows.map(row => <article className={row.reachable ? "reachable" : "dead"} key={row.key}>
      <header><div><small>{characterLabels[row.entry.character] || row.entry.character}</small><h3>{row.entry.label || row.key}</h3><code>{row.key}</code></div><span>{row.reachable ? "В RUNTIME" : "НЕДОСТИЖИМО"}</span></header>
      <p className="condition"><b>Когда:</b> {conditionLabels[row.entry.state] || conditionLabels[row.key.slice(row.entry.character.length + 1)] || row.entry.state}</p>
      <p className="route">{row.reason}</p>
      <div className="tracks">{row.files.map((file, index) => {
        const id = `${row.key}::${file}`;
        const status = reviews[id];
        return <div className={`track ${status || ""}`} key={file}>
          <span>{index === 0 ? "основной" : `вариант ${index}`}</span>
          <audio controls preload="none" onPlay={event => playOnlyThis(event.currentTarget)} src={`${manifest.basePath}/${file}?v=${manifest.version || 1}`} />
          <code>{file}</code>
          <div className="track-review"><button className={status === "keep" ? "active keep" : "keep"} onClick={() => setReview(row.key, file, "keep")}>Оставить</button><button className={status === "remove" ? "active remove" : "remove"} onClick={() => setReview(row.key, file, "remove")}>Убрать</button></div>
        </div>;
      })}</div>
    </article>)}</section>}
  </main>;
}
