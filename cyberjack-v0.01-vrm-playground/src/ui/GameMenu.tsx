import React from 'react';
import { useI18n } from './i18n';

/**
 * Глобальное меню приложения, доступное на всех экранах.
 * Содержит выбор языка (RU/EN) в стиле текущей темы (manga2).
 * Рендерится поверх содержимого через backdrop-дровер.
 */
export function GameMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale, setLocale, t } = useI18n();

  if (!open) return null;

  const handleLocaleChange = async (newLocale: 'ru' | 'en') => {
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
      if (response.ok) {
        setLocale(newLocale);
      } else {
        console.error('Failed to update locale');
      }
    } catch (error) {
      console.error('Failed to update locale:', error);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="side-drawer menu-drawer game-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>Меню</h2>
          <button onClick={onClose}>×</button>
        </header>
        <h3>{t('language.selector')}</h3>
        <button
          className={locale === 'ru' ? 'active' : ''}
          onClick={() => handleLocaleChange('ru')}
        >
          {t('language.russian')}
        </button>
        <button
          className={locale === 'en' ? 'active' : ''}
          onClick={() => handleLocaleChange('en')}
        >
          {t('language.english')}
        </button>
      </aside>
    </div>
  );
}
