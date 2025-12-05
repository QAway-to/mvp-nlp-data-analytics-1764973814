import { useState, useEffect } from 'react';
import FileUploader from '../src/components/FileUploader';
import ChatInterface from '../src/components/ChatInterface';
import DataTable from '../src/components/DataTable';
import ChartPanel from '../src/components/ChartPanel';
import sampleData from '../src/mock-data/sample';
import { exportToCSV, exportToExcel, exportToJSON, exportChartToPNG, exportToPDF } from '../src/lib/exportUtils.js';

// Стили для скроллбара (современный вид)
const scrollbarStyles = `
  /* Webkit (Chrome, Safari, Edge) */
  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  *::-webkit-scrollbar-track {
    background: #11162a;
    border-radius: 4px;
  }
  *::-webkit-scrollbar-thumb {
    background: #3b82f6;
    border-radius: 4px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: #2563eb;
  }
  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #3b82f6 #11162a;
  }
`;

const container = {
  fontFamily: 'Inter, sans-serif',
  padding: '16px 20px',
  background: '#0f172a',
  color: '#e2e8f0',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column'
};

const header = {
  marginBottom: 20,
  flexShrink: 0
};

// Верхний ряд: 3 колонки фиксированной высоты
const topRowStyle = (isMobile = false) => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
  gap: 16,
  marginBottom: 16,
  minHeight: 0,
  height: isMobile ? 'auto' : '400px'
});

const section = {
  background: '#1e293b',
  borderRadius: 8,
  padding: 16,
  border: '1px solid rgba(148, 163, 184, 0.1)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden'
};

// Внутренний контейнер для скролла внутри секции
const sectionContent = {
  flex: '1 1 auto',
  overflowY: 'auto',
  overflowX: 'hidden',
  minHeight: 0
};

const info = {
  marginTop: 12,
  padding: 8,
  background: 'rgba(16, 185, 129, 0.08)',
  borderRadius: 6,
  color: '#10b981',
  fontSize: 12
};

const results = {
  marginTop: 32
};

// Функция для форматирования ответа LLM
function formatLLMResponse(text) {
  if (!text) return '';
  
  // Разбиваем на параграфы
  const paragraphs = text.split('\n\n');
  
  return paragraphs.map((para, idx) => {
    const trimmed = para.trim();
    if (!trimmed) return null;
    
    // Заголовки (начинаются с ** или цифры с точкой)
    if (trimmed.match(/^\*\*.*\*\*$/) || trimmed.match(/^\d+\.\s+\*\*/)) {
      return (
        <h3 key={idx} style={{ 
          color: '#f8fafc', 
          fontSize: 18, 
          fontWeight: 600, 
          marginTop: idx > 0 ? 20 : 0,
          marginBottom: 12,
          borderLeft: '3px solid #6366f1',
          paddingLeft: 12
        }}>
          {trimmed.replace(/\*\*/g, '')}
        </h3>
      );
    }
    
    // Списки (начинаются с -, *, или цифры)
    if (trimmed.match(/^[-*•]\s/) || trimmed.match(/^\d+\.\s/)) {
      const items = trimmed.split('\n').filter(line => line.trim());
      return (
        <ul key={idx} style={{ 
          marginTop: idx > 0 ? 16 : 0, 
          marginBottom: 16,
          paddingLeft: 24,
          listStyle: 'none'
        }}>
          {items.map((item, itemIdx) => {
            const cleanItem = item.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '').trim();
            return (
              <li key={itemIdx} style={{ 
                marginBottom: 8,
                position: 'relative',
                paddingLeft: 20
              }}>
                <span style={{ 
                  position: 'absolute',
                  left: 0,
                  color: '#6366f1'
                }}>•</span>
                <span>{cleanItem}</span>
              </li>
            );
          })}
        </ul>
      );
    }
    
    // Выделение жирным текстом
    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    const formatted = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={partIdx} style={{ color: '#f8fafc', fontWeight: 600 }}>
            {part.replace(/\*\*/g, '')}
          </strong>
        );
      }
      return part;
    });
    
    // Код (в обратных кавычках)
    const codeParts = [];
    let currentIndex = 0;
    formatted.forEach((part, partIdx) => {
      if (typeof part === 'string') {
        const codeMatches = part.match(/`([^`]+)`/g);
        if (codeMatches) {
          let lastIndex = 0;
          codeMatches.forEach(match => {
            const matchIndex = part.indexOf(match, lastIndex);
            if (matchIndex > lastIndex) {
              codeParts.push(part.substring(lastIndex, matchIndex));
            }
            codeParts.push(
              <code key={`code-${partIdx}-${currentIndex++}`} style={{
                background: 'rgba(99, 102, 241, 0.2)',
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 13,
                color: '#a78bfa'
              }}>
                {match.replace(/`/g, '')}
              </code>
            );
            lastIndex = matchIndex + match.length;
          });
          if (lastIndex < part.length) {
            codeParts.push(part.substring(lastIndex));
          }
        } else {
          codeParts.push(part);
        }
      } else {
        codeParts.push(part);
      }
    });
    
    return (
      <p key={idx} style={{ 
        marginTop: idx > 0 ? 16 : 0, 
        marginBottom: 0,
        color: 'inherit'
      }}>
        {codeParts.length > 0 ? codeParts : formatted}
      </p>
    );
  }).filter(Boolean);
}

export default function Home() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Загрузка истории запросов из localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('queryHistory');
    if (savedHistory) {
      try {
        setQueryHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading query history:', e);
      }
    }
  }, []);

  // Сохранение истории запросов
  const saveToHistory = (query, result) => {
    const historyItem = {
      id: Date.now(),
      query,
      timestamp: new Date().toISOString(),
      resultType: result?.type || 'text',
      hasChart: !!result?.chart,
      hasTable: !!result?.table
    };
    
    const newHistory = [historyItem, ...queryHistory.slice(0, 19)]; // Последние 20 запросов
    setQueryHistory(newHistory);
    localStorage.setItem('queryHistory', JSON.stringify(newHistory));
  };

  // Повтор запроса из истории
  const repeatQuery = (historyItem) => {
    setQuery(historyItem.query);
    handleQuerySubmit(historyItem.query);
  };

  // Load sample data on mount for demo (only if no data uploaded)
  useEffect(() => {
    const savedData = sessionStorage.getItem('uploadedData');
    if (!savedData && !data) {
      setData({
        rows: sampleData.length,
        columns: Object.keys(sampleData[0] || {}).length,
        sample: sampleData.slice(0, 5),
        columnNames: Object.keys(sampleData[0] || {}),
        data: sampleData
      });
    } else if (savedData) {
      const parsedData = JSON.parse(savedData);
      const columns = JSON.parse(sessionStorage.getItem('uploadedColumns') || '[]');
      setData({
        rows: parsedData.length,
        columns: columns.length,
        sample: parsedData.slice(0, 5),
        columnNames: columns,
        data: parsedData
      });
    }
  }, []);

  const handleDataLoaded = (loadedData) => {
    setData(loadedData);
    if (loadedData.logs && loadedData.logs.length > 0) {
      setLogs(loadedData.logs);
    }
  };

  const handleQuerySubmit = async (q) => {
    if (!q.trim()) return;
    
    // Get data from state or sessionStorage
    let currentData = data?.data;
    let currentColumns = data?.columnNames;

    if (!currentData) {
      const savedData = sessionStorage.getItem('uploadedData');
      if (savedData) {
        currentData = JSON.parse(savedData);
        currentColumns = JSON.parse(sessionStorage.getItem('uploadedColumns') || '[]');
      } else {
        // Use sample data
        currentData = sampleData;
        currentColumns = Object.keys(sampleData[0] || {});
      }
    }

    if (!currentData || currentData.length === 0) {
      setResults({
        type: 'error',
        message: 'Сначала загрузите данные',
        table: null,
        chart: null
      });
      setLogs([{ timestamp: new Date().toISOString(), message: '❌ ОШИБКА: Нет данных для анализа' }]);
      return;
    }
    
    setLoading(true);
    setLogs([{ timestamp: new Date().toISOString(), message: 'Начало обработки запроса...' }]);
    
    try {
      console.log('[Query] Отправка запроса:', q);
      console.log('[Query] Данные:', currentData?.length, 'строк');
      console.log('[Query] Колонки:', currentColumns);
      
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: q,
          data: currentData,
          columns: currentColumns
        })
      });

      console.log('[Query] Ответ получен, статус:', response.status);
      const result = await response.json();
      console.log('[Query] Результат:', result);
      console.log('[Query] Логи из ответа:', result.logs);

      if (!response.ok) {
        console.error('[Query] Ошибка ответа:', result);
        console.error('[Query] Детали ошибки:', result.details);
        console.error('[Query] Stack trace:', result.stack);
        
        // Build detailed error message
        let errorMessage = result.error || result.message || 'Ошибка обработки запроса';
        if (result.details) {
          errorMessage += `\n\nДетали:\n${JSON.stringify(result.details, null, 2)}`;
          if (result.details.suggestion) {
            errorMessage += `\n\n💡 Решение: ${result.details.suggestion}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      setResults(result);
      
      // Сохраняем в историю
      saveToHistory(q, result);
      
      // Show logs if available
      if (result.logs && result.logs.length > 0) {
        setLogs(result.logs);
      }
    } catch (error) {
      console.error('[Query] Ошибка:', error);
      console.error('[Query] Error stack:', error.stack);
      
      const errorMessage = error.message || 'Ошибка обработки запроса';
      
      setResults({
        type: 'error',
        message: errorMessage,
        table: null,
        chart: null,
        logs: logs,
        errorDetails: error.stack
      });
      
      setLogs(prev => [
        ...prev, 
        { 
          timestamp: new Date().toISOString(), 
          message: `❌ ОШИБКА: ${errorMessage}` 
        },
        {
          timestamp: new Date().toISOString(),
          message: `Детали: ${error.stack?.substring(0, 500) || 'Нет дополнительной информации'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={container}>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <header style={header}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 500, color: '#f1f5f9' }}>NLP Data Analytics</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
          Анализ данных через естественный язык
        </p>
      </header>

      {/* Верхний ряд: 3 колонки фиксированной высоты */}
      <div style={topRowStyle(isMobile)}>
        {/* Левая колонка: Загрузка данных */}
        <section style={section}>
          <div style={{ marginBottom: 12, flexShrink: 0, fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>
            Загрузка данных
          </div>
          <div style={sectionContent}>
            <FileUploader onDataLoaded={handleDataLoaded} />
            {data && (
              <>
                <div style={info}>
                  ✅ Загружено: {data.rows} строк, {data.columns} колонок
                </div>
                {data.missingValues && Object.keys(data.missingValues).length > 0 && (
                  <div style={{ marginTop: 12, padding: 8, background: 'rgba(251, 191, 36, 0.08)', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ color: '#fbbf24', fontWeight: 500, marginBottom: 6, fontSize: 11 }}>Пропущенные значения</div>
                    {Object.entries(data.missingValues)
                      .filter(([_, info]) => info.count > 0)
                      .slice(0, 5)
                      .map(([col, info]) => (
                        <div key={col} style={{ color: '#fbbf24', marginBottom: 4, fontSize: 11 }}>
                          {col}: {info.count} ({info.percentage}%)
                        </div>
                      ))}
                    {Object.values(data.missingValues).filter(info => info.count > 0).length > 5 && (
                      <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>
                        ... и ещё {Object.values(data.missingValues).filter(info => info.count > 0).length - 5} колонок
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {!data && (
              <div style={{ marginTop: 12, padding: 8, background: 'rgba(148, 163, 184, 0.05)', borderRadius: 6, fontSize: 11, color: '#64748b' }}>
                Демо режим: используются примерные данные
              </div>
            )}
          </div>
        </section>

        {/* Средняя колонка: Задайте вопрос */}
        <section style={section}>
          <div style={{ marginBottom: 12, flexShrink: 0, fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>
            Запрос
          </div>
          <div style={sectionContent}>
            <ChatInterface 
              query={query}
              onQueryChange={setQuery}
              onQuerySubmit={handleQuerySubmit}
              loading={loading}
            />
            <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
              Примеры: "покажи средние продажи", "создай график тренда"
            </div>
          </div>
        </section>

        {/* Правая колонка: Логи обработки */}
        <section style={section}>
          <div style={{ marginBottom: 12, flexShrink: 0, fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>
            Логи
          </div>
          <div style={sectionContent}>
            {logs.length > 0 ? (
              <div style={{
                fontFamily: 'monospace',
                fontSize: 11
              }}>
                {logs.map((log, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 6, 
                    color: log.message.includes('ОШИБКА') || log.message.includes('❌') ? '#ef4444' : '#64748b',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5
                  }}>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {' '}
                    {log.message}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                Логи появятся после запроса
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Нижний ряд: Результаты анализа (на всю ширину) */}
      {(results && (results.chart || results.table || results.message)) && (
        <section style={{ ...section, marginBottom: 16 }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>
            Результаты
          </div>
          {loading && (
            <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 12 }}>Обработка...</div>
            </div>
          )}
          
          {!loading && results.chart && (
            <div style={{ marginBottom: results.table ? 16 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  onClick={() => exportChartToPNG('chart-container', `chart-${Date.now()}.png`)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                >
                  PNG
                </button>
              </div>
              <div id="chart-container">
                <ChartPanel data={results.chart} />
              </div>
            </div>
          )}
          
          {!loading && results.table && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => exportToCSV(results.table, `data-${Date.now()}.csv`)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                >
                  CSV
                </button>
                <button
                  onClick={() => exportToExcel(results.table, `data-${Date.now()}.xlsx`)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                >
                  Excel
                </button>
                <button
                  onClick={() => exportToJSON(results.table, `data-${Date.now()}.json`)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                >
                  JSON
                </button>
                <button
                  onClick={() => exportToPDF(results.table, 'chart-container', `analysis-${Date.now()}.pdf`)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  PDF
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <DataTable data={results.table} />
              </div>
            </div>
          )}
          
          {!loading && results.message && (
            <div style={{ 
              marginTop: results.chart || results.table ? 16 : 0,
              padding: results.type === 'error' ? 12 : 0,
              background: results.type === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
              borderRadius: 6
            }}>
              <div style={{
                color: results.type === 'error' ? '#ef4444' : '#cbd5e1',
                whiteSpace: 'pre-wrap',
                fontFamily: results.type === 'error' ? 'monospace' : 'inherit',
                fontSize: results.type === 'error' ? 11 : 13,
                lineHeight: 1.6,
                wordBreak: 'break-word'
              }}>
                {formatLLMResponse(results.message)}
              </div>
              {results.type === 'error' && results.errorDetails && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>
                    Детали
                  </summary>
                  <pre style={{
                    marginTop: 8,
                    padding: 10,
                    background: '#0f172a',
                    borderRadius: 4,
                    color: '#ef4444',
                    fontSize: 10,
                    overflow: 'auto',
                    maxHeight: 150
                  }}>
                    {results.errorDetails}
                  </pre>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {/* Нижний ряд: Ответ от LLM (на всю ширину) */}
      {results && results.message && (
        <section style={section}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>💬 Ответ от LLM</h2>
          <div style={{
            color: results.type === 'error' ? '#ef4444' : '#e2e8f0',
            whiteSpace: 'pre-wrap',
            fontFamily: results.type === 'error' ? 'monospace' : 'inherit',
            fontSize: results.type === 'error' ? 12 : 15,
            lineHeight: 1.8,
            wordBreak: 'break-word',
            padding: results.type === 'error' ? 16 : 20,
            background: results.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.05)',
            borderRadius: 12,
            border: results.type === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            {formatLLMResponse(results.message)}
          </div>
          {results.type === 'error' && results.errorDetails && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                Показать технические детали
              </summary>
              <pre style={{
                marginTop: 8,
                padding: 12,
                background: '#11162a',
                borderRadius: 8,
                color: '#ef4444',
                fontSize: 11,
                overflow: 'auto',
                maxHeight: 200
              }}>
                {results.errorDetails}
              </pre>
            </details>
          )}
        </section>
      )}
    </main>
  );
}

