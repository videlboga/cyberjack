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
        
        // Force an immediate "wait" tick that requests AI response to acknowledge the context change
        handleWait(1, true);
      }
    } catch (e) {
      console.error(e);
    }
  };`;

const newToggle = `  const toggleContext = async (contextId: string, isActive: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(\`http://localhost:3001/api/contexts/toggle\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, isActive })
      });
      const data = await res.json();
      if (data.success) {
        fetchContexts();
        
        // Let's get the context preset's label to tell the AI exactly what happened
        const ctxLabel = contexts.find(c => c.id === contextId)?.label || contextId;
        const msg = isActive 
          ? \`[Внимание: Калибратор применил к тебе новый эффект/состояние: "\${ctxLabel}".]\` 
          : \`[Внимание: Калибратор снял с тебя эффект/состояние: "\${ctxLabel}".]\`;

        // Force immediate AI response
        const waitRes = await fetch('http://localhost:3001/api/wait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticks: 1,
            callLLM: true,
            customMessage: msg
          })
        });
        const waitData = await waitRes.json();
        
        if (waitData.success) {
          fetchState();
          
          if (waitData.reply && waitData.reply.reaction) {
            setLastReaction(\`"\${waitData.reply.speech}"\\n\\n[Реакция:\\n\${waitData.reply.reaction}]\`);
            addChatMsg('assistant', waitData.reply.speech, waitData.reply.reaction);
          } else {
            setLastReaction('Тик выполнен, но ИИ не дал ответа или произошла ошибка.');
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };`;

code = code.replace(oldToggle, newToggle);
fs.writeFileSync('src/ui/App.tsx', code);
