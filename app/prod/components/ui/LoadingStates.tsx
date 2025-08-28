import * as React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Загрузка конфигурации..."
}) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-500 mx-auto mb-4"></div>
      <h2 className="text-2xl font-bold text-white mb-2">{message}</h2>
      <p className="text-gray-400">Инициализация игровых данных</p>
    </div>
  </div>
);

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
    <div className="text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-white mb-2">Ошибка загрузки</h2>
      <p className="text-gray-400 mb-4">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg"
        >
          Перезагрузить
        </button>
      )}
    </div>
  </div>
);

interface ConfigNotFoundProps {
  onRetry?: () => void;
}

export const ConfigNotFound: React.FC<ConfigNotFoundProps> = ({ onRetry }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
    <div className="text-center">
      <div className="text-yellow-500 text-6xl mb-4">❓</div>
      <h2 className="text-2xl font-bold text-white mb-2">Конфигурация не найдена</h2>
      <p className="text-gray-400">Не удалось загрузить игровые данные</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg mt-4"
        >
          Попробовать снова
        </button>
      )}
    </div>
  </div>
);
