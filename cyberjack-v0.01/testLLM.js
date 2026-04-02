fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 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'
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: `Ты — классификатор семантических параметров речи в симуляторе. Ответь ТОЛЬКО валидным JSON: {"intensity": 0.0-1.0, "valence": -1.0..1.0, "contact": 0.0-1.0, "sharpness": 0.0-1.0, "novelty": 0.5, "pointId": "general"}` },
      { role: 'user', content: 'Приветик' }
    ]
  })
}).then(r => r.json()).then(r => console.log(r)).catch(console.error);
