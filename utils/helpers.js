//utils\helpers.js
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const generateRandomString = (length = 10) => {
  return Math.random().toString(36).substring(2, length + 2);
};

module.exports = {
  formatCurrency,
  generateRandomString,
};