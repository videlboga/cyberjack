// Промпт для анализа сообщения персонажа
// Вставьте сюда список поз персонажа в формате:
// poses = [{ poseId: "...", name: "...", description: "..." }, ...]

export function buildMessageAnalysisPrompt(poses: Array<{ poseId: string, name: string, description: string }>, message: string) {
	const posesTable = poses.map(p => `- [${p.poseId}] ${p.name}: ${p.description}`).join('\n')
	return `Ты анализируешь сообщение игрока и должен определить, какую позу персонажа нужно активировать.\n\nДоступные позы:\n${posesTable}\n\nЕсли нужно сменить позу, верни poseId из списка выше. Если не нужно — верни null.\n\nСообщение игрока: "${message}"\n\nОтвет должен быть в формате JSON: { poseId: "..." } или { poseId: null }.`
}
