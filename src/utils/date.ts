export const formatDate = (date: Date): string => {
  // Format date in local timezone without UTC conversion to prevent timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (date: Date, period?: 'day' | 'week' | 'month'): string => {
  if (period === 'month') {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } else if (period === 'week') {
    const weekStart = getStartOfWeek(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  // Calculate days to subtract to get to Saturday (day 6)
  // If today is Saturday (6), subtract 0 days
  // If today is Sunday (0), subtract 1 day to get Saturday
  // If today is Monday (1), subtract 2 days to get Saturday, etc.
  const daysToSubtract = day === 6 ? 0 : (day + 1) % 7;
  d.setDate(d.getDate() - daysToSubtract);
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

