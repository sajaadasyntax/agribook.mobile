import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatCurrency } from './currency';
import { formatDisplayDate, formatDate } from './date';
import { Transaction } from '../types';
import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';

// Report period type
export type ReportPeriod = 'day' | 'week' | 'month';

// Type for translations
type Translations = typeof enTranslations;

/**
 * Get translations based on locale
 */
const getTranslations = (locale?: string): Translations['reports']['export'] => {
  const isArabic = locale === 'ar';
  const translations = isArabic ? arTranslations : enTranslations;
  return translations.reports.export;
};

/**
 * Get period label based on locale
 */
const getPeriodLabel = (period: ReportPeriod, locale?: string): string => {
  const t = getTranslations(locale);
  if (period === 'day') return t.day;
  if (period === 'week') return t.week;
  return t.period;
};

/**
 * Get period label for report title
 */
const getPeriodTitleLabel = (period: ReportPeriod, locale?: string): string => {
  const isArabic = locale === 'ar';
  const translations = isArabic ? arTranslations : enTranslations;
  if (period === 'day') return translations.reports.daily;
  if (period === 'week') return translations.reports.weekly;
  return translations.reports.monthly;
};

interface ExportData {
  period: ReportPeriod;
  date: Date;
  summary: {
    income: number;
    expense: number;
    balance: number;
  };
  chartData: {
    labels: string[];
    incomeData: number[];
    expenseData: number[];
  };
  transactions: Transaction[];
  locale?: string;
  companyName?: string;
}

/**
 * Get the cache directory for temporary files
 */
const getCacheDirectory = (): string => {
  return FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
};

/**
 * Safely delete a file if it exists
 */
const safeDeleteFile = async (fileUri: string): Promise<void> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    // Ignore errors - file might not exist
    console.log('Safe delete - file may not exist:', error);
  }
};

/**
 * Escape a value for CSV format
 * Handles commas, quotes, and newlines
 */
const escapeCSVValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If the value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Convert array of rows to CSV string
 */
const arrayToCSV = (rows: (string | number | null | undefined)[][]): string => {
  return rows.map(row => row.map(escapeCSVValue).join(',')).join('\n');
};

/**
 * Export report to PDF format
 * Uses expo-print for reliable PDF generation on both iOS and Android
 */
export const exportToPDF = async (data: ExportData): Promise<void> => {
  try {
    // Validate required data
    if (!data || !data.date) {
      throw new Error('Invalid export data: missing date');
    }
    
    if (!data.summary || typeof data.summary.income !== 'number' || typeof data.summary.expense !== 'number') {
      throw new Error('Invalid export data: missing or invalid summary');
    }
    
    if (!data.chartData || !Array.isArray(data.chartData.labels)) {
      throw new Error('Invalid export data: missing or invalid chart data');
    }
    
    if (!data.transactions || !Array.isArray(data.transactions)) {
      throw new Error('Invalid export data: missing or invalid transactions');
    }
    
    const isArabic = data.locale === 'ar';
    const t = getTranslations(data.locale);
    const periodLabel = getPeriodTitleLabel(data.period, data.locale);
    const dateLabel = formatDisplayDate(data.date, data.period);
    const reportDate = formatDate(data.date);
    const companyName = data.companyName || (isArabic ? 'حساباتي' : 'AgriBooks');
    const dir = isArabic ? 'rtl' : 'ltr';
    const textAlign = isArabic ? 'right' : 'left';
    const fontFamily = isArabic ? "'Arial', 'Tahoma', sans-serif" : "'Helvetica Neue', Arial, sans-serif";
    
    // Build professional HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${dir}" lang="${data.locale || 'en'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: ${fontFamily};
            padding: 30px;
            color: #333;
            background-color: #fff;
            line-height: 1.5;
            direction: ${dir};
            text-align: ${textAlign};
          }
          
          /* Header Section */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #DD1C31;
          }
          .company-info {
            flex: 1;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #DD1C31;
            margin-bottom: 5px;
          }
          .report-meta {
            font-size: 12px;
            color: #666;
          }
          .report-title-section {
            text-align: ${isArabic ? 'left' : 'right'};
          }
          .report-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
          }
          .report-period {
            font-size: 14px;
            color: #DD1C31;
            font-weight: 600;
          }
          
          /* Summary Section */
          h2 {
            color: #DD1C31;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 18px;
            border-bottom: 2px solid #FDE8EA;
            padding-bottom: 8px;
          }
          .summary-grid {
            display: flex;
            gap: 15px;
            margin: 20px 0;
          }
          .summary-card {
            flex: 1;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
          }
          .summary-card.income {
            background: linear-gradient(135deg, #FDE8EA 0%, #F5A3AC 100%);
            border-left: 4px solid #DD1C31;
          }
          .summary-card.expense {
            background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
            border-left: 4px solid #F44336;
          }
          .summary-card.balance {
            background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
            border-left: 4px solid #2196F3;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .summary-value {
            font-size: 24px;
            font-weight: bold;
          }
          .summary-value.income { color: #DD1C31; }
          .summary-value.expense { color: #C62828; }
          .summary-value.balance { color: #1565C0; }
          .summary-value.negative { color: #C62828; }
          
          /* Table Styles */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 13px;
          }
          th, td {
            padding: 12px 10px;
            text-align: ${textAlign};
            border-bottom: 1px solid #E0E0E0;
          }
          th {
            background-color: #DD1C31;
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) {
            background-color: #F5F5F5;
          }
          tr:hover {
            background-color: #FDE8EA;
          }
          .text-right {
            text-align: ${isArabic ? 'left' : 'right'};
          }
          .income-text { color: #DD1C31; font-weight: 600; }
          .expense-text { color: #C62828; font-weight: 600; }
          
          /* Breakdown Table */
          .breakdown-table th {
            background-color: #1976D2;
          }
          .breakdown-table tr:hover {
            background-color: #E3F2FD;
          }
          
          /* Footer */
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E0E0E0;
            text-align: center;
            font-size: 11px;
            color: #999;
          }
          
          /* Print optimization */
          @media print {
            body { padding: 20px; }
            .summary-card { break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${companyName}</div>
            <div class="report-meta">${t.financialReport} • ${t.generated} ${new Date().toLocaleDateString(data.locale || 'en-US')}</div>
          </div>
          <div class="report-title-section">
            <div class="report-title">${periodLabel} ${t.financialReport}</div>
            <div class="report-period">${dateLabel}</div>
          </div>
        </div>
        
        <!-- Summary Section -->
        <h2>${t.financialSummary}</h2>
        <div class="summary-grid">
          <div class="summary-card income">
            <div class="summary-label">${t.totalIncome}</div>
            <div class="summary-value income">${formatCurrency(data.summary.income, { locale: data.locale })}</div>
          </div>
          <div class="summary-card expense">
            <div class="summary-label">${t.totalExpenses}</div>
            <div class="summary-value expense">${formatCurrency(data.summary.expense, { locale: data.locale })}</div>
          </div>
          <div class="summary-card balance">
            <div class="summary-label">${t.netBalance}</div>
            <div class="summary-value ${data.summary.balance < 0 ? 'negative' : 'balance'}">
              ${formatCurrency(data.summary.balance, { locale: data.locale })}
            </div>
          </div>
        </div>

        ${data.chartData.labels.length > 0 ? `
        <!-- Period Breakdown -->
        <h2>${data.period === 'week' ? t.dailyBreakdown : data.period === 'month' ? t.weeklyBreakdown : t.periodBreakdown}</h2>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>${data.period === 'week' ? t.day : data.period === 'month' ? t.week : t.period}</th>
              <th class="text-right">${t.income}</th>
              <th class="text-right">${t.expense}</th>
              <th class="text-right">${t.net}</th>
            </tr>
          </thead>
          <tbody>
            ${data.chartData.labels.map((label, index) => {
              const income = data.chartData.incomeData[index] || 0;
              const expense = data.chartData.expenseData[index] || 0;
              const net = income - expense;
              return `
                <tr>
                  <td>${label}</td>
                  <td class="text-right income-text">${formatCurrency(income, { locale: data.locale })}</td>
                  <td class="text-right expense-text">${formatCurrency(expense, { locale: data.locale })}</td>
                  <td class="text-right ${net >= 0 ? 'income-text' : 'expense-text'}">${formatCurrency(net, { locale: data.locale })}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ` : ''}

        ${data.transactions.length > 0 ? `
        <!-- Transactions -->
        <h2>${t.transactionDetails}</h2>
        <table>
          <thead>
            <tr>
              <th>${t.date}</th>
              <th>${t.type}</th>
              <th>${t.category}</th>
              <th>${t.description}</th>
              <th class="text-right">${t.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${data.transactions.map(transaction => {
              const date = new Date(transaction.createdAt).toLocaleDateString(data.locale || 'en-US');
              const type = transaction.type === 'INCOME' ? t.income : t.expense;
              const category = transaction.category?.name || t.uncategorized;
              const description = transaction.description || '-';
              const amount = formatCurrency(parseFloat(transaction.amount.toString()), { locale: data.locale });
              const amountClass = transaction.type === 'INCOME' ? 'income-text' : 'expense-text';
              
              return `
                <tr>
                  <td>${date}</td>
                  <td>${type}</td>
                  <td>${category}</td>
                  <td>${description}</td>
                  <td class="text-right ${amountClass}">${transaction.type === 'INCOME' ? '+' : '-'}${amount}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ` : ''}
        
        <!-- Footer -->
        <div class="footer">
          <p>${companyName} • ${periodLabel} ${t.financialReport} • ${dateLabel}</p>
          <p>${t.generatedBy} ${new Date().toLocaleString(data.locale || 'en-US')}</p>
        </div>
      </body>
      </html>
    `;

    // Generate PDF using expo-print
    let pdfUri: string;
    try {
      const result = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false,
        width: 612,  // Letter size width in points
        height: 792, // Letter size height in points
      });
      pdfUri = result.uri;
    } catch (printError) {
      console.error('Error generating PDF:', printError);
      throw new Error(`Failed to generate PDF: ${printError instanceof Error ? printError.message : 'Unknown error'}`);
    }
    
    // Check if sharing is available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    
    // Prepare final file path with proper naming
    const filename = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${periodLabel}_Report_${reportDate.replace(/-/g, '_')}.pdf`;
    const cacheDir = getCacheDirectory();
    const finalUri = `${cacheDir}${filename}`;
    
    try {
      // Clean up any existing file
      await safeDeleteFile(finalUri);
      
      // Move PDF to final location
      await FileSystem.moveAsync({
        from: pdfUri,
        to: finalUri,
      });
      
      // Share the PDF
      const shareTitle = isArabic ? `مشاركة تقرير ${periodLabel}` : `Share ${periodLabel} Report`;
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: shareTitle,
        UTI: 'com.adobe.pdf',
      });
    } catch (fileError) {
      console.error('Error handling PDF file:', fileError);
      // Try sharing from original location as fallback
      try {
        const shareTitle = isArabic ? `مشاركة تقرير ${periodLabel}` : `Share ${periodLabel} Report`;
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: shareTitle,
        });
      } catch (fallbackError) {
        throw new Error(`Failed to share PDF: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
};

/**
 * Export report to CSV format
 * Uses native file system for reliable CSV generation
 */
export const exportToExcel = async (data: ExportData): Promise<void> => {
  try {
    // Validate required data
    if (!data || !data.date) {
      throw new Error('Invalid export data: missing date');
    }
    
    if (!data.summary || typeof data.summary.income !== 'number' || typeof data.summary.expense !== 'number') {
      throw new Error('Invalid export data: missing or invalid summary');
    }
    
    if (!data.chartData || !Array.isArray(data.chartData.labels)) {
      throw new Error('Invalid export data: missing or invalid chart data');
    }
    
    if (!data.transactions || !Array.isArray(data.transactions)) {
      throw new Error('Invalid export data: missing or invalid transactions');
    }
    
    const isArabic = data.locale === 'ar';
    const translations = isArabic ? arTranslations : enTranslations;
    const t = getTranslations(data.locale);
    const periodLabel = getPeriodTitleLabel(data.period, data.locale);
    const dateLabel = formatDisplayDate(data.date, data.period);
    const reportDate = formatDate(data.date);
    const companyName = data.companyName || translations.app.name;
    
    // Build CSV content with all data in a single file
    const rows: (string | number | null | undefined)[][] = [];
    
    // Header section
    rows.push([companyName]);
    rows.push([`${periodLabel} ${t.financialReport}`]);
    rows.push([`${t.reportPeriod}: ${dateLabel}`]);
    rows.push([`${t.generated}: ${new Date().toLocaleString(data.locale || 'en-US')}`]);
    rows.push([]);
    
    // Summary section
    rows.push([t.financialSummary.toUpperCase()]);
    rows.push([]);
    rows.push([t.category, t.amount]);
    rows.push([t.totalIncome, data.summary.income]);
    rows.push([t.totalExpenses, data.summary.expense]);
    rows.push([t.netBalance, data.summary.balance]);
    rows.push([]);
    
    // Statistics
    rows.push([t.statistics]);
    rows.push([t.totalTransactions, data.transactions.length]);
    rows.push([t.incomeTransactions, data.transactions.filter(tr => tr.type === 'INCOME').length]);
    rows.push([t.expenseTransactions, data.transactions.filter(tr => tr.type === 'EXPENSE').length]);
    rows.push([]);
    
    // Period Breakdown
    if (data.chartData.labels.length > 0) {
      const breakdownTitle = data.period === 'week' ? t.dailyBreakdown : data.period === 'month' ? t.weeklyBreakdown : t.periodBreakdown;
      rows.push([breakdownTitle]);
      rows.push([
        data.period === 'week' ? t.day : data.period === 'month' ? t.week : t.period,
        t.income,
        t.expense,
        t.net,
      ]);
      
      data.chartData.labels.forEach((label, index) => {
        const income = data.chartData.incomeData[index] || 0;
        const expense = data.chartData.expenseData[index] || 0;
        rows.push([label, income, expense, income - expense]);
      });
      
      // Add totals row
      const totalIncome = data.chartData.incomeData.reduce((sum, val) => sum + (val || 0), 0);
      const totalExpense = data.chartData.expenseData.reduce((sum, val) => sum + (val || 0), 0);
      const totalLabel = isArabic ? 'الإجمالي' : 'TOTAL';
      rows.push([totalLabel, totalIncome, totalExpense, totalIncome - totalExpense]);
      rows.push([]);
    }
    
    // Transactions section
    if (data.transactions.length > 0) {
      rows.push([t.transactionDetails]);
      rows.push([t.date, t.type, t.category, t.description, t.amount]);
      
      data.transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount.toString());
        rows.push([
          new Date(transaction.createdAt).toLocaleDateString(data.locale || 'en-US'),
          transaction.type === 'INCOME' ? t.income : t.expense,
          transaction.category?.name || t.uncategorized,
          transaction.description || '',
          transaction.type === 'INCOME' ? amount : -amount,
        ]);
      });
    }
    
    // Convert to CSV string
    // Add BOM for Excel to recognize UTF-8 encoding (important for Arabic)
    const BOM = '\uFEFF';
    const csvContent = BOM + arrayToCSV(rows);
    
    // Prepare file path
    const filename = `${companyName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}_${periodLabel.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}_Report_${reportDate.replace(/-/g, '_')}.csv`;
    const cacheDir = getCacheDirectory();
    const fileUri = `${cacheDir}${filename}`;
    
    try {
      // Clean up any existing file
      await safeDeleteFile(fileUri);
      
      // Write CSV file as UTF-8 string
      // Note: writeAsStringAsync defaults to UTF-8 encoding
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
    } catch (fileError) {
      console.error('Error writing CSV file:', fileError);
      throw new Error(`Failed to save CSV file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
    }
    
    // Check if sharing is available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    
    // Share the file
    try {
      const shareTitle = isArabic ? `مشاركة تقرير ${periodLabel}` : `Share ${periodLabel} Report`;
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: shareTitle,
        UTI: 'public.comma-separated-values-text',
      });
    } catch (shareError) {
      console.error('Error sharing CSV file:', shareError);
      throw new Error(`Failed to share CSV file: ${shareError instanceof Error ? shareError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw error;
  }
};
