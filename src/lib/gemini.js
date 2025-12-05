import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// Initialize Gemini client - проверка API ключа
// @ai-sdk/google использует GOOGLE_GENERATIVE_AI_API_KEY, но мы поддерживаем GEMINI_API_KEY для совместимости
function validateApiKey() {
  // Проверяем обе переменные для совместимости
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  console.log('[Gemini] Проверка API ключа:', apiKey ? `Установлен (${apiKey.substring(0, 10)}...)` : 'НЕ УСТАНОВЛЕН!');
  console.log('[Gemini] GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'установлен' : 'не установлен');
  console.log('[Gemini] GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'установлен' : 'не установлен');
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY или GOOGLE_GENERATIVE_AI_API_KEY не установлен. Добавьте ключ в Environment Variables на Vercel');
  }
  
  if (apiKey.length < 20) {
    throw new Error('API ключ выглядит неверным (слишком короткий)');
  }
  
  // Устанавливаем GOOGLE_GENERATIVE_AI_API_KEY если используется GEMINI_API_KEY
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
    console.log('[Gemini] Установлен GOOGLE_GENERATIVE_AI_API_KEY из GEMINI_API_KEY');
  }
  
  return apiKey;
}

/**
 * Process natural language query and generate SQL or analysis
 */
export async function processNLQuery(query, dataSchema, sampleData) {
  try {
    console.log('[Gemini] Начало processNLQuery');
    console.log('[Gemini] Query:', query);
    console.log('[Gemini] Schema length:', dataSchema?.length);
    console.log('[Gemini] Sample data length:', sampleData?.length);
    
    // Validate API key
    validateApiKey();
    console.log('[Gemini] API ключ валиден');
    
    // Use gemini-2.5-flash - latest stable model supported by @ai-sdk/google
    const model = google('models/gemini-2.5-flash');
    console.log('[Gemini] Model создан: gemini-2.5-flash (via @ai-sdk/google)');

    const schemaDescription = generateSchemaDescription(dataSchema, sampleData);
    
    const prompt = `Ты - эксперт по анализу данных. Пользователь задал вопрос на естественном языке о данных.

Схема данных:
${schemaDescription}

Вопрос пользователя: "${query}"

Твоя задача:
1. Понять, что хочет пользователь
2. Предложить способ анализа данных
3. Если нужен SQL запрос - сгенерируй его (данные в таблице "data")
4. Если нужна статистика - опиши какие метрики вычислить
5. Если нужна визуализация - опиши тип графика и данные

Верни JSON в формате:
{
  "type": "sql" | "statistics" | "visualization" | "text",
  "sql": "SELECT ..." (если type = "sql"),
  "statistics": ["mean", "median", "count"] (если type = "statistics"),
  "visualization": {
    "chartType": "line" | "bar" | "pie" | "scatter",
    "xAxis": "column_name",
    "yAxis": "column_name"
  },
  Примечание: 
  - "pie" - для категориальных данных (показывает распределение)
  - "scatter" - для корреляций между двумя числовыми колонками
  - "line" - для временных рядов
  - "bar" - для сравнения категорий
  "description": "Описание что будет сделано",
  "message": "Ответ пользователю"
}`;

    console.log('[Gemini] Отправка промпта в модель...');
    console.log('[Gemini] Промпт длина:', prompt.length);
    
    const { text } = await generateText({
      model: model,
      prompt: prompt,
    });
    
    console.log('[Gemini] Ответ получен от модели');
    console.log('[Gemini] Текст ответа длина:', text.length);
    console.log('[Gemini] Текст ответа (первые 500 символов):', text.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('[Gemini] JSON найден в ответе');
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[Gemini] JSON успешно распарсен:', parsed);
        return parsed;
      } catch (parseError) {
        console.error('[Gemini] Ошибка парсинга JSON:', parseError);
        console.error('[Gemini] JSON текст:', jsonMatch[0]);
        throw new Error(`Ошибка парсинга JSON ответа: ${parseError.message}`);
      }
    }

    console.log('[Gemini] JSON не найден, возвращаем текстовый ответ');
    // Fallback if no JSON found
    return {
      type: 'text',
      message: text,
      description: 'Анализ выполнен'
    };
  } catch (error) {
    console.error('[Gemini] КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error('[Gemini] Error name:', error.name);
    console.error('[Gemini] Error message:', error.message);
    console.error('[Gemini] Error stack:', error.stack);
    
    // More detailed error message
    let errorMessage = `Ошибка обработки запроса: ${error.message}`;
    
    if (error.message.includes('API_KEY') || error.message.includes('api key') || error.message.includes('GEMINI_API_KEY')) {
      errorMessage = `GEMINI_API_KEY не установлен или неверный. Добавьте ключ в Environment Variables на Vercel.`;
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      errorMessage = `Превышен лимит запросов к Gemini API. Проверьте квоту.`;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = `Ошибка сети при обращении к Gemini API: ${error.message}`;
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      errorMessage = `Модель не найдена. Проверьте название модели. Используется: gemini-2.5-flash`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Generate data analysis summary
 */
export async function generateDataSummary(data, columns) {
  try {
    validateApiKey();
    
    const model = google('models/gemini-2.5-flash');

    const sampleRows = data.slice(0, 10).map(row => 
      Object.values(row).join(', ')
    ).join('\n');

    const prompt = `Проанализируй данные и дай краткое саммари:

Колонки: ${columns.join(', ')}
Количество строк: ${data.length}

Примеры данных (первые 10 строк):
${sampleRows}

Дай краткое саммари на русском языке (2-3 предложения) о том, что представляют собой эти данные, какие основные паттерны видишь, есть ли аномалии.`;

    const { text } = await generateText({
      model: model,
      prompt: prompt,
    });
    
    return text;
  } catch (error) {
    console.error('Gemini summary error:', error);
    return 'Не удалось сгенерировать саммари данных';
  }
}

/**
 * Generate schema description for prompts
 */
function generateSchemaDescription(schema, sampleData) {
  if (!schema || schema.length === 0) {
    return 'Нет данных';
  }

  let description = 'Колонки:\n';
  schema.forEach(col => {
    const sampleValue = sampleData[0]?.[col] ?? 'N/A';
    description += `- ${col}: пример значения "${sampleValue}"\n`;
  });

  description += `\nВсего строк: ${sampleData.length}`;
  return description;
}
