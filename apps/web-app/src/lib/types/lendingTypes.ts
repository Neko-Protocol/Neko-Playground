/**
 * Lending Service Types
 * Type definitions for lending-related operations
 */

export interface LendingOperationResult {
  xdr: string;
  error?: string;
}

export interface CollateralOperationResult {
  approveXdr: string;
  addCollateralXdr: string;
  error?: string;
}

export interface BorrowWithCollateralResult {
  approveXdr: string;
  addCollateralXdr: string;
  borrowXdr: string;
  error?: string;
}

export interface DepositWithApproveResult {
  approveXdr: string;
  depositXdr: string;
  error?: string;
}
