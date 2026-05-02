// Pure helpers (no React dependencies)

export const fmt = (n) =>
  '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtShort = (n) => {
  const v = Number(n || 0);
  return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v);
};

export const toMonthly = (amount, freq) => {
  const a = Number(amount || 0);
  if (freq === 'weekly') return (a * 52) / 12;
  if (freq === 'fortnightly') return (a * 26) / 12;
  if (freq === 'annual') return a / 12;
  return a;
};

export const expenseMonthly = (e) =>
  e.freq === 'monthly' ? e.amount : e.freq === 'quarterly' ? e.amount / 3 : e.amount / 12;

export const expenseAnnual = (e) =>
  e.freq === 'monthly' ? e.amount * 12 : e.freq === 'quarterly' ? e.amount * 4 : e.amount;

export const getNextDueDate = (dueDateStr, freq) => {
  if (!dueDateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dueDateStr + 'T00:00:00');
  while (d < today) {
    if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (freq === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (freq === 'weekly') d.setDate(d.getDate() + 7);
    else if (freq === 'fortnightly') d.setDate(d.getDate() + 14);
    else break;
  }
  return d;
};

export const fmtDate = (d) =>
  d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const daysUntil = (d) => {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
};

export const payPeriodEnd = (freq) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(today);
  if (freq === 'weekly') end.setDate(end.getDate() + 7);
  else if (freq === 'fortnightly') end.setDate(end.getDate() + 14);
  else if (freq === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
};

export const progressColor = (pct) =>
  pct >= 70 ? '#4A6B5D' : pct >= 30 ? '#E8A365' : '#C44D42';

export const CATEGORIES = [
  { v: 'Rent', e: '🏠' }, { v: 'Mortgage', e: '🏡' }, { v: 'Utilities', e: '💡' },
  { v: 'Groceries', e: '🛒' }, { v: 'Transport', e: '🚗' }, { v: 'Vehicle Insurance', e: '🛡️' },
  { v: 'Health Insurance', e: '❤️' }, { v: 'Life Insurance', e: '🔒' },
  { v: 'Loan Repayment', e: '💳' }, { v: 'Credit Card', e: '💳' },
  { v: 'Streaming Service', e: '📺' }, { v: 'Subscriptions', e: '📱' },
  { v: 'Phone', e: '📞' }, { v: 'Internet', e: '🌐' }, { v: 'Gym', e: '💪' },
  { v: 'Education', e: '📚' }, { v: 'Savings', e: '💰' },
  { v: 'Entertainment', e: '🎉' }, { v: 'Dining Out', e: '🍽️' }, { v: 'Healthcare', e: '🏥' },
];

export const CATEGORY_EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.v, c.e]));
export const getCategoryEmoji = (cat) => CATEGORY_EMOJI[cat] || '📌';

export const BUCKET_COLOURS = [
  '#D1603D', '#4A6B5D', '#E8A365', '#C44D42',
  '#A8896C', '#7B9B89', '#D9943B', '#8B5A3C',
  '#B5705C', '#5B7C70', '#E5B883', '#9F6B52',
];
