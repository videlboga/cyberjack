const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');

const regex = /async function handleAction.*?^  \}\n/ms;
const replacement = `  function addToQueue(options?: { presetId?: string; textMessage?: string; labelOverride?: string; intensityOverride?: number; }) {
    const actionId = options?.presetId || selectedAction;
    if (!actionId) return;

    const actionPreset = actions.find((a) => a.id === actionId);
    const label = options?.labelOverride || actionPreset?.label || actionId;
    const textMessage = options?.textMessage;
    const targetName = characters.find(c => c.id === actionTargetId)?.name || actionTargetId;

    const newAction: QueuedAction = {
      id: Math.random().toString(36).substring(7),
      actionId,
      label,
      targetId: actionTargetId,
      targetName,
      intensity: options?.intensityOverride ?? intensity,
      duration: actionDuration,
      textMessage,
      occupiesPoints: actionPreset?.occupiesPoints || []
    };

    if (newAction.occupiesPoints && newAction.occupiesPoints.length > 0) {
      for (const q of actionQueue) {
        if (q.occupiesPoints && q.occupiesPoints.some(pt => newAction.occupiesPoints!.includes(pt))) {
          setErrorMessage(\`Слот перекрывается с "\${q.label}"\`);
          return;
        }
      }
    }

    setActionQueue(prev => [...prev, newAction]);
    if (textMessage) setChatInput('');
    setErrorMessage('');
  }

  const removeFromQueue = (id: string) => {
    setActionQueue(q => q.filter(x => x.id !== id));
  };

  async function executeQueue() {
    if (!actionQueue.length) return;
    setLoading(true);
    setErrorMessage('');

    const chatAdditions: ChatEntry[] = actionQueue.map(q => {
      if (q.textMessage) return { role: 'player', text: q.textMessage };
      return { role: 'player', text: \`[На: \${q.targetName}] \${q.label}\${q.duration ? \` (\${q.duration}т)\` : ''}\` };
    });
    setChat(prev => [...prev, ...chatAdditions]);

    try {
      let finalData: any = null;
      for (let i = 0; i < actionQueue.length; i++) {
        const item = actionQueue[i];
        const isLast = i === actionQueue.length - 1;

        const res = await fetch(\`\${API_BASE}/api/tick\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: item.targetId,
            pointId,
            sceneId,
            presetId: item.actionId,
            intensity: item.intensity,
            textMessage: item.textMessage,
            skipLLM: !isLast,
            skipTimeTick: !isLast,
            dynamicModifiers: {
                contextConfig: item.duration > 0 ? { duration: item.duration } : undefined
            }
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Tick failed');
        finalData = data;
      }

      if (finalData) {
        setSubject(finalData.state);
        setPlayer(finalData.player);
        setDiagnostics(finalData.diagnostics);
        setEngineResult(finalData.tickResult);
        setClassifierLog(finalData.classifierLog);

        if (finalData.narratorReaction || finalData.reply?.reaction) {
          setPhysicalReaction(finalData.narratorReaction || finalData.reply?.reaction || '');
        }

        const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string }> = finalData.actorReplies || [];
        if (actorReplies.length) {
          const subjectName = finalData.state?.name || finalData.state?.subject?.name || 'Субъект';
          setChat((prev) => [
            ...prev,
            ...actorReplies.map((reply: any) => {
              return {
                role: 'subject' as const,
                text: reply.speech || '(молчит)',
                actorId: reply.actorId,
                kind: reply.kind,
                tone: reply.tone,
                label: reply.actorId === finalData.state?.subject?.id ? subjectName : reply.actorId
              };
            })
          ]);
        } else if (finalData.reply) {
          if (finalData.reply.speech !== undefined || finalData.reply.reaction !== undefined) {
            setChat((prev) => [
              ...prev,
              { role: 'subject', text: finalData.reply.speech || '(молчит)' }
            ]);
          }
        }
        if (finalData.promptMessages) setPromptLog(finalData.promptMessages);
        if (finalData.actionTrace) setActionTrace(finalData.actionTrace);
      }
      
      await fetchState(pointId);
      await fetchContexts();
      setActionQueue([]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ошибка выполнения действия');
    } finally {
      setLoading(false);
      setChatInput('');
    }
  }
`;
code = code.replace(regex, replacement);
fs.writeFileSync('src/ui/App.tsx', code);
