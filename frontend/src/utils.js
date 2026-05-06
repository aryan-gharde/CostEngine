export function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function shortMoney(value) {
  const number = Number(value || 0);
  if (number >= 10000000) return `Rs. ${(number / 10000000).toFixed(2)} Cr`;
  if (number >= 100000) return `Rs. ${(number / 100000).toFixed(2)} L`;
  return money(number);
}

export function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

