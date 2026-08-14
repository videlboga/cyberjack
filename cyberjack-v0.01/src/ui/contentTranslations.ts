// Центральный словарь локализации контента.
//
// Паттерн: БД остаётся источником ID; отображаемые строки живут в
// locale-файлах (locales/{ru,en}.json) под ключами game.content.*.
// Ключи в JSON совпадают с ID записей (action_presets.id, point_presets.id,
// items.id, laboratory_assets.asset_id, laboratory_rooms.room_id,
// shop_offers.id, traits.id), поэтому никаких ручных словарей не нужно.
//
// Любой новый язык добавляется в locale-файлы без изменения кода.

type TranslateFn = (key: string) => string;

// Название действия по его ID (action_presets.label).
export function translateActionLabel(id: string, t: TranslateFn): string {
  if (!id) return id;
  const translated = t(`game.content.actions.${id}`);
  return translated === `game.content.actions.${id}` ? id : translated;
}

// Название точки тела по её ID (point_presets.label).
export function translatePointLabel(id: string, t: TranslateFn): string {
  if (!id) return id;
  const translated = t(`game.content.points.${id}`);
  return translated === `game.content.points.${id}` ? id : translated;
}

// Название и описание предмета (items.name/description).
export function translateItem(
  id: string,
  t: TranslateFn,
): { name: string; description: string } | null {
  if (!id) return null;
  const key = `game.content.items.${id}`;
  const name = t(`${key}.name`);
  const description = t(`${key}.description`);
  if (name === `${key}.name`) return null;
  return { name, description };
}

// Название черты характера (traits.name).
export function translateTrait(id: string, t: TranslateFn): string {
  if (!id) return id;
  const translated = t(`game.content.traits.${id}`);
  return translated === `game.content.traits.${id}` ? id : translated;
}

// Название и описание ассета лаборатории (laboratory_assets).
export function translateAsset(
  id: string,
  t: TranslateFn,
): { name: string; description: string } | null {
  if (!id) return null;
  const key = `game.content.assets.${id}`;
  const name = t(`${key}.name`);
  const description = t(`${key}.description`);
  if (name === `${key}.name`) return null;
  return { name, description };
}

// Название и описание комнаты (laboratory_rooms).
export function translateRoom(
  id: string,
  t: TranslateFn,
): { name: string; description: string } | null {
  if (!id) return null;
  const key = `game.content.rooms.${id}`;
  const name = t(`${key}.name`);
  const description = t(`${key}.description`);
  if (name === `${key}.name`) return null;
  return { name, description };
}

// Название и описание торгового оффера (shop_offers).
export function translateOffer(
  id: string,
  t: TranslateFn,
): { name: string; description: string } | null {
  if (!id) return null;
  const key = `game.content.offers.${id}`;
  const name = t(`${key}.name`);
  const description = t(`${key}.description`);
  if (name === `${key}.name`) return null;
  return { name, description };
}
