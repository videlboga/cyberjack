const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf-8');

const oldToggle = `  const toggleContext = async (contextId: string, isActive: boolean) => {
    try {
      const res = await fetch(\`http://localhost:3001/api/contexts/toggle\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, isActive })
      });
      const data = await res.json();
      if (data.success) {
        fetchContexts();
      }
    } catch (e) {
      console.error(e);
    }
  };`;

const newToggle = `  const toggleContext = async (contextId: string, isActive: boolean) => {
    try {
      const res = await fetch(\`http://localhost:3001/api/contexts/toggle\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, isActive })
      });
      const data = await res.json();
      if (data.success) {
        fetchContexts();
        
        // Force an immediate "wait" tick that requests AI response to acknowledge the context change
        handleWait(1, true);
      }
    } catch (e) {
      console.error(e);
    }
  };`;

code = code.replace(oldToggle, newToggle);
fs.writeFileSync('src/ui/App.tsx', code);
