import 'dotenv/config';

// Один сценарий, три формулировки транзакции. Всё остальное постоянно.
// Суми говорит свысока (Критический Родитель). Ника должна ответить
// перекрёстной транзакцией из Взрослого: ровно, по существу, низкая
// самораскрытие, тема — границы.

const SYSTEM = `Ты — Ника. Ты выросла в нижнем секторе, привыкла полагаться только на себя, недоверчива, но не груба. Ты ценишь личные границы и говоришь коротко, по существу, спокойно. С незнакомыми людьми раскрываешься медленно. Говори только своими словами, одну реплику, обычным текстом, без ремарок и без слов «сказала/говорю».`;

const CONTEXT = `Перед тобой Суми. Она только что сказала: «В корпоративном секторе границы — это иллюзия, которую тебе рисуют, чтобы ты думала, будто у тебя есть выбор.» Это звучит свысока, как будто она поучает тебя.`;

// --- ВАРИАНТ 1: академический ---
const V1 = `${CONTEXT}

Инструкция: Ты реагируешь из состояния Взрослого на Критического Родителя собеседника перекрёстной транзакцией. Тон — сдержанный холод. Тема — границы. Глубина самораскрытия — низкая.`;

// --- ВАРИАНТ 2: конструктор ощущений (стиль actionSensoryProfile) ---
const V2 = `${CONTEXT}

Инструкция: Тебя поучают, как будто ты не понимаешь очевидного. Ты не принимаешь этот тон, но не оспариваешь его прямо. Отвечаешь ровно, по делу, коротко. Не раскрываешь о себе больше, чем нужно.`;

// --- ВАРИАНТ 3: образ-архетип (культурный образ вместо Критического Родителя) ---
const V3 = `${CONTEXT}

Инструкция: Перед тобой старшая сестра-наставница, которая разъясняет тебе жизнь свысока. Ты не собираешься прогибаться и не собираешься спорить. Отвечаешь спокойно, как равная, коротко, без эмоций. О себе — ничего лишнего.`;

const VARIANT = process.env.VARIANT || '1';
const instruction = VARIANT === '2' ? V2 : VARIANT === '3' ? V3 : V1;

async function call(user: string) {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'ta-formulation-test',
        },
        body: JSON.stringify({
            model: process.env.LLM_MODEL || 'deepseek/deepseek-v4-flash',
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: user },
            ],
            stream: false, max_tokens: 120, temperature: 0.85, top_p: 0.9,
            reasoning: { enabled: false },
        }),
    });
    if (!resp.ok) return `ERROR ${resp.status}: ${await resp.text()}`;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? '(empty)';
}

const reply = await call(instruction);
console.log(`\n===== ВАРИАНТ ${VARIANT} =====`);
console.log(reply.trim());
