import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspaceApp } from './WorkspaceApp';
import { I18nProvider } from './i18n';
import { LanguageSelector } from './LanguageSelector';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <LanguageSelector />
      <WorkspaceApp/>
    </I18nProvider>
  </React.StrictMode>
);
