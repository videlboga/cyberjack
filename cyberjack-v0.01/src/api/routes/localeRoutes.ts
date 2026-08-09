import { Router } from 'express';
import { db } from '../../infrastructure/db';

const router = Router();

// Initialize locale table if not exists
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    // Set default locale if not exists
    const existing = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('locale');
    if (!existing) {
        db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('locale', 'ru');
    }
} catch (error) {
    console.error('[Locale] DB init error:', error);
}

export const getLocale = (req: any, res: any) => {
    try {
        const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('locale') as any;
        res.json({ locale: row?.value || 'ru' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get locale' });
    }
};

export const setLocale = (req: any, res: any) => {
    try {
        const { locale } = req.body;
        if (locale !== 'ru' && locale !== 'en') {
            return res.status(400).json({ error: 'Invalid locale' });
        }

        db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('locale', locale);
        res.json({ success: true, locale });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set locale' });
    }
};

export const getCurrentLocale = (): 'ru' | 'en' => {
    try {
        const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('locale') as any;
        return (row?.value === 'en' ? 'en' : 'ru') as 'ru' | 'en';
    } catch {
        return 'ru';
    }
};

router.get('/locale', getLocale);
router.post('/locale', setLocale);

export default router;
