import { ApartmentLot, Charge, Expense, IncidentStatus, Resolution, Ballot } from '@/lib/redesign/condo';

/**
 * Calculates Quorum progress and percentage given total lots and attendee lots.
 */
export function calculateQuorum(
  lots: ApartmentLot[],
  attendeeLotNumbers: string[]
): {
  presentTantiemes: number;
  totalTantiemes: number;
  percentage: number;
  meetsThreshold: boolean;
} {
  const totalTantiemes = lots.reduce((sum, lot) => sum + lot.tantiemes, 0);
  const presentTantiemes = lots
    .filter((lot) => attendeeLotNumbers.includes(lot.lotNumber))
    .reduce((sum, lot) => sum + lot.tantiemes, 0);

  const percentage = totalTantiemes > 0 ? (presentTantiemes / totalTantiemes) * 100 : 0;
  const roundedPercentage = Math.round(percentage * 100) / 100;

  return {
    presentTantiemes,
    totalTantiemes,
    percentage: roundedPercentage,
    meetsThreshold: roundedPercentage >= 50,
  };
}

/**
 * Financial metrics: collection rate (recouvrement), total called, total paid, unpaid balance, net treasury.
 */
export function calculateFinancialSummary(
  charges: Charge[],
  expenses: Expense[]
): {
  totalCalled: number;
  totalCollected: number;
  totalUnpaid: number;
  collectionRate: number;
  totalExpenses: number;
  netTreasury: number;
} {
  const totalCalled = charges.reduce((sum, c) => sum + c.calledAmount, 0);
  const totalCollected = charges.reduce((sum, c) => sum + c.paidAmount, 0);
  const totalUnpaid = Math.max(0, totalCalled - totalCollected);
  const collectionRate = totalCalled > 0 ? Math.round((totalCollected / totalCalled) * 100) : 100;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netTreasury = totalCollected - totalExpenses;

  return {
    totalCalled,
    totalCollected,
    totalUnpaid,
    collectionRate,
    totalExpenses,
    netTreasury,
  };
}

/**
 * Incident lifecycle state machine.
 */
export function getNextIncidentStatus(current: IncidentStatus): IncidentStatus {
  switch (current) {
    case 'Signalé':
      return 'Assigné';
    case 'Assigné':
      return 'En cours';
    case 'En cours':
      return 'Résolu';
    case 'Résolu':
      return 'Résolu';
  }
}

/**
 * Currency formatter with clean tabular spacing.
 */
export function formatCurrency(amount: number, currency: string = '€'): string {
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/**
 * Tally resolution votes and determine approval based on required majority percentage.
 */
export function tallyResolution(
  resolution: Resolution,
  ballots: Ballot[],
  totalQuorumTantiemes: number
): {
  pourTantiemes: number;
  contreTantiemes: number;
  abstentionTantiemes: number;
  pourPercentage: number;
  isAdopted: boolean;
} {
  const matchingBallots = ballots.filter((b) => b.resolutionId === resolution.id);
  const pourTantiemes = matchingBallots
    .filter((b) => b.vote === 'POUR')
    .reduce((sum, b) => sum + b.tantiemes, 0);
  const contreTantiemes = matchingBallots
    .filter((b) => b.vote === 'CONTRE')
    .reduce((sum, b) => sum + b.tantiemes, 0);
  const abstentionTantiemes = matchingBallots
    .filter((b) => b.vote === 'ABSTENTION')
    .reduce((sum, b) => sum + b.tantiemes, 0);

  const expressedTantiemes = pourTantiemes + contreTantiemes;
  const pourPercentage =
    expressedTantiemes > 0
      ? Math.round((pourTantiemes / expressedTantiemes) * 1000) / 10
      : 0;

  const isAdopted = pourPercentage >= resolution.requiredMajority;

  return {
    pourTantiemes,
    contreTantiemes,
    abstentionTantiemes,
    pourPercentage,
    isAdopted,
  };
}
