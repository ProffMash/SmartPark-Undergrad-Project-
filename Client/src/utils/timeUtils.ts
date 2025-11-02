import { parse, format, isValid } from 'date-fns';

/**
 * Format an ISO timestamp using the numeric date/time components as stored in the string
 * without applying timezone conversion. This preserves the hour/min as stored in the DB.
 *
 * If the iso string contains a timezone suffix (Z or ±HH:mm) or fractional seconds,
 * the function extracts the YYYY-MM-DDTHH:mm:ss portion and formats that.
 */
export function formatStoredDate(iso?: string | null, outPattern = 'MMM dd, yyyy HH:mm') {
  if (!iso) return '—';
  // Capture the YYYY-MM-DDTHH:mm:ss part and ignore fractional seconds or timezone suffix
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  const base = m ? m[1] : String(iso);
    try {
      // Parse the ISO string to a Date object (browser auto-converts to local time)
      const dt = new Date(iso);
      if (!isValid(dt)) return '—';
      // Use date-fns format for consistency
      return format(dt, outPattern);
    } catch (e) {
      return '—';
    }
}

export default formatStoredDate;
