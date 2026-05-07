export const formatUsd = (value: number) => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatBrl = (value: number) => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const convertUsdToBrlValue = (usd: number, usdToBrlRate: number) => {
  return usd * usdToBrlRate;
};

export const formatBrlFromUsd = (usd: number, usdToBrlRate: number) => {
  return formatBrl(convertUsdToBrlValue(usd, usdToBrlRate));
};
