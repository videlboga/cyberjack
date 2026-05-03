import * as fs from 'fs';
const p = './src/ui/DiegeticUI.tsx';
let txt = fs.readFileSync(p, 'utf-8');

txt = txt.replace('const [hover, setHover] = useState<HoverData | null>(null);', 'const [hover, setHover] = useState<HoverData | null>(null);\n  const [activeCategory, setActiveCategory] = useState<string | null>(null);');

txt = txt.replace('setRadial({ partId, x, y });', 'setRadial({ partId, x, y });\n        setActiveCategory(null);');
txt = txt.replace('setRadial(null);', 'setRadial(null);\n        setActiveCategory(null);');

const radialReplacement = `      {radial && (() => {
        const renderItems = activeCategory ? (groupedActions[activeCategory] || []) : radialCategories;
        const actionCount = renderItems.length;
        const angleStep = actionCount ? 360 / actionCount : 0;

        return (
          <div style={{
              position: 'absolute', left: radial.x, top: radial.y, transform: 'translate(-50%, -50%)',
              width: '320px', height: '320px', pointerEvents: 'auto'
          }}>
            <div 
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '60px', height: '60px', background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid #00f0ff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 'bold', color: '#00f0ff', cursor: activeCategory ? 'pointer' : 'default'
              }}
              onClick={(e) => { e.stopPropagation(); if (activeCategory) setActiveCategory(null); }}
            >
              {activeCategory ? 'BACK' : 'CMD'}
            </div>

            {actionCount === 0 && (
               <div style={{
                position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
                fontSize: '10px', color: '#ff0055', background: 'rgba(0,0,0,0.8)', padding: '2px 5px', border: '1px solid #ff0055'
               }}>
                 NO_ACTIONS
               </div>
            )}

            {renderItems.map((item: any, idx: number) => {
               const baseAngle = actionCount === 1 ? 0 : (idx * angleStep) - 90;
               const isLocked = isProcessing;
               return (
                <button
                  key={item.id} disabled={isLocked && activeCategory != null}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!activeCategory) {
                      setActiveCategory(item.id);
                    } else {
                      sendAction(item.id, undefined, radial.partId, targetSubjectId || undefined);
                      setRadial(null);
                      setActiveCategory(null);
                    }
                  }}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: \`translate(-50%, -50%) rotate(\${baseAngle}deg) translate(\${activeCategory ? 120 : 90}px) rotate(\${-baseAngle}deg)\`,
                    width: activeCategory ? '120px' : '100px', height: '34px',
                    background: isLocked && activeCategory ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 20, 20, 0.9)',
                    border: (isLocked && activeCategory) ? '1px solid #ff0055' : '1px solid #00f0ff',
                    color: (isLocked && activeCategory) ? '#ff0055' : '#00f0ff', 
                    cursor: (isLocked && activeCategory) ? 'not-allowed' : 'pointer',
                    fontSize: '10px', fontWeight: 'bold', padding: '0 10px',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                    boxShadow: '0 0 10px rgba(0,240,255,0.2)'
                  }}
                  title={item.label}
                >
                  {item.label}
                </button>
               );
            })}
            <div onClick={() => { setRadial(null); setActiveCategory(null); }} style={{ position: 'fixed', top: -2000, left: -2000, width: 4000, height: 4000, zIndex: -1 }} />
          </div>
        );
      })()}`;

// Replace original radial code
txt = txt.replace(/\{radial && \(\s*<div style=\{\{[\s\S]*?\{radial && \(\s*<div style=\{\{/, 'MARKER1'); // Need a stable regex or indexOf
fs.writeFileSync(p, txt);
