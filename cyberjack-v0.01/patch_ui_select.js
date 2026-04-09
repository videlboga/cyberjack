const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');

const anchor = `</select>
                  </div>
                  <button onClick={moveCharacter}`;

const replacement = `</select>
                  </div>
                  {scenesList.find(s => s.id === moveSceneId)?.slots?.length > 0 && (
                    <div>
                      <label>Зона</label>
                      <select value={moveSlotId} onChange={(e) => setMoveSlotId(e.target.value)}>
                        {scenesList.find(s => s.id === moveSceneId)?.slots.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button onClick={moveCharacter}`;

code = code.replace(anchor, replacement);
fs.writeFileSync('src/ui/App.tsx', code);
