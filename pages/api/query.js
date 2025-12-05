import { processNLQuery } from '../../src/lib/gemini.js';
import {
  calculateStatistics,
  findAnomalies,
  filterData,
  groupBy,
  aggregateGroups,
  detectColumnTypes
} from '../../src/lib/dataProcessor.js';
import { detectDateColumns, groupByPeriod, parseDate } from '../../src/lib/dateUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const logs = [];
  const addLog = (message) => {
    logs.push({ timestamp: new Date().toISOString(), message });
    console.log(`[QUERY] ${message}`);
  };

  try {
    addLog('Начало обработки запроса');
    
    const { query, data, columns } = req.body;

    addLog(`Получен запрос: "${query?.substring(0, 50)}..."`);
    addLog(`Данные: ${data?.length || 0} строк, колонок: ${columns?.length || 0}`);

    if (!query || !query.trim()) {
      addLog('ОШИБКА: Запрос пуст');
      return res.status(400).json({ error: 'Query is required', logs });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      addLog('ОШИБКА: Нет данных');
      return res.status(400).json({ error: 'Data is required', logs });
    }

    // Detect column types
    addLog('Определение типов колонок...');
    const columnTypes = detectColumnTypes(data, columns);
    const numericColumns = columns.filter(col => columnTypes[col] === 'number');
    addLog(`Найдено числовых колонок: ${numericColumns.length}`);

    // Detect date columns
    addLog('Определение колонок с датами...');
    const dateColumns = detectDateColumns(data, columns);
    addLog(`Найдено колонок с датами: ${dateColumns.length}`);

    // Get schema from sample data
    const sampleData = data.slice(0, 10);
    const schema = columns;

    // Process query through Gemini
    addLog('Отправка запроса в Gemini API...');
    addLog(`Проверка GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Установлен (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : 'НЕ УСТАНОВЛЕН!'}`);
    
    let geminiResponse;
    try {
      addLog('Вызов processNLQuery...');
      geminiResponse = await processNLQuery(query, schema, sampleData);
      addLog(`✅ Получен ответ от Gemini: type=${geminiResponse?.type || 'undefined'}`);
      addLog(`Ответ Gemini: ${JSON.stringify(geminiResponse).substring(0, 200)}...`);
    } catch (geminiError) {
      addLog(`❌ ОШИБКА Gemini API: ${geminiError.message}`);
      addLog(`Тип ошибки: ${geminiError.constructor.name}`);
      addLog(`Stack: ${geminiError.stack?.substring(0, 500)}`);
      
      // Check if it's an API key issue
      if (geminiError.message.includes('API_KEY') || geminiError.message.includes('api key')) {
        addLog('⚠️ ПРОБЛЕМА: GEMINI_API_KEY не установлен или неверный!');
        addLog('Решение: Добавьте GEMINI_API_KEY в Environment Variables на Vercel');
      }
      
      throw geminiError;
    }

    let result = {
      type: geminiResponse.type || 'text',
      message: geminiResponse.message || 'Запрос обработан',
      description: geminiResponse.description || '',
      table: null,
      chart: null,
      statistics: null
    };

    // Process based on Gemini response type
    addLog(`Обработка типа ответа: ${geminiResponse.type}`);
    
    if (geminiResponse.type === 'statistics') {
      addLog('Вычисление статистики...');
      // Calculate statistics for numeric columns
      const stats = {};
      numericColumns.forEach(col => {
        const stat = calculateStatistics(data, col);
        if (stat) {
          stats[col] = stat;
        }
      });
      addLog(`Вычислена статистика для ${Object.keys(stats).length} колонок`);

      result.statistics = stats;
      result.table = Object.entries(stats).map(([col, stat]) => ({
        column: col,
        mean: stat.mean,
        median: stat.median,
        min: stat.min,
        max: stat.max,
        count: stat.count
      }));

      // Create bar chart for means
      if (Object.keys(stats).length > 0) {
        result.chart = {
          type: 'bar',
          data: Object.entries(stats).map(([col, stat]) => ({
            name: col,
            value: stat.mean
          })),
          xKey: 'name',
          yKey: 'value'
        };
      }
    } else if (geminiResponse.type === 'visualization') {
      // Generate visualization
      const viz = geminiResponse.visualization || {};
      const chartType = viz.chartType || 'line';
      let xAxis = viz.xAxis || columns[0];
      let yAxis = viz.yAxis || numericColumns[0];

      // Если xAxis - это дата, группируем по периоду
      if (dateColumns.includes(xAxis)) {
        const queryLower = query.toLowerCase();
        let period = 'day';
        if (queryLower.includes('год') || queryLower.includes('year')) {
          period = 'year';
        } else if (queryLower.includes('месяц') || queryLower.includes('month')) {
          period = 'month';
        } else if (queryLower.includes('недел') || queryLower.includes('week')) {
          period = 'week';
        }
        
        const grouped = groupByPeriod(data, xAxis, period);
        const aggregated = Object.entries(grouped).map(([key, rows]) => {
          const yValues = rows.map(r => parseFloat(r[yAxis])).filter(v => !isNaN(v));
          const avg = yValues.length > 0 ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0;
          return {
            [xAxis]: key,
            [yAxis]: Math.round(avg * 100) / 100
          };
        }).sort((a, b) => a[xAxis].localeCompare(b[xAxis]));
        
        if (chartType === 'pie') {
          result.chart = {
            type: 'pie',
            data: aggregated.map(item => ({
              name: item[xAxis],
              value: item[yAxis]
            })),
            xKey: xAxis,
            yKey: 'value'
          };
        } else {
          result.chart = {
            type: chartType,
            data: aggregated,
            xKey: xAxis,
            yKey: yAxis
          };
        }
      } else if (chartType === 'pie') {
        // Pie chart: group by xAxis and aggregate yAxis
        const groups = groupBy(data, xAxis);
        const aggregated = aggregateGroups(groups, yAxis, 'sum');
        
        result.chart = {
          type: 'pie',
          data: aggregated.map(item => ({
            name: item.group,
            value: item.value
          })),
          xKey: xAxis,
          yKey: 'value'
        };
      } else if (chartType === 'scatter') {
        // Scatter plot: direct mapping of x and y values
        result.chart = {
          type: 'scatter',
          data: data.slice(0, 100).map(row => ({
            x: parseFloat(row[xAxis]) || 0,
            y: parseFloat(row[yAxis]) || 0
          })).filter(item => !isNaN(item.x) && !isNaN(item.y)),
          xKey: 'x',
          yKey: 'y'
        };
      } else if (chartType === 'line' || chartType === 'bar') {
        // Group by xAxis and aggregate yAxis
        const groups = groupBy(data, xAxis);
        const aggregated = aggregateGroups(groups, yAxis, 'mean');
        
        result.chart = {
          type: chartType,
          data: aggregated.map(item => ({
            [xAxis]: item.group,
            [yAxis]: item.value
          })),
          xKey: xAxis,
          yKey: yAxis
        };
      }
    } else if (geminiResponse.type === 'sql' || geminiResponse.sql) {
      // Simple SQL-like operations (not full SQL parser, but basic operations)
      // For MVP, we'll do basic filtering/grouping based on query intent
      const queryLower = query.toLowerCase();
      
      if (queryLower.includes('аномал') || queryLower.includes('аномаль')) {
        // Find anomalies
        const anomalies = {};
        numericColumns.forEach(col => {
          const anom = findAnomalies(data, col);
          if (anom.length > 0) {
            anomalies[col] = anom;
          }
        });

        result.table = Object.entries(anomalies).flatMap(([col, anom]) =>
          anom.map(a => ({
            column: col,
            row_index: a.index,
            value: a.value,
            deviation: a.deviation
          }))
        );
      } else {
        // Default: return sample of data
        result.table = data.slice(0, 50);
      }
    } else {
      // Text response - return sample data
      result.table = data.slice(0, 20);
    }

    // If no specific visualization but we have numeric data, create default chart
    if (!result.chart && numericColumns.length > 0 && results.table) {
      // Используем данные из таблицы для создания графика
      const tableData = result.table;
      if (tableData && tableData.length > 0) {
        // Берем первую числовую колонку из таблицы
        const numericCol = numericColumns.find(col => 
          tableData[0].hasOwnProperty(col)
        ) || Object.keys(tableData[0]).find(key => 
          !isNaN(parseFloat(tableData[0][key]))
        );
        
        if (numericCol) {
          // Группируем данные для графика
          const chartData = tableData.slice(0, 20).map((row, idx) => {
            const xValue = row[numericCol] !== undefined ? row[numericCol] : idx;
            const yValue = parseFloat(row[numericCol]) || 0;
            return {
              [numericCol]: xValue,
              value: yValue
            };
          });
          
          result.chart = {
            type: 'bar',
            data: chartData,
            xKey: numericCol,
            yKey: 'value'
          };
        }
      }
    } else if (!result.chart && numericColumns.length > 0) {
      // Fallback: создаем график из статистики
      const firstNumeric = numericColumns[0];
      const stats = calculateStatistics(data, firstNumeric);
      if (stats) {
        result.chart = {
          type: 'bar',
          data: [{ name: firstNumeric, value: stats.mean }],
          xKey: 'name',
          yKey: 'value'
        };
      }
    }

    addLog('✅ Запрос успешно обработан');
    return res.status(200).json({
      ...result,
      logs: logs
    });
  } catch (error) {
    console.error('Query processing error:', error);
    addLog(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    addLog(`Тип ошибки: ${error.constructor.name}`);
    addLog(`Stack trace: ${error.stack?.substring(0, 1000)}`);
    
    // Detailed error information
    const errorDetails = {
      message: error.message,
      name: error.name,
      type: error.constructor.name,
      stack: error.stack
    };
    
    // Check for specific error types
    if (error.message.includes('GEMINI_API_KEY')) {
      errorDetails.suggestion = 'Добавьте GEMINI_API_KEY в Environment Variables на Vercel';
      errorDetails.code = 'MISSING_API_KEY';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorDetails.suggestion = 'Проблема с сетевым запросом к Gemini API';
      errorDetails.code = 'NETWORK_ERROR';
    } else if (error.message.includes('JSON') || error.message.includes('parse')) {
      errorDetails.suggestion = 'Ошибка парсинга ответа от Gemini';
      errorDetails.code = 'PARSE_ERROR';
    }
    
    addLog(`Детали ошибки: ${JSON.stringify(errorDetails, null, 2)}`);
    
    return res.status(500).json({
      error: 'Error processing query',
      message: error.message,
      details: errorDetails,
      logs: logs,
      stack: error.stack
    });
  }
}

