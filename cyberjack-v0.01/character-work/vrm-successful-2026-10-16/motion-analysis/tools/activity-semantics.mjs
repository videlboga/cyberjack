// A source label is evidence of intended use, never visual confirmation.
export const ACTIVITY_LABELS={neutral:'Спокойная поза',eating:'Еда / питьё',sleeping:'Сон',locomotion:'Перемещение',combat:'Бой',interaction:'Взаимодействие',unknown:'Не определено'};
export function activitySemantics(row,review){
 const text=[row.name,row.source?.bundle||row.source].filter(x=>typeof x==='string').join(' ');
 const rules=[['eating',/(?:^|[_/\s])(eat|drink|meal|food)(?:[_/\s]|$)/i],['sleeping',/(?:^|[_/\s])(sleep)(?:[_/\s]|$)/i],['locomotion',/(?:^|[_/\s])(walk|run|jump|dash)(?:[_/\s]|$)/i],['combat',/(?:^|[_/\s])(attack|damage|fight|guard)(?:[_/\s]|$)/i],['neutral',/(?:^|[_/\s])(idle|stand|sit|suwari)(?:[_/\s]|$)/i]];
 const hints=rules.filter(([,pattern])=>pattern.test(text)).map(([activity,pattern])=>({activity,evidence:'source-name',match:text.match(pattern)[0],verified:false}));
 const measured={posture:row.posture||row.body?.posture||'unknown',energy:row.energy||row.dynamics?.level||'unknown'};
 const reviewed=review?.activity&&review.activity!=='unknown'?review.activity:null;
 return {version:'activity-semantics-v1',activity:reviewed||hints[0]?.activity||'unknown',status:reviewed?'human-reviewed':'hypothesis',hints,measured,baseIdleEligible:reviewed==='neutral'&&['quiet','small'].includes(measured.energy),requires:reviewed?[]:['visual-activity-review'],note:'Геометрия подтверждает положение и динамику, но не смысл действия. Спокойный клип может содержать еду, жесты и работу с предметом.'};
}
