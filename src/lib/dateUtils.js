/**
 * Утилиты для работы с датами
 */

/**
 * Парсинг различных форматов дат
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  
  // Попытка распарсить как ISO дату
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Попытка распарсить форматы типа "YYYY-MM", "YYYY/MM/DD", "DD.MM.YYYY"
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
    /^(\d{4})-(\d{2})$/, // YYYY-MM
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
  ];

  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      if (format === /^(\d{4})-(\d{2})-(\d{2})$/) {
        date = new Date(match[1], match[2] - 1, match[3]);
      } else if (format === /^(\d{4})\/(\d{2})\/(\d{2})$/) {
        date = new Date(match[1], match[2] - 1, match[3]);
      } else if (format === /^(\d{2})\.(\d{2})\.(\d{4})$/) {
        date = new Date(match[3], match[2] - 1, match[1]);
      } else if (format === /^(\d{4})-(\d{2})$/) {
        date = new Date(match[1], match[2] - 1, 1);
      } else if (format === /^(\d{2})\/(\d{2})\/(\d{4})$/) {
        date = new Date(match[3], match[1] - 1, match[2]);
      }
      
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}

/**
 * Определение типа даты (год, месяц, день, час)
 */
export function getDateType(date) {
  if (!date) return null;
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  if (hours !== 0 || minutes !== 0 || seconds !== 0) {
    return 'datetime';
  }
  if (day !== 1) {
    return 'day';
  }
  if (month !== 0) {
    return 'month';
  }
  return 'year';
}

/**
 * Группировка данных по периодам
 */
export function groupByPeriod(data, dateColumn, period = 'day') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {};
  }

  const groups = {};

  data.forEach((row, idx) => {
    const dateValue = row[dateColumn];
    if (!dateValue) return;

    const date = parseDate(dateValue);
    if (!date) return;

    let key;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (period) {
      case 'year':
        key = `${year}`;
        break;
      case 'month':
        key = `${year}-${month}`;
        break;
      case 'week':
        const week = getWeekNumber(date);
        key = `${year}-W${String(week).padStart(2, '0')}`;
        break;
      case 'day':
      default:
        key = `${year}-${month}-${day}`;
        break;
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  });

  return groups;
}

/**
 * Получить номер недели
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Обнаружение колонок с датами в данных
 */
export function detectDateColumns(data, columns) {
  const dateColumns = [];
  
  columns.forEach(col => {
    const sample = data.slice(0, 50).map(row => row[col]).filter(v => v != null && v !== '');
    if (sample.length === 0) return;

    const dateCount = sample.filter(v => {
      const parsed = parseDate(v);
      return parsed !== null;
    }).length;

    // Если больше 70% значений - это даты
    if (dateCount / sample.length > 0.7) {
      dateColumns.push(col);
    }
  });

  return dateColumns;
}

/**
 * Форматирование даты для отображения
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';
  
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return String(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

