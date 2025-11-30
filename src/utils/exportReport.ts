import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { formatCurrency } from './currency';
import { formatDisplayDate, formatDate } from './date';
import { Transaction, ReportPeriod } from '../types';

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
 * Convert Uint8Array to base64 string (React Native compatible)
 */
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
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
    
    const periodLabel = data.period === 'day' ? 'Daily' : data.period === 'week' ? 'Weekly' : 'Monthly';
    const dateLabel = formatDisplayDate(data.date, data.period);
    const reportDate = formatDate(data.date);
    const companyName = data.companyName || 'AgriBooks';
    
    // Build professional HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
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
            font-family: 'Helvetica Neue', Arial, sans-serif;
            padding: 30px;
            color: #333;
            background-color: #fff;
            line-height: 1.5;
          }
          
          /* Header Section */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4CAF50;
          }
          .company-info {
            flex: 1;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #2E7D32;
            margin-bottom: 5px;
          }
          .report-meta {
            font-size: 12px;
            color: #666;
          }
          .report-title-section {
            text-align: right;
          }
          .report-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
          }
          .report-period {
            font-size: 14px;
            color: #4CAF50;
            font-weight: 600;
          }
          
          /* Summary Section */
          h2 {
            color: #2E7D32;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 18px;
            border-bottom: 2px solid #E8F5E9;
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
            background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%);
            border-left: 4px solid #4CAF50;
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
          .summary-value.income { color: #2E7D32; }
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
            text-align: left;
            border-bottom: 1px solid #E0E0E0;
          }
          th {
            background-color: #4CAF50;
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
            background-color: #E8F5E9;
          }
          .text-right {
            text-align: right;
          }
          .income-text { color: #2E7D32; font-weight: 600; }
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
            <div class="report-meta">Financial Report • Generated ${new Date().toLocaleDateString()}</div>
          </div>
          <div class="report-title-section">
            <div class="report-title">${periodLabel} Report</div>
            <div class="report-period">${dateLabel}</div>
          </div>
        </div>
        
        <!-- Summary Section -->
        <h2>Financial Summary</h2>
        <div class="summary-grid">
          <div class="summary-card income">
            <div class="summary-label">Total Income</div>
            <div class="summary-value income">${formatCurrency(data.summary.income, { locale: data.locale })}</div>
          </div>
          <div class="summary-card expense">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value expense">${formatCurrency(data.summary.expense, { locale: data.locale })}</div>
          </div>
          <div class="summary-card balance">
            <div class="summary-label">Net Balance</div>
            <div class="summary-value ${data.summary.balance < 0 ? 'negative' : 'balance'}">
              ${formatCurrency(data.summary.balance, { locale: data.locale })}
            </div>
          </div>
        </div>

        ${data.chartData.labels.length > 0 ? `
        <!-- Period Breakdown -->
        <h2>${data.period === 'week' ? 'Daily' : data.period === 'month' ? 'Weekly' : 'Period'} Breakdown</h2>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>${data.period === 'week' ? 'Day' : data.period === 'month' ? 'Week' : 'Period'}</th>
              <th class="text-right">Income</th>
              <th class="text-right">Expenses</th>
              <th class="text-right">Net</th>
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
        <h2>Transaction Details</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.transactions.map(transaction => {
              const date = new Date(transaction.createdAt).toLocaleDateString();
              const type = transaction.type === 'INCOME' ? 'Income' : 'Expense';
              const category = transaction.category?.name || 'Uncategorized';
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
          <p>${companyName} • ${periodLabel} Financial Report • ${dateLabel}</p>
          <p>Generated by AgriBooks on ${new Date().toLocaleString()}</p>
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
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${periodLabel} Report`,
        UTI: 'com.adobe.pdf',
      });
    } catch (fileError) {
      console.error('Error handling PDF file:', fileError);
      // Try sharing from original location as fallback
      try {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${periodLabel} Report`,
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
 * Export report to Excel format
 * Uses xlsx (SheetJS) for Excel generation
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
    
    const periodLabel = data.period === 'day' ? 'Daily' : data.period === 'week' ? 'Weekly' : 'Monthly';
    const dateLabel = formatDisplayDate(data.date, data.period);
    const reportDate = formatDate(data.date);
    const companyName = data.companyName || 'AgriBooks';
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Summary sheet with company info
    const summaryData = [
      [companyName],
      [`${periodLabel} Financial Report`],
      [`Report Period: ${dateLabel}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [''],
      ['FINANCIAL SUMMARY'],
      [''],
      ['Category', 'Amount'],
      ['Total Income', data.summary.income],
      ['Total Expenses', data.summary.expense],
      ['Net Balance', data.summary.balance],
      [''],
      ['STATISTICS'],
      ['Total Transactions', data.transactions.length],
      ['Income Transactions', data.transactions.filter(t => t.type === 'INCOME').length],
      ['Expense Transactions', data.transactions.filter(t => t.type === 'EXPENSE').length],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for summary sheet
    summarySheet['!cols'] = [
      { wch: 25 },
      { wch: 20 },
    ];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Period Breakdown sheet
    if (data.chartData.labels.length > 0) {
      const breakdownHeaders = [
        data.period === 'week' ? 'Day' : data.period === 'month' ? 'Week' : 'Period',
        'Income',
        'Expenses',
        'Net',
      ];
      const breakdownRows = data.chartData.labels.map((label, index) => {
        const income = data.chartData.incomeData[index] || 0;
        const expense = data.chartData.expenseData[index] || 0;
        return [label, income, expense, income - expense];
      });
      
      // Add totals row
      const totalIncome = data.chartData.incomeData.reduce((sum, val) => sum + (val || 0), 0);
      const totalExpense = data.chartData.expenseData.reduce((sum, val) => sum + (val || 0), 0);
      breakdownRows.push(['TOTAL', totalIncome, totalExpense, totalIncome - totalExpense]);
      
      const breakdownData = [breakdownHeaders, ...breakdownRows];
      const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownData);
      
      // Set column widths
      breakdownSheet['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      
      XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Breakdown');
    }
    
    // Transactions sheet
    if (data.transactions.length > 0) {
      const transactionHeaders = ['Date', 'Type', 'Category', 'Description', 'Amount'];
      const transactionRows = data.transactions.map(transaction => [
        new Date(transaction.createdAt).toLocaleDateString(),
        transaction.type === 'INCOME' ? 'Income' : 'Expense',
        transaction.category?.name || 'Uncategorized',
        transaction.description || '',
        transaction.type === 'INCOME' 
          ? parseFloat(transaction.amount.toString())
          : -parseFloat(transaction.amount.toString()),
      ]);
      const transactionData = [transactionHeaders, ...transactionRows];
      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
      
      // Set column widths
      transactionSheet['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
      ];
      
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }
    
    // Generate Excel file as base64
    let base64Data: string;
    try {
      // Option 1: Try direct base64 output from XLSX (simplest)
      try {
        const wbout = XLSX.write(workbook, { 
          type: 'base64', 
          bookType: 'xlsx',
        });
        base64Data = wbout;
      } catch (base64Error) {
        // Fallback: Use array type and convert to base64 manually
        console.warn('Direct base64 failed, using array conversion:', base64Error);
        const wbout = XLSX.write(workbook, { 
          type: 'array', 
          bookType: 'xlsx',
        });
        base64Data = uint8ArrayToBase64(wbout);
      }
    } catch (writeError) {
      console.error('Error writing Excel workbook:', writeError);
      throw new Error(`Failed to generate Excel file: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`);
    }
    
    // Prepare file path
    const filename = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${periodLabel}_Report_${reportDate.replace(/-/g, '_')}.xlsx`;
    const cacheDir = getCacheDirectory();
    const fileUri = `${cacheDir}${filename}`;
    
    try {
      // Clean up any existing file
      await safeDeleteFile(fileUri);
      
      // Write file using base64 encoding
      // expo-file-system v19: EncodingType enum doesn't exist
      // Try with string 'base64' first, if that fails, the error will be caught below
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: 'base64' as any,
      });
    } catch (fileError) {
      console.error('Error writing Excel file:', fileError);
      throw new Error(`Failed to save Excel file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
    }
    
    // Check if sharing is available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    
    // Share the file
    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Share ${periodLabel} Report`,
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } catch (shareError) {
      console.error('Error sharing Excel file:', shareError);
      throw new Error(`Failed to share Excel file: ${shareError instanceof Error ? shareError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};
