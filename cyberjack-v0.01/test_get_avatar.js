const nameMap = {
  "Векс": "Vex.png",
  "Сайлас": "Silas.png",
  "Эли": "Eli.png",
  "Никс": "Nyx.png",
  "Мара": "Mara.png",
  "Кай": "Kai.png",
  "Иден": "Eden.png",
  "Рунис": "Runis.png",
  "Рен": "Ren.png"
};

function getAvatarUrl(name) {
  for (const [ru, en] of Object.entries(nameMap)) {
    if (name.includes(ru)) return `/avatars/${en}`;
  }
  return null;
}
console.log(getAvatarUrl('Кай'));
