import {describe,it,expect} from 'vitest';
import {parsePostureCommand} from './postureCommand';
describe('explicit posture directives',()=>{
 it.each([['Сядь, пожалуйста','pose_sitting'],['Подними обе руки вверх','posture_arms_up'],['Опусти руки','posture_arms_down'],['Вытяни руки перед собой','posture_arms_front'],['Поверни голову налево','posture_head_left']])('%s',(text,id)=>expect(parsePostureCommand(text)).toBe(id));
 it.each(['Не поднимай руки','Я подниму руки','Подними левую руку','Подними руки?','Ника, подними руки','Подними руки и встань','Он сказал «подними руки»'])('leaves ambiguous or unsupported requests to semantic parser: %s',text=>expect(parsePostureCommand(text)).toBe(null));
});
it.each([['Вытяни правую ножку вперёд','posture_leg_right_forward'],['Я хочу на тебя полюбоваться. Вытяни правую ножку вперёд','posture_leg_right_forward'],['Вытяни левую ногу','posture_leg_left_forward']])('preserves a partial leg request: %s',(text,id)=>expect(parsePostureCommand(text)).toBe(id));

import {parseOutfitCommand,resolveOutfitSlot} from '../domain/vrmOutfits';
it.each([['Надень платье','mira','eq_outfit_mira_dress'],['Надень платье','rin','eq_outfit_rin_dress'],['Надень бельё','mira','eq_outfit_mira_lingerie'],['Надень трусы','kai','eq_outfit_kai_underwear']])('named wardrobe: %s / %s',(text,key,id)=>expect(parseOutfitCommand(text,key as 'mira'|'rin'|'kai')).toBe(id));
it.each(['Не надевай платье','Я надену платье','Надень костюм 01','Надень платье?'])('does not execute negation, description or numbered clothing: %s',text=>expect(parseOutfitCommand(text,'mira')).toBe(null));
it('resolves old saved outfit contexts and named contexts',()=>{expect(resolveOutfitSlot(['eq_outfit_01'],'mira')).toBe('01');expect(resolveOutfitSlot(['eq_outfit_01','eq_outfit_mira_dress'],'mira')).toBe('02')});
it('reflects the core clothing convention: absence of garments means bare',()=>{expect(resolveOutfitSlot(['act_present_feet','posture_head_left'],'mira')).toBe('03');expect(resolveOutfitSlot(['eq_clothe_costume'],'mira')).toBe('00');expect(resolveOutfitSlot(['eq_clothe_underwear'],'mira')).toBe('01');expect(resolveOutfitSlot(['eq_clothe_dress'],'rin')).toBe('01')});
