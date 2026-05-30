export function percent(value?: number | null, digits = 1) {
  if (value === undefined || value === null) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function price(value?: number | null) {
  if (value === undefined || value === null) {
    return 'n/a';
  }
  return value.toFixed(5);
}

export function money(value?: number | null) {
  if (value === undefined || value === null) {
    return 'n/a';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

export function dateTime(value?: string | null) {
  if (!value) {
    return 'n/a';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}