// This is a mock service. In a real-world scenario, you would integrate with a cryptocurrency payment processor or blockchain API.

const validatePayment = async (amount, currency) => {
  // Simulate API call to validate payment
  return new Promise((resolve) => {
    setTimeout(() => {
      const isValid = Math.random() > 0.1; // 90% chance of successful validation
      resolve({
        isValid,
        transactionHash: isValid ? `0x${Math.random().toString(36).substring(2, 15)}` : null,
      });
    }, 1000);
  });
};

const getExchangeRate = async (currency) => {
  // Simulate API call to get exchange rate
  return new Promise((resolve) => {
    setTimeout(() => {
      const rates = {
        BTC: 45000,
        ETH: 3000,
        // Add more currencies as needed
      };
      resolve(rates[currency] || null);
    }, 500);
  });
};

const validateTransaction = async (transactionHash, amount) => {
  // Simulate API call to validate transaction
  return new Promise((resolve) => {
    setTimeout(() => {
      const isValid = Math.random() > 0.1; // 90% chance of successful validation
      resolve({
        isValid,
        amount: isValid ? amount : 0,
      });
    }, 1000);
  });
};

module.exports = {
  validatePayment,
  getExchangeRate,
  validateTransaction,
};