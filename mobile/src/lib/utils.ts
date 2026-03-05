/**
 * Genetics Cloud — Mobile Utilities
 * Shared utility functions for React Native
 */

/**
 * Format time object to HH:MM string
 */
export const formatTime = (timeObj: any): string => {
  if (!timeObj) return '';
  
  if (typeof timeObj === 'string') {
    return timeObj;
  }

  if (timeObj.hours !== undefined && timeObj.minutes !== undefined) {
    return `${String(timeObj.hours).padStart(2, '0')}:${String(
      timeObj.minutes
    ).padStart(2, '0')}`;
  }

  return '';
};

/**
 * Parse ISO 8601 time string to readable format
 */
export const parseISOTime = (isoString: string): string => {
  if (!isoString) return '';
  
  const time = isoString.split('T')[1]?.split('.')[0];
  return time || '';
};

/**
 * Get day name from index (0 = Monday)
 */
export const getDayName = (dayIndex: number): string => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayIndex] || 'Unknown';
};

/**
 * Calculate utilization color based on percentage
 */
export const getUtilizationColor = (percentage: number): string => {
  if (percentage === 0) return '#E5E7EB'; // Gray (free)
  if (percentage < 30) return '#93C5FD'; // Light blue
  if (percentage < 60) return '#3B82F6'; // Blue
  if (percentage < 80) return '#1D4ED8'; // Dark blue
  return '#1E40AF'; // Very dark blue (over-booked)
};

/**
 * Truncate text to specific length
 */
export const truncate = (text: string, length: number): string => {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj: any): boolean => {
  return (
    obj === null ||
    obj === undefined ||
    (typeof obj === 'object' && Object.keys(obj).length === 0) ||
    (typeof obj === 'string' && obj.trim() === '')
  );
};

/**
 * Format date to readable string
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<any> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};
