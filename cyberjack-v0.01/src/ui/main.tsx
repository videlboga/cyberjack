import React from 'react';
import ReactDOM from 'react-dom/client';
import DiegeticUI from './DiegeticUI'; // Импортируем наш новый интерфейс
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DiegeticUI />
  </React.StrictMode>
);
