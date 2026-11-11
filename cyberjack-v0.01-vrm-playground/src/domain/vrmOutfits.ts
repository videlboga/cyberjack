import catalog from './vrm-outfits.json';
export type VrmCharacter=keyof typeof catalog;
export function vrmCharacterKey(id:string,name=''):VrmCharacter|null{
 const ids:Record<string,VrmCharacter>={'S-AV-01':'mira','NPC-CAND-GEN-03':'rin','NPC-RIN-01':'rin','NPC-CAND-GEN-05':'kai'};
 return ids[id]||({mira:'mira','мира':'mira',rin:'rin','рин':'rin',kai:'kai','кай':'kai'} as Record<string,VrmCharacter>)[name.trim().toLowerCase()]||null;
}
export const vrmOutfits=(key:VrmCharacter|null)=>key?catalog[key]:[];
export function resolveOutfitSlot(contextIds:string[],key:VrmCharacter|null){const reversed=[...contextIds].reverse();return reversed.map(id=>vrmOutfits(key).find(o=>o.id===id)?.slot).find(Boolean)||reversed.find(id=>/^eq_outfit_0[0-3]$/.test(id))?.slice(-2)||legacyOutfitSlot(contextIds,key)}
export function legacyOutfitSlot(ids:string[],key:VrmCharacter|null){
 if(ids.includes('eq_clothe_costume'))return '00';
 if(ids.includes('eq_clothe_dress'))return vrmOutfits(key).find(o=>o.id.endsWith('_dress'))?.slot||'00';
 if(ids.some(id=>['eq_clothe_underwear','eq_clothe_panties','eq_clothe_bra'].includes(id)))return vrmOutfits(key).find(o=>/lingerie|underwear/.test(o.id))?.slot||'00';
 if(ids.some(id=>id.startsWith('eq_clothe_')))return '00';
 return '03';
}
export function parseOutfitCommand(text:string,key:VrmCharacter|null){
 const line=text.toLocaleLowerCase('ru-RU').trim().replace(/[.!]$/,'').replace(/^пожалуйста[, ]+|[, ]+пожалуйста$/g,'').trim().replace(/ё/g,'е');
 if(/^(?:разденься|сними всю одежду|сними одежду|сними вс[её])$/.test(line))return vrmOutfits(key).find(o=>o.slot==='03')?.id||null;
 const m=/^(?:надень|одень|выбери|переоденься в|переоденься во) (.+)$/.exec(line);
 if(!m)return null;
 return vrmOutfits(key).find(o=>o.aliases.some(alias=>alias.replace(/ё/g,'е')===m[1]))?.id||null;
}
