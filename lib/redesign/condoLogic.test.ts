import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuorum,
  calculateFinancialSummary,
  getNextIncidentStatus,
  formatCurrency,
  tallyResolution,
} from './condoLogic';
import { ApartmentLot, Charge, Expense, Resolution, Ballot } from '@/lib/redesign/condo';

test('calculateQuorum correctly computes tantièmes and threshold', () => {
  const mockLots: ApartmentLot[] = [
    { id: '1', lotNumber: 'A101', residenceId: 'r1', floor: 1, surfaceM2: 95, tantiemes: 120, occupied: true, ownerName: 'Yassine' },
    { id: '2', lotNumber: 'A102', residenceId: 'r1', floor: 1, surfaceM2: 75, tantiemes: 90, occupied: true, ownerName: 'Ahmed' },
    { id: '3', lotNumber: 'A201', residenceId: 'r1', floor: 2, surfaceM2: 110, tantiemes: 140, occupied: true, ownerName: 'Salma' },
    { id: '4', lotNumber: 'A202', residenceId: 'r1', floor: 2, surfaceM2: 80, tantiemes: 100, occupied: true, ownerName: 'Ahmed' },
  ];

  // Total tantiemes = 120 + 90 + 140 + 100 = 450
  const result1 = calculateQuorum(mockLots, ['A101', 'A201']); // 120 + 140 = 260 -> 260/450 = 57.78%
  assert.equal(result1.presentTantiemes, 260);
  assert.equal(result1.totalTantiemes, 450);
  assert.equal(result1.meetsThreshold, true);

  const result2 = calculateQuorum(mockLots, ['A102']); // 90/450 = 20%
  assert.equal(result2.meetsThreshold, false);
});

test('calculateFinancialSummary computes recovery and net treasury', () => {
  const mockCharges: Charge[] = [
    { id: 'c1', lotNumber: 'A101', period: '2026-01', calledAmount: 150, paidAmount: 150, status: 'Payé', dueDate: '2026-01-20', residenceId: 'r1' },
    { id: 'c2', lotNumber: 'A102', period: '2026-01', calledAmount: 120, paidAmount: 50, status: 'Partiel', dueDate: '2026-01-25', residenceId: 'r1' },
    { id: 'c3', lotNumber: 'A201', period: '2026-01', calledAmount: 140, paidAmount: 0, status: 'En retard', dueDate: '2026-01-20', residenceId: 'r1' },
  ];
  const mockExpenses: Expense[] = [
    { id: 'e1', description: 'Facture STEG', residenceName: 'Résidence Les Jasmins', category: 'ELECTRICITY', amount: 100, date: '2026-01-15' },
  ];

  const summary = calculateFinancialSummary(mockCharges, mockExpenses);
  // Total called: 410, total collected: 200, total unpaid: 210
  assert.equal(summary.totalCalled, 410);
  assert.equal(summary.totalCollected, 200);
  assert.equal(summary.totalUnpaid, 210);
  // Expenses = 100, Net treasury = 200 - 100 = 100
  assert.equal(summary.netTreasury, 100);
});

test('getNextIncidentStatus transitions through lifecycle stages', () => {
  assert.equal(getNextIncidentStatus('Signalé'), 'Assigné');
  assert.equal(getNextIncidentStatus('Assigné'), 'En cours');
  assert.equal(getNextIncidentStatus('En cours'), 'Résolu');
  assert.equal(getNextIncidentStatus('Résolu'), 'Résolu');
});

test('tallyResolution calculates approval against required majority', () => {
  const resolution: Resolution = {
    id: 'res-1',
    meetingId: 'm-1',
    title: 'Approbation des comptes',
    meetingName: 'AG 2026',
    requiredMajority: 50,
    status: 'En attente',
    votesPour: 0,
    votesContre: 0,
    votesAbstention: 0,
  };

  const ballots: Ballot[] = [
    { id: 'b1', resolutionId: 'res-1', resolutionTitle: '', lotNumber: 'A101', vote: 'POUR', tantiemes: 120, date: '2026-01-01' },
    { id: 'b2', resolutionId: 'res-1', resolutionTitle: '', lotNumber: 'A201', vote: 'POUR', tantiemes: 140, date: '2026-01-01' },
    { id: 'b3', resolutionId: 'res-1', resolutionTitle: '', lotNumber: 'A102', vote: 'CONTRE', tantiemes: 90, date: '2026-01-01' },
  ];

  const result = tallyResolution(resolution, ballots, 350);
  // Expressed = 260 pour, 90 contre -> 260/350 = 74.3%
  assert.equal(result.isAdopted, true);
  assert.equal(result.pourTantiemes, 260);
});
