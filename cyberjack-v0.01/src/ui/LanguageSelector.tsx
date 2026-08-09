import React from 'react';
import { useI18n } from './i18n';

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  const handleLocaleChange = async (newLocale: 'ru' | 'en') => {
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale })
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
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      zIndex: 9999,
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '8px 12px',
      borderRadius: '4px',
      border: '1px solid #333'
    }}>
      <span style={{ color: '#888', fontSize: '12px' }}>{t('language.selector')}:</span>
      <button
        onClick={() => handleLocaleChange('ru')}
        style={{
          padding: '4px 8px',
          background: locale === 'ru' ? '#0f0' : '#333',
          color: locale === 'ru' ? '#000' : '#fff',
          border: '1px solid #0f0',
          cursor: 'pointer',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: locale === 'ru' ? 'bold' : 'normal'
        }}
      >
        RU
      </button>
      <button
        onClick={() => handleLocaleChange('en')}
        style={{
          padding: '4px 8px',
          background: locale === 'en' ? '#0f0' : '#333',
          color: locale === 'en' ? '#000' : '#fff',
          border: '1px solid #0f0',
          cursor: 'pointer',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: locale === 'en' ? 'bold' : 'normal'
        }}
      >
        EN
      </button>
    </div>
  );
}
