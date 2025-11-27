export const formatDate = (date: Date): string => {
  // Format date in local timezone without UTC conversion to prevent timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfWeek = (date: Date): Date => {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addWeeks = (date: Date, weeks: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const finalMonth = ((targetMonth % 12) + 12) % 12; // Handle negative months
  
  // Get the maximum day in the target month
  const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
  // Use the minimum of current day and max days in target month to prevent date drift
  const targetDay = Math.min(d.getDate(), daysInTargetMonth);
  
  d.setFullYear(targetYear);
  d.setMonth(finalMonth);
  d.setDate(targetDay);
  return d;
};

export const getMonthName = (monthIndex: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
};

