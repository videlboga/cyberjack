'use client';

import { useState, useEffect } from 'react';

interface OpenRouterRequest {
  id: string;
  timestamp: Date;
  model: string;
  prompt: string;
  response: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  tokensUsed?: number;
  duration?: number;
}

interface OpenRouterDebugPanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function OpenRouterDebugPanel({ isVisible, onToggle }: OpenRouterDebugPanelProps) {
  const [requests, setRequests] = useState<OpenRouterRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Перехватываем fetch запросы к OpenRouter
  useEffect(() => {
    if (!isMonitoring) return;

    const originalFetch = window.fetch;
    let requestCount = 0;

    window.fetch = async (...args) => {
      const [url, options] = args;
      
      // Проверяем, является ли это запросом к OpenRouter
      if (typeof url === 'string' && url.includes('openrouter.ai')) {
        const requestId = `req_${Date.now()}_${++requestCount}`;
        const startTime = Date.now();
        
        // Создаем запись о запросе
        const request: OpenRouterRequest = {
          id: requestId,
          timestamp: new Date(),
          model: 'unknown',
          prompt: '',
          response: '',
          status: 'pending'
        };

        // Извлекаем модель и промпт из запроса
        if (options?.body) {
          try {
            const body = JSON.parse(options.body as string);
            request.model = body.model || 'unknown';
            request.prompt = body.messages?.[0]?.content || '';
          } catch (e) {
            console.error('Ошибка парсинга тела запроса:', e);
          }
        }

        setRequests(prev => [request, ...prev.slice(0, 9)]); // Храним последние 10 запросов

        try {
          const response = await originalFetch(...args);
          const endTime = Date.now();
          const duration = endTime - startTime;

          if (response.ok) {
            const responseData = await response.clone().json();
            const responseText = responseData.choices?.[0]?.message?.content || '';
            const tokensUsed = responseData.usage?.total_tokens;

            setRequests(prev => prev.map(req => 
              req.id === requestId 
                ? { 
                    ...req, 
                    status: 'success', 
                    response: responseText,
                    tokensUsed,
                    duration
                  }
                : req
            ));
          } else {
            const errorText = await response.text();
            setRequests(prev => prev.map(req => 
              req.id === requestId 
                ? { 
                    ...req, 
                    status: 'error', 
                    error: `${response.status}: ${errorText}`,
                    duration
                  }
                : req
            ));
          }
        } catch (error) {
          const endTime = Date.now();
          setRequests(prev => prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'error', 
                  error: error instanceof Error ? error.message : 'Unknown error',
                  duration: endTime - startTime
                }
              : req
          ));
        }
      }

      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isMonitoring]);

  const clearRequests = () => {
    setRequests([]);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  if (!isVisible) return null;

  console.log('🔍 OpenRouterDebugPanel render:', { isVisible, requestsCount: requests.length, isMonitoring });

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 z-[9999] bg-white border-4 border-red-500 rounded-lg shadow-2xl">
      <div className="h-full flex flex-col">
        <div className="bg-blue-500 text-white p-2 rounded-t-lg">
          <div className="flex items-center justify-between">
            <span className="font-bold">OpenRouter Debug Panel</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`px-2 py-1 rounded text-xs ${isMonitoring ? 'bg-green-600' : 'bg-red-600'}`}
              >
                {isMonitoring ? '🟢 Monitor ON' : '🔴 Monitor OFF'}
              </button>
              <button onClick={clearRequests} className="px-2 py-1 bg-gray-600 rounded text-xs">
                🗑️ Clear
              </button>
              <button onClick={onToggle} className="px-2 py-1 bg-gray-600 rounded text-xs">
                ✕
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100">
          {requests.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              {isMonitoring ? 'Ожидание запросов...' : 'Мониторинг отключен'}
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="bg-white border rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono">{request.timestamp.toLocaleTimeString()}</span>
                    <div className="flex gap-1">
                      {request.tokensUsed && <span className="bg-blue-100 px-1 rounded">{request.tokensUsed}t</span>}
                      {request.duration && <span className="bg-green-100 px-1 rounded">{formatDuration(request.duration)}</span>}
                    </div>
                  </div>
                  
                  <div><strong>Модель:</strong> {request.model}</div>
                  
                  <div className="mt-1">
                    <strong>Промпт:</strong>
                    <details className="mt-1">
                      <summary className="cursor-pointer bg-gray-50 p-1 rounded hover:bg-gray-100">
                        Показать полный промпт ({request.prompt.length} символов)
                      </summary>
                      <div className="bg-gray-50 p-2 rounded mt-1 max-h-32 overflow-y-auto border text-xs">
                        <pre className="whitespace-pre-wrap">{request.prompt}</pre>
                      </div>
                    </details>
                  </div>
                  
                  {request.status === 'success' && (
                    <div className="mt-1">
                      <strong>Ответ:</strong>
                      <details className="mt-1">
                        <summary className="cursor-pointer bg-green-50 p-1 rounded hover:bg-green-100">
                          Показать полный ответ ({request.response.length} символов)
                        </summary>
                        <div className="bg-green-50 p-2 rounded mt-1 max-h-32 overflow-y-auto border text-xs">
                          <pre className="whitespace-pre-wrap">{request.response}</pre>
                        </div>
                      </details>
                    </div>
                  )}
                  
                  {request.status === 'error' && (
                    <div className="mt-1">
                      <strong>Ошибка:</strong>
                      <div className="bg-red-50 p-1 rounded mt-1 text-red-600">
                        {request.error}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
