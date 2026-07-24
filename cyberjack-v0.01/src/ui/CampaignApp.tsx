import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalibrationPrototype } from './CalibrationPrototype';
import './CampaignApp.css';
import './LaboratoryRooms.css';
import { CharacterPortrait } from './CharacterPortrait';
import { resolveExistingDeviceVisual, VisualAffect, VisualPhase } from '../domain/characterVisuals';
import './DeviceControl.css';
import './JapaneseIndustrialTheme.css';

type Location = { id: string; title: string; shortTitle: string; description: string; travelMinutes: number };
type Resident = { id: string; name: string; kind: 'subject' | 'npc' | 'player'; subjectId?: string; role: string; currentRole?: string; title: string; presenceState: string; description?: string; biography?: string; roleHistory?: { role: string; previousRole?: string; worldMinute: number; title: string; description: string }[]; portrait?: string | null; state?: SubjectState | null; contexts?: { id: string; label: string; ticksActive: number }[]; points?: { id: string; label: string; sensitivity: number; attitude: number; openness: number; familiarity: number; exposureCount: number }[]; history?: { id: string; type: string; title: string; description?: string; time?: string; worldMinute?: number }[]; statistics?: { interactions: number; recordedEvents: number; chatMessages: number; discharges: number; breakdowns: number; completedContracts: number } };
type InventoryItem = { itemId: string; name: string; description: string; type: string; charges: number };
type DeviceSession = { deviceId: 'sex_machine' | 'capsule'; subjectId: string; configuration: string; wardrobe: 'nude' | 'underwear' | 'device_outfit'; status: 'loaded' | 'running' | 'paused' | 'stopped'; intensity: number; phase: 'sustain' | 'intense' | 'peak'; protocolId: string; targetPointIds: string[]; startedAtTick: number | null; updatedAtTick: number };
type LabAsset = { id: string; name: string; description: string; state: string; metadata?: { subjectId?: string; startedAt?: number; roomId?: string; deviceSession?: DeviceSession } };
type LabRoom = { id: string; name: string; type: 'workroom' | 'cell' | 'staff'; description: string; capacity: number; state: string; occupants: { id: string; name: string; kind: string; status: string; condition?: string }[] };
type ShopOffer = { id: string; itemId: string; name: string; description: string; category: 'item' | 'laboratory'; price: number; stock: number; owned: boolean };
type Candidate = { id: string; name: string; title: string; description: string; biography: string; staffCost: number; assetCost: number };
type Scenario = {
  clock: { totalMinutes: number; day: number; hour: number; minute: number; label: string };
  location: Location; locations: Location[]; credits: number;
  inventory: InventoryItem[]; laboratory: LabAsset[]; rooms: LabRoom[]; residents: Resident[]; candidates: Candidate[]; shop: ShopOffer[];
  events: { id: number; type: string; title: string; description: string }[];
};
type Condition = { type: string; key?: string; operator?: string; value: any };
type Contract = { id: string; title: string; description: string; issuerId: string; state: string; conditions: Condition[]; rewards: { credits?: number; trust?: number; items?: string[] }; deadlineTick?: number };
type SubjectState = Record<string, any> & { attitude?: number };

const conditionLabels: Record<string, string> = { attitude: 'Принятие', sensitivity: 'Чувствительность', capacity: 'Ресурс', openness: 'Открытость', plasticity: 'Пластичность' };
const sectionForLocation: Record<string, 'laboratory' | 'contracts' | 'market'> = { scene_lab_calibrator: 'laboratory', scene_liaison: 'contracts', scene_broker: 'market' };

type LabTrendKey = 'tension' | 'capacity' | 'attitude' | 'sensitivity';
const clampMetric = (value: number) => Math.max(0, Math.min(100, value));
function residentTrend(subjectId: string, key: LabTrendKey, current: number) {
  try {
    const saved = JSON.parse(localStorage.getItem(`cyberjack.stateHistory.${subjectId}`) || '[]');
    const values = Array.isArray(saved) ? saved.map(entry => Number(entry?.[key])).filter(Number.isFinite).slice(-20) : [];
    if (!values.length || values[values.length - 1] !== current) values.push(current);
    return values.length === 1 ? [values[0], values[0]] : values;
  } catch { return [current, current]; }
}
function LabMetricChart({ resident, metric, label, tone }: { resident: Resident; metric: LabTrendKey; label: string; tone: string }) {
  const state = resident.state || {};
  const current = Number(state[metric] ?? 0);
  const values = residentTrend(resident.subjectId || resident.id, metric, current);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${100 - clampMetric(value)}`).join(' ');
  const baselineName = `baseline${metric[0].toUpperCase()}${metric.slice(1)}`;
  const baseline = Number(state[baselineName] ?? state[`baseline_${metric}`] ?? current);
  return <div className={`lab-metric-chart ${tone}`}><header><span>{label}</span><b>{Math.round(current)}</b></header><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line className="grid" x1="0" x2="100" y1="50" y2="50" /><line className="baseline" x1="0" x2="100" y1={100 - clampMetric(baseline)} y2={100 - clampMetric(baseline)} /><polyline className="history" points={points} /><circle className="latest" cx="100" cy={100 - clampMetric(current)} r="3" /></svg></div>;
}

const currentFor = (condition: Condition, subject: SubjectState | null) => {
  if (!subject) return undefined;
  const key = condition.type === 'attitude' ? 'attitude' : condition.type === 'custom' ? condition.key : undefined;
  if (!key) return undefined;
  const baselineKeys: Record<string, string> = { attitude: 'attitude', sensitivity: 'sensitivity', openness: 'openness', plasticity: 'plasticity' };
  if (baselineKeys[key]) {
    const suffix = baselineKeys[key];
    const camel = `baseline${suffix[0].toUpperCase()}${suffix.slice(1)}`;
    return subject[camel] ?? subject[`baseline_${suffix}`] ?? subject[key];
  }
  return subject[key];
};
const met = (actual: any, operator = '==', target: any) => actual === undefined ? false : operator === '>' ? actual > target : operator === '<' ? actual < target : operator === '>=' ? actual >= target : operator === '<=' ? actual <= target : operator === '!=' ? actual != target : actual == target;

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Операция не выполнена');
  return data;
}

export function CampaignApp() {
  const [uiTheme, setUiTheme] = useState<'industrial' | 'graphite' | 'paper' | 'mist'>(() => {
    const saved = window.localStorage.getItem('cyberjack-ui-theme');
    return saved === 'graphite' || saved === 'paper' || saved === 'mist' ? saved : 'industrial';
  });
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subject, setSubject] = useState<SubjectState | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Resident | null>(null);
  const [utility, setUtility] = useState<'inventory' | 'journal' | null>(null);
  const [focusCharacterId, setFocusCharacterId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    try {
      const [world, orderData] = await Promise.all([api('/api/scenario?playerId=PL-1'), api('/api/contracts?playerId=PL-1')]);
      const assets = (world.residents as Resident[]).filter(resident => resident.role === 'asset' || resident.kind === 'subject');
      const activeId = assets.some(resident => resident.id === selectedAssetId) ? selectedAssetId : assets[0]?.id || null;
      const stateData = activeId ? await api(`/api/state?subjectId=${activeId}&sceneId=scene_lab_calibrator&pointId=neck`) : null;
      setScenario(world); setContracts([...(orderData.accepted || []), ...(orderData.available || [])]); setSubject(stateData?.subject || null);
      if (activeId !== selectedAssetId) setSelectedAssetId(activeId);
      if (!quiet) setError(null);
    } catch (e: any) { if (!quiet) setError(e.message); }
  }, [selectedAssetId]);

  useEffect(() => { load(); const timer = window.setInterval(() => load(true), 4000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    window.localStorage.setItem('cyberjack-ui-theme', uiTheme);
  }, [uiTheme]);

  const mutate = async (path: string, body: Record<string, unknown>, successText: string) => {
    if (busy) return false;
    setBusy(true); setError(null);
    try {
      await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setNotice(successText); await load(); return true;
    } catch (e: any) { setError(e.message); return false; }
    finally { setBusy(false); }
  };

  const navigate = async (locationId: string) => {
    setUtility(null); setInteraction(null);
    if (scenario?.location.id === locationId) return;
    const target = scenario?.locations.find(item => item.id === locationId);
    await mutate('/api/scenario/travel', { playerId: 'PL-1', locationId }, `Прибытие: ${target?.shortTitle || locationId}`);
  };

  const accepted = contracts.filter(contract => contract.state === 'accepted');
  const deadline = useMemo(() => {
    const nearest = accepted.map(item => item.deadlineTick).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b)[0];
    if (!nearest || !scenario) return null;
    const left = Math.max(0, nearest - scenario.clock.totalMinutes);
    return `${Math.floor(left / 1440)}д ${Math.floor((left % 1440) / 60)}ч`;
  }, [accepted, scenario]);

  if (!scenario) return <main className="campaign-loading">{error || 'Загрузка сектора…'}</main>;
  const selectedAsset = scenario.residents.find(resident => resident.id === selectedAssetId) || null;
  const currentSection = utility || sectionForLocation[scenario.location.id] || 'laboratory';
  const calibrationWitnesses = (() => {
    if (!interaction) return [];
    const targetDevice = scenario.laboratory.find(asset => asset.metadata?.subjectId === interaction.id);
    const roomId = targetDevice?.metadata?.roomId || scenario.rooms.find(room => room.occupants.some(person => person.id === interaction.id))?.id;
    if (!roomId) return [];
    const isolatedIds = new Set(scenario.laboratory.filter(asset => ['lab_recovery_capsule', 'lab_sensory_pod', 'lab_sex_machine'].includes(asset.id)).map(asset => asset.metadata?.subjectId).filter(Boolean));
    return scenario.residents.filter(resident => resident.id !== interaction.id && !isolatedIds.has(resident.id) && (scenario.laboratory.find(asset => asset.metadata?.subjectId === resident.id)?.metadata?.roomId || scenario.rooms.find(room => room.occupants.some(person => person.id === resident.id))?.id) === roomId);
  })();

  return <div className="campaign-shell" data-theme={uiTheme}>
    <header className="campaign-statusbar">
      <div className="campaign-brand"><b>CYBERJACK</b><span>ТЕРМИНАЛ КАЛИБРАТОРА</span></div>
      <div className="campaign-current"><small>МЕСТО</small><strong>{interaction ? `${scenario.location.shortTitle} / ${interaction.name}` : scenario.location.shortTitle}</strong></div>
      <div className="campaign-status-spacer" />
      {deadline && <div className="campaign-stat deadline"><small>СРОК</small><strong>{deadline}</strong></div>}
      <div className="campaign-stat credits"><small>СЧЁТ</small><strong>{Math.round(scenario.credits)} cr</strong></div>
      <div className="campaign-stat"><small>ВРЕМЯ</small><strong>{scenario.clock.label}</strong></div>
      <label className="theme-switcher"><small>ТЕМА</small><select aria-label="Тема интерфейса" value={uiTheme} onChange={event => setUiTheme(event.target.value as 'industrial' | 'graphite' | 'paper' | 'mist')}><option value="industrial">Industrial</option><option value="graphite">Graphite</option><option value="paper">Sage</option><option value="mist">Mist</option></select></label>
    </header>
    <div className="campaign-frame">
      <nav className="campaign-nav">
        <section><small>РАБОЧИЕ МЕСТА</small>
          <NavButton active={!utility && scenario.location.id === 'scene_lab_calibrator'} label="Лаборатория" meta={`${scenario.residents.length} персонажа`} onClick={() => navigate('scene_lab_calibrator')} />
          <NavButton active={!utility && scenario.location.id === 'scene_liaison'} label="Контракты" meta={`${accepted.length} активных`} onClick={() => navigate('scene_liaison')} />
          <NavButton active={!utility && scenario.location.id === 'scene_broker'} label="Брокер" meta="Каталог" onClick={() => navigate('scene_broker')} />
        </section>
        <section><small>УПРАВЛЕНИЕ</small>
          <NavButton active={utility === 'inventory'} label="Имущество" meta={`${scenario.inventory.length} позиций`} onClick={() => { setInteraction(null); setUtility('inventory'); }} />
          <NavButton active={utility === 'journal'} label="Журнал" meta={`${scenario.events.length} событий`} onClick={() => { setInteraction(null); setUtility('journal'); }} />
        </section>
        <div className="campaign-nav-bottom"><button disabled={busy} onClick={() => mutate('/api/scenario/time/pass', { playerId: 'PL-1', minutes: 60 }, 'Прошёл один час')}>Подождать час</button><small>Любое действие также расходует глобальное время.</small></div>
      </nav>
      <div className="campaign-content">
        {interaction ? <CalibrationPrototype subjectId={interaction.subjectId || interaction.id} subjectName={interaction.name} nearbyCharacters={calibrationWitnesses.map(resident => ({ id: resident.subjectId || resident.id, name: resident.name, role: resident.role, title: resident.title }))} uiTheme={uiTheme} onThemeChange={setUiTheme} onExit={() => setInteraction(null)} />
        : currentSection === 'laboratory' ? <LaboratoryOverview scenario={scenario} subject={subject} selectedAssetId={selectedAssetId} onSelectAsset={setSelectedAssetId} busy={busy} focusCharacterId={focusCharacterId} onFocusHandled={() => setFocusCharacterId(null)} onInteract={setInteraction} onRefresh={() => load(true)} onPassTime={minutes => mutate('/api/scenario/time/pass', { playerId: 'PL-1', minutes }, `Прошло ${minutes} минут`)} onUse={(asset, resident) => mutate(`/api/scenario/laboratory/${asset.id}/use`, { playerId: 'PL-1', subjectId: resident.id }, asset.metadata?.subjectId === resident.id ? `${resident.name}: устройство освобождено` : `${resident.name}: ${asset.name}`)} onChangeRole={(resident, role) => mutate(`/api/scenario/characters/${resident.id}/role`, { playerId: 'PL-1', role }, role === 'asset' ? `${resident.name}: оформлена как актив` : `${resident.name}: назначена в штат`)} />
        : currentSection === 'market' ? <ShopView scenario={scenario} busy={busy} onBuy={offer => mutate(`/api/scenario/shop/${offer.id}/buy`, { playerId: 'PL-1' }, `${offer.name}: приобретено`)} onRecruit={(candidate, role) => mutate(`/api/scenario/candidates/${candidate.id}/recruit`, { playerId: 'PL-1', role }, role === 'asset' ? `${candidate.name}: принята как актив` : `${candidate.name}: нанята в штат`)} />
        : currentSection === 'contracts' ? <ContractOffice contracts={contracts} subject={subject} subjectName={selectedAsset?.name || 'Актив'} busy={busy} now={scenario.clock.totalMinutes} onAccept={contract => mutate(`/api/contracts/${contract.id}/accept`, { playerId: 'PL-1' }, `Контракт принят: ${contract.title}`)} onDeliver={contract => selectedAssetId ? mutate(`/api/contracts/${contract.id}/deliver`, { subjectId: selectedAssetId }, `Контракт выполнен: ${contract.title}`) : Promise.resolve(false)} />
        : currentSection === 'inventory' ? <InventoryView items={scenario.inventory} />
        : <JournalView events={scenario.events} />}
      </div>
    </div>
    {(error || notice) && <div className={`campaign-toast ${error ? 'error' : ''}`} onClick={() => { setError(null); setNotice(null); }}>{error || notice}<button>×</button></div>}
  </div>;
}

function NavButton({ active, label, meta, onClick }: { active: boolean; label: string; meta: string; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick}><span>{label}</span><small>{meta}</small></button>;
}

function LaboratoryOverview({ scenario, subject, selectedAssetId, onSelectAsset, busy, focusCharacterId, onFocusHandled, onInteract, onRefresh, onPassTime, onUse, onChangeRole }: { scenario: Scenario; subject: SubjectState | null; selectedAssetId: string | null; onSelectAsset: (id: string) => void; busy: boolean; focusCharacterId: string | null; onFocusHandled: () => void; onInteract: (resident: Resident) => void; onRefresh: () => Promise<void>; onPassTime: (minutes: number) => Promise<boolean>; onUse: (asset: LabAsset, resident: Resident) => Promise<boolean> | void; onChangeRole: (resident: Resident, role: 'staff' | 'asset') => void }) {
  const [selectedRoomId, setSelectedRoomId] = useState(scenario.rooms[0]?.id || '');
  const [conversation, setConversation] = useState<{ resident: Resident; container: string; kind: 'cell' | 'staff' | 'room' | 'capsule'; asset?: LabAsset } | null>(null);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const selectedRoom = scenario.rooms.find(room => room.id === selectedRoomId) || scenario.rooms[0];
  const assets = scenario.residents.filter(resident => resident.role === 'asset' || resident.kind === 'subject');
  const selectedAsset = assets.find(resident => resident.id === selectedAssetId) || assets[0];
  const occupiedDevice = scenario.laboratory.find(asset => asset.metadata?.subjectId === selectedAsset?.id);
  const roomAssets = scenario.laboratory.filter(asset => asset.metadata?.roomId === selectedRoom?.id);
  const visibleOccupants = selectedRoom?.occupants.filter(person => !person.status.startsWith('device:')) || [];
  const roomPanelResidents = scenario.residents.filter(resident =>
    visibleOccupants.some(person => person.id === resident.id)
    || roomAssets.some(asset => asset.metadata?.subjectId === resident.id),
  );
  const roomForCharacter = (characterId: string) => scenario.laboratory.find(asset => asset.metadata?.subjectId === characterId)?.metadata?.roomId
    || scenario.rooms.find(room => room.occupants.some(person => person.id === characterId))?.id;
  useEffect(() => {
    if (!focusCharacterId) return;
    const device = scenario.laboratory.find(asset => asset.metadata?.subjectId === focusCharacterId);
    const room = device?.metadata?.roomId || scenario.rooms.find(entry => entry.occupants.some(person => person.id === focusCharacterId))?.id;
    if (room) setSelectedRoomId(room);
    onFocusHandled();
  }, [focusCharacterId, onFocusHandled, scenario.laboratory, scenario.rooms]);
  if (dossierId) return <CharacterDirectory residents={scenario.residents} dossierId={dossierId} busy={busy} onSelect={setDossierId} onLocate={resident => { const room = roomForCharacter(resident.id); if (room) setSelectedRoomId(room); setDossierId(null); }} onChangeRole={onChangeRole} />;
  if (conversation) {
    const currentResident = scenario.residents.find(entry => entry.id === conversation.resident.id) || conversation.resident;
    const currentDevice = scenario.laboratory.find(asset => asset.metadata?.subjectId === currentResident.id);
    const currentRoom = scenario.rooms.find(room => room.id === roomForCharacter(currentResident.id));
    const currentContainer = currentDevice?.name || currentRoom?.name || conversation.container;
    const currentKind = currentDevice ? (currentDevice.id === 'lab_recovery_capsule' ? 'capsule' : conversation.kind) : currentRoom?.type === 'cell' ? 'cell' : currentRoom?.type === 'staff' ? 'staff' : 'room';
    if (currentDevice && ['lab_sex_machine', 'lab_sensory_pod'].includes(currentDevice.id)) {
      return <DeviceControlScreen asset={currentDevice} resident={currentResident} clock={scenario.clock} busy={busy} onRefresh={onRefresh} onPassTime={onPassTime} onRelease={async () => { const released = await onUse(currentDevice, currentResident); if (released !== false) setConversation(null); }} onExit={() => setConversation(null)} />;
    }
    return <ContainerConversation resident={currentResident} container={currentContainer} kind={currentKind} busy={busy} onRefresh={onRefresh} onPassTime={onPassTime} onRelease={currentDevice ? async () => { const released = await onUse(currentDevice, currentResident); if (released !== false) setConversation(null); } : undefined} onExit={() => setConversation(null)} />;
  }
  return <main className="lab-overview">
    <header className="screen-heading lab-heading"><div><p>ЛИЧНЫЙ КОМПЛЕКС</p><h1>Лаборатория</h1><span>Выберите помещение, чтобы увидеть находящихся там персонажей и установленное оборудование.</span></div><div className="lab-capacity"><small>ПОМЕЩЕНИЯ</small><strong>{scenario.rooms.length}</strong><span>доступно</span></div></header>
    <section className="lab-spatial">
      <aside className="room-rail"><small>ПЛАН ЛАБОРАТОРИИ</small>{scenario.rooms.map(room => {
        const assets = scenario.laboratory.filter(asset => asset.metadata?.roomId === room.id);
        const people = room.occupants.filter(person => !person.status.startsWith('device:')).length + assets.filter(asset => asset.metadata?.subjectId).length;
        return <button className={room.id === selectedRoom?.id ? 'active' : ''} key={room.id} onClick={() => setSelectedRoomId(room.id)}><span>{room.name}</span><small>{people} чел. · {assets.length} оборуд.</small></button>;
      })}<div className="asset-register"><small>СОСТАВ</small>{assets.length > 0 && <label className="active-asset"><span>Рабочий актив</span><select value={selectedAsset?.id || ''} onChange={event => onSelectAsset(event.target.value)}>{assets.map(resident => <option key={resident.id} value={resident.id}>{resident.name}</option>)}</select></label>}<b className="register-heading">Активы</b>{assets.map(resident => <button className={resident.id === selectedAsset?.id ? 'selected' : ''} key={resident.id} onClick={() => setDossierId(resident.id)}><b>{resident.name}</b><span>{scenario.rooms.find(room => room.id === roomForCharacter(resident.id))?.name || 'место не определено'}</span></button>)}<b className="register-heading">Персонал</b>{scenario.residents.filter(resident => resident.role !== 'asset' && resident.kind !== 'subject').map(resident => <button key={resident.id} onClick={() => setDossierId(resident.id)}><b>{resident.name}</b><span>{scenario.rooms.find(room => room.id === roomForCharacter(resident.id))?.name || 'место не определено'}</span></button>)}</div></aside>
      {selectedRoom && <div className="room-detail"><header><div><small>{selectedRoom.type === 'cell' ? 'ЖИЛАЯ КАМЕРА' : selectedRoom.type === 'staff' ? 'СЛУЖЕБНОЕ ПОМЕЩЕНИЕ' : 'РАБОЧЕЕ ПОМЕЩЕНИЕ'}</small><h2>{selectedRoom.name}</h2><p>{selectedRoom.description}</p></div>{assets.length > 0 && <label className="room-active-asset"><span>РАБОЧИЙ АКТИВ</span><select value={selectedAsset?.id || ''} onChange={event => onSelectAsset(event.target.value)}>{assets.map(resident => <option key={`room-active-${resident.id}`} value={resident.id}>{resident.name}</option>)}</select></label>}<b>{visibleOccupants.length + roomAssets.filter(asset => asset.metadata?.subjectId).length}/{selectedRoom.capacity}</b></header>
        <section className="room-detail-section room-people-section"><h3>Персонажи</h3><div className="room-people">{roomPanelResidents.length ? roomPanelResidents.map(resident => { const device = roomAssets.find(asset => asset.metadata?.subjectId === resident.id); return <article key={resident.id}><div className="resident-avatar"><CharacterPortrait id={resident.subjectId || resident.id} name={resident.name} portrait={resident.portrait} contexts={resident.contexts} /></div><div><strong>{resident.name}</strong><span>{device?.name || (resident.role === 'assistant' ? 'Персонал' : 'Актив')}</span></div><button onClick={() => device?.id === 'lab_diagnostic_table' ? onInteract(resident) : setConversation({ resident, container: device?.name || selectedRoom.name, kind: device ? 'capsule' : selectedRoom.type === 'cell' ? 'cell' : selectedRoom.type === 'staff' ? 'staff' : 'room', asset: device })}>{device?.id === 'lab_diagnostic_table' ? 'Калибровка' : 'Взаимодействовать'}</button></article>; }) : <p>Помещение пусто.</p>}</div>{selectedRoom.type === 'cell' && <small className="passive-note">Размещённые здесь активы восстанавливаются автоматически с глобальным временем.</small>}</section>
        <section className="room-detail-section room-equipment-section"><h3>Оборудование</h3><div className="room-equipment">{roomAssets.length ? roomAssets.map(asset => {
      const acceptsAsset = ['lab_recovery_capsule', 'lab_diagnostic_table', 'lab_sensory_pod', 'lab_sex_machine'].includes(asset.id);
      const occupant = scenario.residents.find(resident => resident.id === asset.metadata?.subjectId);
      const target = occupant || selectedAsset;
      const occupantState = occupant?.state;
      return <article key={asset.id}><header><div><small>{occupant ? 'ЗАНЯТО' : 'ГОТОВО'}</small><strong>{asset.name}</strong></div><i>●</i></header><p>{asset.description}</p>{occupant && <div className="device-card-occupant"><div className="device-card-avatar"><CharacterPortrait id={occupant.subjectId || occupant.id} name={occupant.name} portrait={occupant.portrait} contexts={occupant.contexts} /></div><div className="device-card-telemetry"><b>{occupant.name}</b>{occupantState ? <div><LabMetricChart resident={occupant} metric="tension" label="АКТ" tone="amber" /><LabMetricChart resident={occupant} metric="capacity" label="РЕС" tone="mint" /><LabMetricChart resident={occupant} metric="attitude" label="ПРН" tone="blue" /><LabMetricChart resident={occupant} metric="sensitivity" label="ЧУВ" tone="violet" /></div> : <span>Данные состояния недоступны</span>}</div></div>}<footer>{asset.id === 'lab_diagnostic_table' && occupant ? <button className="primary" disabled={busy} onClick={() => onInteract(occupant)}>Калибровка</button> : occupant && <button className="primary" disabled={busy} onClick={() => setConversation({ resident: occupant, container: asset.name, kind: 'capsule', asset })}>Взаимодействовать</button>}{acceptsAsset && target && <button disabled={busy} onClick={() => onUse(asset, target)}>{occupant ? `Освободить: ${occupant.name}` : occupiedDevice ? `Переместить: ${target.name}` : `Поместить: ${target.name}`}</button>}</footer></article>;
    }) : <p>В помещении нет установленного оборудования.</p>}</div></section>
      </div>}
    </section>
  </main>;
}

function CharacterDirectory({ residents, dossierId, busy, onSelect, onLocate, onChangeRole }: { residents: Resident[]; dossierId: string | null; busy: boolean; onSelect: (id: string | null) => void; onLocate: (resident: Resident) => void; onChangeRole: (resident: Resident, role: 'staff' | 'asset') => void }) {
  const [tab, setTab] = useState<'overview' | 'state' | 'history'>('overview');
  const selected = residents.find(resident => resident.id === dossierId);
  if (!selected) return null;
  const state = selected.state;
  const assessment = (() => {
    if (!state) return ['Состояние пока не оценено.'];
    const notes: string[] = [];
    const baselineCapacity = state.baselineCapacity ?? state.capacity ?? 50;
    if (baselineCapacity <= 25) notes.push('Наблюдаются признаки глубокого хронического истощения; обычного отдыха недостаточно.');
    else if (baselineCapacity <= 40) notes.push('Выносливость снижена длительной нагрузкой. Требуется продолжительное восстановление.');
    else if ((state.capacity || 0) < 25) notes.push('Сильно истощена в настоящий момент, хотя долговременный запас ещё сохранён.');
    else if ((state.capacity || 0) > baselineCapacity + 3) notes.push('Находится в восстановительном резерве и способна выдержать нагрузку выше привычной.');
    else notes.push('Физический ресурс находится возле привычного уровня.');
    if ((state.tension || 0) >= 85) notes.push('Крайне напряжена; речь и реакции могут быть фрагментарными.');
    else if ((state.tension || 0) >= 55) notes.push('Заметно возбуждена и реагирует эмоциональнее обычного.');
    else if ((state.tension || 0) <= 15) notes.push('Внешне спокойна, выраженного возбуждения не наблюдается.');
    if ((state.attitude || 0) >= 70 && (state.openness || 0) >= 60) notes.push('Охотно допускает контакт и сравнительно открыто сообщает о своих ощущениях.');
    else if ((state.attitude || 0) <= 30) notes.push('Относится к калибратору настороженно или враждебно; сотрудничество ненадёжно.');
    else if ((state.openness || 0) <= 30) notes.push('Сохраняет дистанцию и склонна скрывать собственную реакцию.');
    return notes;
  })();
  const observedPoints = (selected.points || []).filter(point => point.exposureCount > 0).sort((a, b) => b.exposureCount - a.exposureCount);
  const favored = [...observedPoints].sort((a, b) => b.attitude - a.attitude).filter(point => point.attitude >= 60).slice(0, 3);
  const avoided = [...observedPoints].sort((a, b) => a.attitude - b.attitude).filter(point => point.attitude <= 40).slice(0, 3);
  const sensitive = [...observedPoints].sort((a, b) => b.sensitivity - a.sensitivity).filter(point => point.sensitivity >= 60).slice(0, 3);
  return <main className="character-dossier">
    <header><button onClick={() => onSelect(null)}>← Состав</button><span>ДОСЬЕ ПЕРСОНАЖА</span></header>
    <div className="dossier-layout"><aside><div className="dossier-portrait"><CharacterPortrait id={selected.subjectId || selected.id} name={selected.name} portrait={selected.portrait} contexts={selected.contexts} /></div><small>{selected.role === 'assistant' ? 'ПЕРСОНАЛ' : selected.role === 'asset' ? 'АКТИВ' : 'ПЕРСОНАЖ'}</small><h1>{selected.name}</h1><p>{selected.title}</p><ContextSummary contexts={selected.contexts} /><button className="primary" onClick={() => onLocate(selected)}>Перейти к персонажу</button></aside>
      <section><nav className="dossier-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Досье</button><button className={tab === 'state' ? 'active' : ''} onClick={() => setTab('state')}>Наблюдения</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Хроника</button></nav>
        {tab === 'overview' && <><article><small>БИОГРАФИЯ</small><p>{selected.biography || selected.description || 'Описание пока отсутствует.'}</p>{selected.roleHistory?.length ? <div className="dossier-role-history">{selected.roleHistory.map((entry,index)=><div key={`${entry.worldMinute}-${index}`}><i>День {Math.floor(entry.worldMinute/1440)+1}</i><b>{entry.title}</b><span>{entry.description}</span></div>)}</div> : null}</article><article><small>ТЕКУЩАЯ ОЦЕНКА</small><div className="narrative-notes">{assessment.map((note, index) => <p key={index}>{note}</p>)}</div></article><article><small>ОПЕРАТИВНЫЙ СТАТУС</small><p>{selected.role === 'asset' ? 'Содержится в лаборатории как актив и доступна для подготовки к контрактам.' : 'Состоит в штате лаборатории и имеет рабочее назначение.'}</p><div className="role-management">{selected.role === 'asset' ? <button disabled={busy} onClick={() => window.confirm(`Назначить ${selected.name} в штат?`) && onChangeRole(selected, 'staff')}>Назначить в штат</button> : <button disabled={busy} onClick={() => window.confirm(`Оформить ${selected.name} как актив? Рабочее назначение будет снято.`) && onChangeRole(selected, 'asset')}>Оформить как актив</button>}<small>Изменение статуса занимает 20 минут и требует свободного места.</small></div></article></>}
        {tab === 'state' && <><article><small>НАБЛЮДАЕМЫЕ ОСОБЕННОСТИ</small><div className="narrative-notes">{assessment.map((note, index) => <p key={index}>{note}</p>)}</div></article><article><small>ИЗВЕСТНЫЕ РЕАКЦИИ</small><div className="narrative-notes">{favored.length > 0 && <p>Наиболее благоприятно принимает контакт с зонами: {favored.map(point => point.label).join(', ')}.</p>}{avoided.length > 0 && <p>Сопротивление или выраженный дискомфорт чаще связаны с зонами: {avoided.map(point => point.label).join(', ')}.</p>}{sensitive.length > 0 && <p>Повышенная чувствительность отмечена в зонах: {sensitive.map(point => point.label).join(', ')}.</p>}{!observedPoints.length && <p>Устойчивые особенности реакции пока не установлены.</p>}</div></article><article><small>ТЕКУЩИЕ ОБСТОЯТЕЛЬСТВА</small><div className="dossier-tags">{selected.contexts?.length ? selected.contexts.map(context => <span key={context.id}>{context.label}</span>) : <i>Значимых активных состояний не отмечено.</i>}</div></article></>}
        {tab === 'history' && <article><small>ЗНАЧИМЫЕ ЭПИЗОДЫ</small><div className="dossier-history">{selected.history?.length ? selected.history.map(event => <div key={event.id}><i>{event.type}</i><b>{event.title}</b>{event.description && <p>{event.description}</p>}</div>) : <p>Значимых событий пока не записано.</p>}</div></article>}
      </section></div>
  </main>;
}

function DirectoryCard({ resident, onOpen }: { resident: Resident; onOpen: () => void }) {
  const state = resident.state;
  return <button className="directory-card" onClick={onOpen}><div className="directory-photo"><CharacterPortrait id={resident.subjectId || resident.id} name={resident.name} portrait={resident.portrait} contexts={resident.contexts} /></div><div><small>{resident.role === 'assistant' ? 'ПЕРСОНАЛ' : 'АКТИВ'}</small><strong>{resident.name}</strong><span>{resident.title}</span>{state && <p>Ресурс {Math.round(state.capacity || 0)} · напряжение {Math.round(state.tension || 0)}</p>}</div><i>Открыть досье →</i></button>;
}

function ContextSummary({ contexts = [] }: { contexts?: Resident['contexts'] }) {
  const clothing = contexts.filter(context => context.id.startsWith('eq_clothe_'));
  const active = contexts.filter(context => !context.id.startsWith('eq_clothe_'));
  return <div className="character-context-summary"><small>ОДЕЖДА</small><p>{clothing.length ? clothing.map(context => context.label.replace(/^Надеть\s+/i, '')).join(' · ') : 'Нет одежды'}</p><small>АКТИВНЫЕ КОНТЕКСТЫ</small><p>{active.length ? active.map(context => context.label).join(' · ') : 'Нет'}</p></div>;
}

const deviceConfigurations: Record<DeviceSession['deviceId'], Record<string, { label: string; wardrobes: DeviceSession['wardrobe'][] }>> = {
  sex_machine: {
    stirrups: { label: 'Стремена', wardrobes: ['nude', 'device_outfit'] },
    restrained: { label: 'Фиксированная платформа', wardrobes: ['nude', 'underwear'] },
    suspended: { label: 'Подвес', wardrobes: ['nude', 'device_outfit'] },
    milking: { label: 'Доильный модуль', wardrobes: ['nude', 'device_outfit'] },
    hmd: { label: 'HMD-протокол', wardrobes: ['nude', 'device_outfit'] },
    mind_control: { label: 'Нейроконтроль', wardrobes: ['nude', 'device_outfit'] },
  },
  capsule: {
    hmd: { label: 'Сенсорный HMD', wardrobes: ['nude', 'device_outfit'] },
    machine: { label: 'Машинный протокол', wardrobes: ['nude', 'device_outfit'] },
    electric: { label: 'Электрический протокол', wardrobes: ['nude', 'device_outfit'] },
  },
};

const deviceWardrobeLabels: Record<DeviceSession['wardrobe'], string> = {
  nude: 'Без одежды', underwear: 'Нижнее бельё', device_outfit: 'Экипировка устройства',
};

const deviceStatusLabels: Record<DeviceSession['status'], string> = {
  loaded: 'Загружено', running: 'Работает', paused: 'Пауза', stopped: 'Остановлено',
};

function DeviceControlScreen({ asset, resident, clock, busy, onRefresh, onPassTime, onRelease, onExit }: {
  asset: LabAsset; resident: Resident; clock: Scenario['clock']; busy: boolean;
  onRefresh: () => Promise<void>; onPassTime: (minutes: number) => Promise<boolean>;
  onRelease: () => Promise<void>; onExit: () => void;
}) {
  const session = asset.metadata?.deviceSession;
  const [lines, setLines] = useState<{ speaker: string; text: string; context?: string }[]>([]);
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectId = resident.subjectId || resident.id;
  const state = resident.state || {};
  const contextIds = new Set((resident.contexts || []).map(context => context.id));

  useEffect(() => {
    api(`/api/characters/${subjectId}/chat?limit=12`)
      .then(data => setLines((data.messages || []).map((message: any) => ({ speaker: message.role === 'assistant' ? resident.name : 'Калибратор', text: message.content, context: message.contextLabel }))))
      .catch((e: any) => setError(e.message));
  }, [resident.name, subjectId]);

  if (!session) return <main className="device-control-screen"><header><button onClick={onExit}>← Лаборатория</button><h1>{asset.name}</h1></header><p>Сессия устройства не инициализирована.</p></main>;

  const configuration = deviceConfigurations[session.deviceId][session.configuration];
  const slug = subjectId === 'S-AV-01' ? 'mira' : subjectId === 'NPC-LAB-01' ? 'iona' : subjectId === 'NPC-CAND-01' ? 'nika' : subjectId.toLowerCase();
  const affect: VisualAffect = session.phase === 'peak'
    ? (state.attitude || 0) < 45 ? 'high_negative' : 'climax'
    : session.phase === 'intense'
      ? contextIds.has('effect_subspace') ? 'subspace' : (state.attitude || 0) < 45 ? 'high_negative' : 'high_positive'
      : (state.attitude || 0) < 45 ? 'guarded' : 'receptive';
  const imagePath = resolveExistingDeviceVisual({
    characterSlug: slug,
    family: session.deviceId,
    configuration: session.configuration,
    wardrobe: session.wardrobe,
    affect,
    phase: session.phase as VisualPhase,
  });
  const elapsed = session.startedAtTick === null ? 0 : Math.max(0, clock.totalMinutes - session.startedAtTick);
  const baselineCapacity = state.baselineCapacity ?? state.baseline_capacity ?? state.capacity ?? 0;
  const baselineAttitude = state.baselineAttitude ?? state.baseline_attitude ?? state.attitude ?? 0;

  const control = async (command: string, payload: Record<string, unknown> = {}) => {
    if (working || busy) return;
    setWorking(true); setError(null);
    try {
      await api(`/api/scenario/laboratory/${asset.id}/control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'PL-1', command, ...payload }),
      });
      await onRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(false); }
  };

  const configure = (nextConfiguration: string, requestedWardrobe = session.wardrobe) => {
    const definition = deviceConfigurations[session.deviceId][nextConfiguration];
    const wardrobe = definition.wardrobes.includes(requestedWardrobe) ? requestedWardrobe : definition.wardrobes[0];
    return control('configure', { configuration: nextConfiguration, wardrobe });
  };

  const send = async () => {
    const message = text.trim(); if (!message || working) return;
    setText(''); setWorking(true); setError(null);
    setLines(previous => [...previous, { speaker: 'Калибратор', text: message, context: asset.name }].slice(-12));
    try {
      const data = await api('/api/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectId, playerId: 'PL-1', sceneId: 'scene_lab_calibrator', pointId: 'systemic', presetId: 'verbal_pressure', textMessage: message, interactionContext: `${asset.name}: ${configuration?.label || session.configuration}`, intensity: 1, skipLLM: false, llmMode: 'scene_dialogue', skipImageGen: true }) });
      const replies = (data.actorReplies || []).filter((reply: any) => reply.speech).map((reply: any) => ({ speaker: reply.actorName || resident.name, text: reply.speech, context: asset.name }));
      setLines(previous => [...previous, ...(replies.length ? replies : [{ speaker: resident.name, text: data.reply?.speech || `${resident.name} не отвечает.`, context: asset.name }])].slice(-12));
      await onRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(false); }
  };

  const advance = async (minutes: number) => { setWorking(true); const ok = await onPassTime(minutes); if (ok) await onRefresh(); setWorking(false); };
  const locked = session.status === 'running';
  return <main className="device-control-screen">
    <header className="device-control-header"><button onClick={onExit}>← Лаборатория</button><div><small>{session.deviceId === 'sex_machine' ? 'СЕКС-МАШИНА' : 'СЕНСОРНАЯ КАПСУЛА'}</small><h1>{resident.name}</h1><p>{asset.name}</p></div><div className={`device-status ${session.status}`}><i>●</i><span>{deviceStatusLabels[session.status]}</span></div></header>
    <section className="device-control-layout">
      <div className="device-visual-panel">
        <div className="device-avatar-frame">{imagePath ? <img src={imagePath} alt={`${resident.name}: ${configuration?.label}`} /> : <CharacterPortrait id={subjectId} name={resident.name} portrait={resident.portrait} contexts={resident.contexts} />}</div>
        <div className="device-configuration"><label>Конфигурация<select disabled={locked || working || busy} value={session.configuration} onChange={event => configure(event.target.value)}>{Object.entries(deviceConfigurations[session.deviceId]).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><label>Одежда<select disabled={locked || working || busy} value={session.wardrobe} onChange={event => configure(session.configuration, event.target.value as DeviceSession['wardrobe'])}>{(configuration?.wardrobes || []).map(wardrobe => <option key={wardrobe} value={wardrobe}>{deviceWardrobeLabels[wardrobe]}</option>)}</select></label></div>
      </div>
      <div className="device-monitor-panel">
        <header><div><small>ПРОТОКОЛ</small><strong>{configuration?.label}</strong></div><span>{elapsed} мин</span></header>
        <div className="device-metrics">
          <article><small>Напряжение</small><strong>{Math.round(state.tension || 0)}</strong><span>текущее</span></article>
          <article><small>Ресурс</small><strong>{Math.round(state.capacity || 0)}</strong><span>база {Math.round(baselineCapacity)}</span></article>
          <article><small>Принятие</small><strong>{Math.round(state.attitude || 0)}</strong><span>база {Math.round(baselineAttitude)}</span></article>
          <article><small>Открытость</small><strong>{Math.round(state.openness || 0)}</strong><span>текущее</span></article>
        </div>
        <div className="device-intensity"><header><span>Интенсивность</span><b>{session.intensity}%</b></header><input type="range" min="10" max="100" step="5" value={session.intensity} disabled={!['running', 'paused'].includes(session.status) || working || busy} onChange={event => control('adjust', { intensity: Number(event.target.value) })} /><div><span>sustain</span><span>intense</span><span>peak</span></div></div>
        <div className="device-actions">
          {['loaded', 'stopped'].includes(session.status) && <button className="primary" disabled={working || busy} onClick={() => control('start')}>Запустить протокол</button>}
          {session.status === 'running' && <button disabled={working || busy} onClick={() => control('pause')}>Пауза</button>}
          {session.status === 'paused' && <button className="primary" disabled={working || busy} onClick={() => control('resume')}>Продолжить</button>}
          {['running', 'paused'].includes(session.status) && <button className="danger" disabled={working || busy} onClick={() => control('stop')}>Остановить</button>}
          <button disabled={working || busy} onClick={() => advance(10)}>+10 минут</button><button disabled={working || busy} onClick={() => advance(30)}>+30 минут</button>
          <button disabled={working || busy || ['running', 'paused'].includes(session.status)} onClick={onRelease}>Освободить</button>
        </div>
        {error && <p className="device-error">{error}</p>}
      </div>
      <div className="device-chat-panel"><header><small>ИНТЕРКОМ</small><strong>{resident.name}</strong></header><div className="device-chat-lines">{lines.length ? lines.map((line, index) => <p key={index}><b>{line.speaker}{line.context && <i> · {line.context}</i>}</b><span>{line.text}</span></p>) : <i>Диалог ещё не начат.</i>}</div><footer><input value={text} onChange={event => setText(event.target.value)} onKeyDown={event => event.key === 'Enter' && send()} placeholder={`Связаться с ${resident.name}`} /><button disabled={working || !text.trim()} onClick={send}>Отправить</button></footer></div>
    </section>
  </main>;
}

function ContainerConversation({ resident, container, kind, busy, onRefresh, onPassTime, onRelease, onExit }: { resident: Resident; container: string; kind: 'cell' | 'staff' | 'room' | 'capsule'; busy: boolean; onRefresh: () => Promise<void>; onPassTime: (minutes: number) => Promise<boolean>; onRelease?: () => Promise<void>; onExit: () => void }) {
  const [lines, setLines] = useState<{ speaker: string; text: string; context?: string }[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState<string | null>(null);
  useEffect(() => {
    api(`/api/characters/${resident.subjectId || resident.id}/chat?limit=10`).then(data => setLines((data.messages || []).map((message: any) => ({ speaker: message.role === 'assistant' ? resident.name : 'Калибратор', text: message.content, context: message.contextLabel })))).catch((e: any) => setError(e.message));
  }, [resident.id, resident.name, resident.subjectId]);
  const send = async () => {
    const message = text.trim(); if (!message || sending) return;
    setText(''); setSending(true); setError(null); setLines(previous => [...previous, { speaker: 'Калибратор', text: message, context: container }].slice(-10));
    try {
      const data = await api('/api/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectId: resident.subjectId || resident.id, playerId: 'PL-1', sceneId: 'scene_lab_calibrator', pointId: 'systemic', presetId: 'verbal_pressure', textMessage: message, interactionContext: container, intensity: 1, skipLLM: false, llmMode: 'scene_dialogue', skipImageGen: true }) });
      const replies = (data.actorReplies || []).filter((reply: any) => reply.speech).map((reply: any) => ({ speaker: reply.actorName || reply.actorId, text: reply.speech, context: container }));
      setLines(previous => [...previous, ...(replies.length ? replies : [{ speaker: resident.name, text: data.reply?.speech || `${resident.name} не отвечает.`, context: container }])].slice(-10));
      const movement = (data.bundle?.systemNotes || []).find((note: string) => /перемещается|уже находится|нет свободного места|не может самостоятельно переместиться/i.test(note));
      if (movement) setObservation(String(movement).replace(/^\[Система\]:\s*/i, ''));
      await onRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };
  const inspect = () => {
    const state = resident.state;
    if (!state) return setObservation('Достоверных данных о текущем состоянии нет.');
    const capacity = Math.round(state.capacity || 0), tension = Math.round(state.tension || 0);
    const resource = capacity < 20 ? 'почти полностью истощена' : capacity < 45 ? 'заметно утомлена' : capacity > 80 ? 'хорошо восстановлена' : 'сохраняет рабочий запас сил';
    const arousal = tension > 80 ? 'крайне напряжена' : tension > 50 ? 'всё ещё заметно возбуждена' : tension < 15 ? 'внешне спокойна' : 'постепенно успокаивается';
    setObservation(`${resident.name} ${resource} и ${arousal}. Ресурс: ${capacity}, напряжение: ${tension}.`);
  };
  const rest = async () => { setSending(true); const advanced = await onPassTime(60); setSending(false); if (advanced) onExit(); };
  const contextTitle = kind === 'cell' ? 'ОТДЫХ И НАБЛЮДЕНИЕ' : kind === 'capsule' ? 'КОНТРОЛЬ ОБОРУДОВАНИЯ' : kind === 'staff' ? 'РАБОЧИЙ РАЗГОВОР' : 'ВЗАИМОДЕЙСТВИЕ В ПОМЕЩЕНИИ';
  return <main className="container-conversation"><header><button onClick={onExit}>← {container}</button><div><small>{contextTitle}</small><h1>{resident.name}</h1><p>{container}</p></div></header><section><div className="conversation-presence"><div className="dossier-portrait"><CharacterPortrait id={resident.subjectId || resident.id} name={resident.name} portrait={resident.portrait} contexts={resident.contexts} /></div><p>{resident.description}</p><ContextSummary contexts={resident.contexts} /><div className="context-actions"><small>ДОСТУПНО ЗДЕСЬ</small><button disabled={busy || sending} onClick={inspect}>Оценить состояние</button>{kind === 'cell' && <button disabled={busy || sending} onClick={rest}>Оставить отдыхать на час</button>}{kind === 'capsule' && onRelease && <button disabled={busy || sending} onClick={onRelease}>Освободить из капсулы</button>}</div>{observation && <p className="context-observation">{observation}</p>}</div><div className="conversation-chat"><div>{lines.length ? lines.map((line, index) => <p key={index}><b>{line.speaker}{line.context && <i> · {line.context}</i>}</b><span>{line.text}</span></p>) : <i>Разговор ещё не начат.</i>}</div>{error && <small>{error}</small>}<footer><input value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') send(); }} placeholder={kind === 'capsule' ? `Связаться с ${resident.name} по интеркому` : `Сказать: ${resident.name}`} /><button disabled={sending || !text.trim()} onClick={send}>{sending ? '…' : 'Отправить'}</button></footer></div></section></main>;
}

function ShopView({ scenario, busy, onBuy, onRecruit }: { scenario: Scenario; busy: boolean; onBuy: (offer: ShopOffer) => void; onRecruit: (candidate: Candidate, role: 'staff' | 'asset') => void }) {
  return <main className="management-screen"><header className="screen-heading"><div><p>ВИТРИНА БРОКЕРА</p><h1>Каталог</h1><span>Кандидаты оформляются в состав лаборатории. Оборудование и расходники приобретаются отдельно.</span></div><b>{Math.round(scenario.credits)} cr</b></header><section className="management-section">{scenario.candidates.length > 0 && <><h2>Кандидаты</h2><div className="candidate-grid">{scenario.candidates.map(candidate => <article key={candidate.id}><header><small>КАНДИДАТ</small><strong>{candidate.name}</strong><span>{candidate.title}</span></header><p>{candidate.description}</p><footer><button disabled={busy || scenario.credits < candidate.staffCost} onClick={() => onRecruit(candidate, 'staff')}>В штат · {candidate.staffCost} cr</button><button disabled={busy || scenario.credits < candidate.assetCost} onClick={() => onRecruit(candidate, 'asset')}>Как актив · {candidate.assetCost} cr</button></footer></article>)}</div></>}<h2>Лабораторные модули</h2><div className="offer-grid">{scenario.shop.filter(x => x.category === 'laboratory').map(offer => <OfferCard key={offer.id} offer={offer} credits={scenario.credits} busy={busy} onBuy={onBuy} />)}</div><h2>Предметы и расходники</h2><div className="offer-grid">{scenario.shop.filter(x => x.category === 'item').map(offer => <OfferCard key={offer.id} offer={offer} credits={scenario.credits} busy={busy} onBuy={onBuy} />)}</div></section></main>;
}

function OfferCard({ offer, credits, busy, onBuy }: { offer: ShopOffer; credits: number; busy: boolean; onBuy: (offer: ShopOffer) => void }) {
  const unavailable = offer.owned || offer.stock === 0;
  return <article className={unavailable ? 'owned' : ''}><div><small>{offer.category === 'laboratory' ? 'МОДУЛЬ' : offer.stock > 0 ? `ОСТАЛОСЬ ${offer.stock}` : 'ОБОРУДОВАНИЕ'}</small><strong>{offer.name}</strong><p>{offer.description}</p></div><footer><b>{offer.price} cr</b><button disabled={busy || unavailable || credits < offer.price} onClick={() => onBuy(offer)}>{offer.owned ? 'Установлено' : credits < offer.price ? 'Недостаточно средств' : 'Приобрести'}</button></footer></article>;
}

function ContractOffice({ contracts, subject, subjectName, busy, onAccept, onDeliver, now }: { contracts: Contract[]; subject: SubjectState | null; subjectName: string; busy: boolean; onAccept: (contract: Contract) => void; onDeliver: (contract: Contract) => void; now: number }) {
  return <main className="management-screen"><header className="screen-heading"><div><p>ОФИС СВЯЗНОГО</p><h1>Контракты</h1><span>Заказ задаёт требования, но не закрепляется за конкретным активом. Актив выбирается только при передаче.</span></div><b>{contracts.filter(x => x.state === 'accepted').length} активных</b></header><section className="contract-office-list">{contracts.map(contract => {
    const rows = contract.conditions.map(condition => ({ condition, current: currentFor(condition, subject), met: met(currentFor(condition, subject), condition.operator, condition.value) }));
    const ready = rows.length > 0 && rows.every(row => row.met); const hours = contract.deadlineTick ? Math.max(0, Math.ceil((contract.deadlineTick - now) / 60)) : null;
    return <article key={contract.id} className={contract.state === 'accepted' ? 'accepted' : ''}><header><div><small>{contract.state === 'accepted' ? `ПРИНЯТ · ${hours} Ч ДО СРОКА` : contract.issuerId}</small><strong>{contract.title}</strong></div><b>{contract.rewards?.credits || 0} cr</b></header><p>{contract.description}</p><div className="contract-requirements">{rows.map((row, i) => <span className={row.met ? 'met' : ''} key={i}>{row.met ? '✓' : '·'} {conditionLabels[row.condition.key || row.condition.type] || row.condition.key} <b>{typeof row.current === 'number' ? Math.round(row.current) : '—'} {row.condition.operator} {String(row.condition.value)}</b></span>)}</div>{contract.state === 'available' ? <button disabled={busy} onClick={() => onAccept(contract)}>Принять заказ</button> : <button className="deliver" disabled={busy || !ready} onClick={() => onDeliver(contract)}>{ready ? `Передать: ${subjectName}` : `${subjectName} пока не соответствует`}</button>}</article>;
  })}</section></main>;
}

function InventoryView({ items }: { items: InventoryItem[] }) {
  return <main className="management-screen"><header className="screen-heading"><div><p>УЧЁТ</p><h1>Имущество</h1><span>Переносное оборудование, одежда и расходники калибратора.</span></div><b>{items.length} позиций</b></header><section className="inventory-grid">{items.map(item => <article key={item.itemId}><div><small>{item.type}</small><strong>{item.name}</strong><p>{item.description}</p></div><b>{item.charges >= 0 ? `×${item.charges}` : 'постоянно'}</b></article>)}</section></main>;
}

function JournalView({ events }: { events: Scenario['events'] }) {
  return <main className="management-screen"><header className="screen-heading"><div><p>ХРОНИКА</p><h1>Журнал сектора</h1><span>Перемещения, приобретения, восстановительные циклы и изменения контрактов.</span></div></header><section className="journal-list">{events.length ? events.map(event => <article key={event.id}><small>{event.type}</small><strong>{event.title}</strong><p>{event.description}</p></article>) : <p className="empty-screen">Событий пока нет.</p>}</section></main>;
}
