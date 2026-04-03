import crypto from 'crypto';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const envKey = process.env.EMBEDDING_SECRET;
    if (envKey) {
        cachedKey = crypto.createHash('sha256').update(envKey).digest();
    } else {
        cachedKey = crypto.createHash('sha256').update(Buffer.alloc(32, 7)).digest();
    }
    return cachedKey;
}

export function buildEmbedding(text: string, dimensions = 64): number[] {
    if (!text) return new Array(dimensions).fill(0);
    const key = getKey();
    const vector = new Array(dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
        const hash = crypto.createHmac('sha256', key).update(`${i}:${text[i]}`).digest();
        for (let j = 0; j < dimensions; j++) {
            vector[j] += hash[j % hash.length] / 255;
        }
    }
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!length || !Number.isFinite(length)) return vector;
    return vector.map(value => value / length);
}
