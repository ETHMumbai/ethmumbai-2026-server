const BASE_PRICE = 2499;

function getDiscount(fiat: number) {
  const discountAmount = Math.max(BASE_PRICE - fiat, 0);
  const discountPercentage = Math.round(
    (discountAmount / BASE_PRICE) * 100
  );

  return {
    amount: discountAmount,
    percentage: discountPercentage,
    originalPrice: BASE_PRICE,
  };
}
export { getDiscount };