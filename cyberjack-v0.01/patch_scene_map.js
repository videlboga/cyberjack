const fs = require('fs');
let appContent = fs.readFileSync('src/ui/App.tsx', 'utf8');

const oldCode = `                      <div className="scene-characters">
                        {sc.characters && sc.characters.length ? (
                          sc.characters.map((entry: any) => (
                            <div key={entry.character.id} className="scene-character-row">
                              <div>
                                {entry.character.name}
                                <span className="scene-character-role">
                                  {entry.role || entry.character.kind}
                                </span>
                              </div>
                              <span className={\`scene-character-flag \${entry.presenceState}\`}>
                                {entry.presenceState}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="subtitle">Нет персонажей</span>
                        )}
                      </div>`;

const newCode = `                      <div className="scene-characters">
                        {(() => {
                           if (!sc.characters || !sc.characters.length) return <span className="subtitle">Нет персонажей</span>;
                           
                           const unassigned = sc.characters.filter((c: any) => !c.slotId);
                           const hasSlots = sc.slots && sc.slots.length > 0;
                           
                           if (!hasSlots) {
                               return sc.characters.map((entry: any) => (
                                   <div key={entry.character.id} className="scene-character-row">
                                      <div>
                                         {entry.character.name}
                                         <span className="scene-character-role">
                                           {entry.role || entry.character.kind}
                                         </span>
                                      </div>
                                      <span className={\`scene-character-flag \${entry.presenceState}\`}>
                                         {entry.presenceState}
                                      </span>
                                   </div>
                               ));
                           }

                           const slotsMap = sc.slots.map((slot: any) => ({
                               ...slot,
                               chars: sc.characters.filter((c: any) => c.slotId === slot.id)
                           }));
                           
                           return (
                               <div className="scene-map">
                                  {slotsMap.map((slot: any) => (
                                      <div key={slot.id} className={\`scene-slot \${slot.chars.length ? 'occupied' : 'empty'}\`}>
                                          <div className="slot-header">{slot.name} <span className="slot-cap">({slot.chars.length}/{slot.capacity})</span></div>
                                          <div className="slot-occupants">
                                              {slot.chars.length === 0 ? <span className="subtitle" style={{fontSize: '0.7em'}}>Свободно</span> : slot.chars.map((entry: any) => (
                                                  <div key={entry.character.id} className="scene-character-row">
                                                      <div title={entry.character.id}>
                                                          {entry.character.name}
                                                      </div>
                                                      <span className={\`scene-character-flag \${entry.presenceState}\`}>
                                                          {entry.presenceState}
                                                      </span>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  ))}
                                  {unassigned.length > 0 && (
                                      <div className="scene-slot unassigned">
                                          <div className="slot-header">Вне зон</div>
                                          <div className="slot-occupants">
                                              {unassigned.map((entry: any) => (
                                                  <div key={entry.character.id} className="scene-character-row">
                                                      <div title={entry.character.id}>
                                                          {entry.character.name}
                                                      </div>
                                                      <span className={\`scene-character-flag \${entry.presenceState}\`}>
                                                          {entry.presenceState}
                                                      </span>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                               </div>
                           );
                        })()}
                      </div>`;

if(appContent.includes(oldCode)) {
  fs.writeFileSync('src/ui/App.tsx', appContent.replace(oldCode, newCode));
  console.log('REPLACED');
} else {
  console.log('NOT FOUND');
}
