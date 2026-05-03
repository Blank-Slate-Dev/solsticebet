// packages/ledger/src/index.ts
//
// @solsticebet/ledger — Double-entry ledger.
//
// ⚠️ RESTRICTED PACKAGE. See docs/ARCHITECTURE.md § 4.3.
// ⚠️ Specification: docs/LEDGER.md
//
// Public API surface:
//   - Types: Account, AccountType, Currency, LedgerEntry, Transaction,
//            ProposedEntry, ProposedTransaction, TransactionType
//   - Money math: parseAmount, formatAmount, formatAmountDisplay,
//                 assertPositive, assertNonNegative, money, SCALE, Money
//   - Validation: assertValidTransaction, assertValidEntry,
//                 LedgerValidationError
//   - Repository: LedgerRepository, InMemoryLedgerRepository,
//                 CreateAccountInput, GetEntriesOptions
//   - Errors: LedgerError, AccountNotFoundError, DuplicateAccountError,
//             InsufficientBalanceError, CurrencyMismatchError
//   - Recipes: recordBetStake, recordBetWin, recordBetLoss, recordBetRefund,
//              recordAdjustment, recordBonusGrant, recordBonusRelease,
//              recordBonusForfeit

export type {
  Account,
  AccountType,
  Currency,
  LedgerEntry,
  ProposedEntry,
  ProposedTransaction,
  Transaction,
  TransactionType,
} from './types.js';
export { ACCOUNT_TYPES, CURRENCIES, TRANSACTION_TYPES, isCurrency } from './types.js';

export {
  assertNonNegative,
  assertPositive,
  formatAmount,
  formatAmountDisplay,
  MAX_AMOUNT_BIGINT,
  money,
  parseAmount,
  SCALE,
  SCALE_FACTOR,
} from './amount.js';
export type { Money } from './amount.js';

export { assertValidEntry, assertValidTransaction, LedgerValidationError } from './validate.js';

export type { CreateAccountInput, GetEntriesOptions, LedgerRepository } from './repository.js';
export {
  AccountNotFoundError,
  CurrencyMismatchError,
  DuplicateAccountError,
  InsufficientBalanceError,
  LedgerError,
} from './repository.js';

export { InMemoryLedgerRepository } from './in-memory.js';

export {
  recordAdjustment,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
  recordBonusForfeit,
  recordBonusGrant,
  recordBonusRelease,
} from './recipes.js';
export type {
  RecordAdjustmentInput,
  RecordBetLossInput,
  RecordBetPartialPayoutInput,
  RecordBetRefundInput,
  RecordBetStakeInput,
  RecordBetWinInput,
  RecordBonusForfeitInput,
  RecordBonusGrantInput,
  RecordBonusReleaseInput,
} from './recipes.js';
