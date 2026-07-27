// helper to format dates from database format (YYYY-MM-DD) to European format (DD.MM.YYYY)
export const formatEuropeanDate = (d?: string): string => {
  if (!d) return 'select date';
  if (d.includes('-')) {
    return d.split('-').reverse().join('.');
  }
  return d;
};
