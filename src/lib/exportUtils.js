import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Экспорт таблицы в CSV
 */
export function exportToCSV(data, filename = 'data.csv') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Экспорт таблицы в Excel
 */
export function exportToExcel(data, filename = 'data.xlsx') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

/**
 * Экспорт данных в JSON
 */
export function exportToJSON(data, filename = 'data.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Экспорт графика как PNG изображения
 */
export async function exportChartToPNG(chartElementId, filename = 'chart.png') {
  const element = document.getElementById(chartElementId);
  if (!element) {
    console.error('Chart element not found');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#1e1f33',
      scale: 2,
      logging: false
    });
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error exporting chart to PNG:', error);
  }
}

/**
 * Экспорт результатов анализа в PDF
 */
export async function exportToPDF(data, chartElementId, filename = 'analysis.pdf') {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Заголовок
  pdf.setFontSize(18);
  pdf.text('Результаты анализа данных', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Данные таблицы
  if (data && Array.isArray(data) && data.length > 0) {
    pdf.setFontSize(12);
    pdf.text('Данные:', 10, yPosition);
    yPosition += 10;

    // Простая таблица (первые 20 строк)
    const columns = Object.keys(data[0]);
    const rows = data.slice(0, 20);
    
    // Заголовки
    let xPosition = 10;
    const colWidth = (pageWidth - 20) / columns.length;
    pdf.setFontSize(10);
    columns.forEach((col, idx) => {
      pdf.text(col.substring(0, 15), xPosition + idx * colWidth, yPosition);
    });
    yPosition += 8;

    // Данные
    rows.forEach((row) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      columns.forEach((col, idx) => {
        const value = String(row[col] || '').substring(0, 15);
        pdf.text(value, xPosition + idx * colWidth, yPosition);
      });
      yPosition += 6;
    });
  }

  // График (если есть)
  if (chartElementId) {
    const chartElement = document.getElementById(chartElementId);
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, {
          backgroundColor: '#1e1f33',
          scale: 2
        });
        
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 20;
        }
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error adding chart to PDF:', error);
      }
    }
  }

  pdf.save(filename);
}

