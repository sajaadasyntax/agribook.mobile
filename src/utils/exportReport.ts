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
}

export const exportToPDF = async (data: ExportData): Promise<void> => {
  try {
    const periodLabel = data.period === 'day' ? 'Daily' : data.period === 'week' ? 'Weekly' : 'Monthly';
    const dateLabel = formatDisplayDate(data.date, data.period);
    
    // Build HTML content for PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #4CAF50;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          h2 {
            color: #666;
            margin-top: 25px;
            margin-bottom: 15px;
          }
          .summary {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 8px;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .income { color: #4CAF50; }
          .expense { color: #F44336; }
          .balance { color: #2196F3; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .chart-table {
            margin-top: 20px;
          }
          .chart-table th {
            background-color: #2196F3;
          }
          .positive { color: #4CAF50; }
          .negative { color: #F44336; }
        </style>
      </head>
      <body>
        <h1>${periodLabel} Report - ${dateLabel}</h1>
        
        <h2>Summary</h2>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Income</div>
            <div class="summary-value income">${formatCurrency(data.summary.income, { locale: data.locale })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Expense</div>
            <div class="summary-value expense">${formatCurrency(data.summary.expense, { locale: data.locale })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Balance</div>
            <div class="summary-value balance ${data.summary.balance < 0 ? 'negative' : 'positive'}">
              ${formatCurrency(data.summary.balance, { locale: data.locale })}
            </div>
          </div>
        </div>
    `;

    // Add chart data table
    if (data.chartData.labels.length > 0) {
      htmlContent += `
        <h2>${data.period === 'week' ? 'Daily' : data.period === 'month' ? 'Weekly' : 'Period'} Breakdown</h2>
        <table class="chart-table">
          <thead>
            <tr>
              <th>${data.period === 'week' ? 'Day' : data.period === 'month' ? 'Week' : 'Period'}</th>
              <th>Income</th>
              <th>Expense</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      data.chartData.labels.forEach((label, index) => {
        const income = data.chartData.incomeData[index] || 0;
        const expense = data.chartData.expenseData[index] || 0;
        htmlContent += `
          <tr>
            <td>${label}</td>
            <td class="income">${formatCurrency(income, { locale: data.locale })}</td>
            <td class="expense">${formatCurrency(expense, { locale: data.locale })}</td>
          </tr>
        `;
      });
      
      htmlContent += `
          </tbody>
        </table>
      `;
    }

    // Add transactions table
    if (data.transactions.length > 0) {
      htmlContent += `
        <h2>Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      data.transactions.forEach(transaction => {
        const date = new Date(transaction.createdAt).toLocaleDateString();
        const type = transaction.type === 'INCOME' ? 'Income' : 'Expense';
        const category = transaction.category?.name || 'Uncategorized';
        const description = transaction.description || '-';
        const amount = formatCurrency(parseFloat(transaction.amount.toString()), { locale: data.locale });
        const amountClass = transaction.type === 'INCOME' ? 'income' : 'expense';
        
        htmlContent += `
          <tr>
            <td>${date}</td>
            <td>${type}</td>
            <td>${category}</td>
            <td>${description}</td>
            <td class="${amountClass}">${transaction.type === 'INCOME' ? '+' : '-'}${amount}</td>
          </tr>
        `;
      });
      
      htmlContent += `
          </tbody>
        </table>
      `;
    }

    htmlContent += `
      </body>
      </html>
    `;

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // Share the PDF
    if (await Sharing.isAvailableAsync()) {
      const filename = `report_${data.period}_${formatDate(data.date).replace(/-/g, '_')}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });
      await Sharing.shareAsync(newUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
};

export const exportToExcel = async (data: ExportData): Promise<void> => {
  try {
    const periodLabel = data.period === 'day' ? 'Daily' : data.period === 'week' ? 'Weekly' : 'Monthly';
    const dateLabel = formatDisplayDate(data.date, data.period);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Summary'],
      ['Period', periodLabel],
      ['Date', dateLabel],
      [''],
      ['Income', data.summary.income],
      ['Expense', data.summary.expense],
      ['Balance', data.summary.balance],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Chart data sheet
    if (data.chartData.labels.length > 0) {
      const chartHeaders = [
        data.period === 'week' ? 'Day' : data.period === 'month' ? 'Week' : 'Period',
        'Income',
        'Expense',
      ];
      const chartRows = data.chartData.labels.map((label, index) => [
        label,
        data.chartData.incomeData[index] || 0,
        data.chartData.expenseData[index] || 0,
      ]);
      const chartData = [chartHeaders, ...chartRows];
      const chartSheet = XLSX.utils.aoa_to_sheet(chartData);
      XLSX.utils.book_append_sheet(workbook, chartSheet, 'Breakdown');
    }
    
    // Transactions sheet
    if (data.transactions.length > 0) {
      const transactionHeaders = ['Date', 'Type', 'Category', 'Description', 'Amount'];
      const transactionRows = data.transactions.map(transaction => [
        new Date(transaction.createdAt).toLocaleDateString(),
        transaction.type === 'INCOME' ? 'Income' : 'Expense',
        transaction.category?.name || 'Uncategorized',
        transaction.description || '',
        parseFloat(transaction.amount.toString()),
      ]);
      const transactionData = [transactionHeaders, ...transactionRows];
      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }
    
    // Generate file
    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filename = `report_${data.period}_${formatDate(data.date).replace(/-/g, '_')}.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    
    // Write file
    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};

