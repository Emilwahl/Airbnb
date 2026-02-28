export type TaxInputs = {
  totalRevenue: number;
  ownershipShare: number;
  bundfradrag: number;
  taxRate: number;
};

export type TaxResult = {
  ownerRevenue: number;
  ownerBundfradrag: number;
  taxableBase: number;
  taxDue: number;
  netAfterTax: number;
};

export function calculateTax({
  totalRevenue,
  ownershipShare,
  bundfradrag,
  taxRate,
}: TaxInputs): TaxResult {
  const ownerRevenue = totalRevenue * ownershipShare;
  const ownerBundfradrag = bundfradrag * ownershipShare;
  const taxableBase = Math.max(0, ownerRevenue - ownerBundfradrag) * 0.6;
  const taxDue = taxableBase * taxRate;
  const netAfterTax = ownerRevenue - taxDue;

  return {
    ownerRevenue,
    ownerBundfradrag,
    taxableBase,
    taxDue,
    netAfterTax,
  };
}
