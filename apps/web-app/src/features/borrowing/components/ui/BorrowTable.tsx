import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Button,
  Modal,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Info } from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useBorrowPools } from "@/features/borrowing/hooks/useBorrowPools";
import { useWallet } from "../../../../hooks/useWallet";
import {
  approveToken,
  addCollateral,
  borrowFromPool,
} from "@/lib/helpers/stellar/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { rpcUrl } from "@/lib/constants/network";
import { rpc } from "@stellar/stellar-sdk";
import { networks } from "@neko/lending";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";

interface AssetData {
  id: string;
  pool: {
    token1: string;
    token2: string;
    fee: string;
  };
  borrowApr: string; // Annual interest rate for borrowing
  collateralFactorDisplay: string; // Collateral factor as percentage
  liquidity: string;
  isActive: boolean;
  assetCode: string;
  collateralTokenCode: string;
  collateralFactor: number;
}

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#083dffff",
    },
    background: {
      default: "#ffffff",
      paper: "#f9fafb",
    },
    text: {
      primary: "#081F5C",
      secondary: "#7096D1",
    },
  },
});

const BorrowTable: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get wallet
  const { address, signTransaction, networkPassphrase } = useWallet();

  // Get real borrow pools from contract
  const {
    data: borrowPools = [],
    isLoading: isLoadingPools,
    error: poolsError,
  } = useBorrowPools();

  // Removed infinite console logs

  // Calculate borrow limit based on collateral
  const borrowLimit = useMemo(() => {
    if (
      !selectedAsset ||
      !collateralAmount ||
      isNaN(parseFloat(collateralAmount))
    ) {
      return 0;
    }
    const collateralValue = parseFloat(collateralAmount);
    // Simplified: assumes 1:1 value for demo.

    return collateralValue * (selectedAsset.collateralFactor / 100);
  }, [selectedAsset, collateralAmount]);

  // Convert borrow pools to AssetData format
  const assets: AssetData[] = useMemo(() => {
    return borrowPools.map((pool, index) => {
      // Format liquidity
      const balanceNum = parseFloat(pool.poolBalance);
      const liquidity =
        balanceNum >= 1000
          ? `$${(balanceNum / 1000).toFixed(2)}k`
          : balanceNum >= 1000000
            ? `$${(balanceNum / 1000000).toFixed(2)}M`
            : `$${balanceNum.toFixed(2)}`;

      return {
        id: `borrow-${index}`,
        pool: {
          token1: pool.assetCode,
          token2: pool.collateralTokenCode,
          fee: `${pool.collateralFactor}%`,
        },
        borrowApr: `${pool.interestRate.toFixed(2)}%`, // Borrow interest rate
        collateralFactorDisplay: `${pool.collateralFactor}%`, // Max LTV
        liquidity,
        isActive: pool.isActive,
        assetCode: pool.assetCode,
        collateralTokenCode: pool.collateralTokenCode,
        collateralFactor: pool.collateralFactor,
      };
    });
  }, [borrowPools]);

  const handleBorrowClick = (asset: AssetData) => {
    setSelectedAsset(asset);
    setCollateralAmount("");
    setBorrowAmount("");
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAsset(null);
    setCollateralAmount("");
    setBorrowAmount("");
    setError(null);
    setSuccess(null);
  };

  const handleBorrow = async () => {
    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!selectedAsset) {
      setError("No asset selected");
      return;
    }

    const collateralNum = parseFloat(collateralAmount);
    const borrowNum = parseFloat(borrowAmount);

    if (isNaN(collateralNum) || collateralNum <= 0) {
      setError("Please enter a valid collateral amount");
      return;
    }

    if (isNaN(borrowNum) || borrowNum <= 0) {
      setError("Please enter a valid borrow amount");
      return;
    }

    if (borrowNum > borrowLimit) {
      setError(
        `Borrow amount exceeds your limit of ${borrowLimit.toFixed(2)} ${selectedAsset.assetCode}`
      );
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
      const availableTokens = getAvailableTokens();
      const collateralToken =
        availableTokens[selectedAsset.collateralTokenCode];
      const lendingContractId = networks.testnet.contractId;

      if (!collateralToken?.contract) {
        throw new Error(
          `Collateral token ${selectedAsset.collateralTokenCode} not found`
        );
      }

      console.log("Step 1: Approving collateral token...");
      const approveXdr = await approveToken(
        collateralToken.contract,
        lendingContractId,
        collateralAmount,
        collateralToken.decimals || 7,
        address
      );

      // Sign approve transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedApprove = await signTransaction(approveXdr as any, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        address: address,
      });
      const approveTx = TransactionBuilder.fromXDR(
        signedApprove.signedTxXdr,
        networkPassphrase || Networks.TESTNET
      );
      const approveResult = await sorobanServer.sendTransaction(approveTx);
      console.log("Approve result:", approveResult);
      console.log("Approve result status:", approveResult.status);
      console.log("Approve result hash:", approveResult.hash);

      // Wait for approve to complete
      if (approveResult.status === "PENDING") {
        console.log("Waiting for approve transaction to complete...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.log("Approve transaction completed immediately");
      }

      console.log("Step 2: Adding collateral...");
      const addCollateralXdr = await addCollateral(
        collateralToken.contract,
        collateralAmount,
        collateralToken.decimals || 7,
        address
      );

      // Sign add_collateral transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedAddCollateral = await signTransaction(
        addCollateralXdr as any,
        {
          networkPassphrase: networkPassphrase || Networks.TESTNET,
          address: address,
        }
      );
      const addCollateralTx = TransactionBuilder.fromXDR(
        signedAddCollateral.signedTxXdr,
        networkPassphrase || Networks.TESTNET
      );
      const addCollateralResult =
        await sorobanServer.sendTransaction(addCollateralTx);
      console.log("Add collateral result:", addCollateralResult);
      console.log("Add collateral result status:", addCollateralResult.status);
      console.log("Add collateral result hash:", addCollateralResult.hash);

      // Wait for add_collateral to complete
      if (addCollateralResult.status === "PENDING") {
        console.log("Waiting for add collateral transaction to complete...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.log("Add collateral transaction completed immediately");
      }

      console.log("Step 3: Borrowing...");
      console.log(
        "Borrow parameters - Asset:",
        selectedAsset.assetCode,
        "Amount:",
        borrowAmount,
        "Collateral:",
        collateralAmount
      );

      const borrowXdr = await borrowFromPool(
        selectedAsset.assetCode,
        borrowAmount,
        7, // USDC/XLM decimals
        address
      );

      // Sign borrow transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedBorrow = await signTransaction(borrowXdr as any, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        address: address,
      });
      const borrowTx = TransactionBuilder.fromXDR(
        signedBorrow.signedTxXdr,
        networkPassphrase || Networks.TESTNET
      );
      const borrowResult = await sorobanServer.sendTransaction(borrowTx);
      console.log("Borrow result:", borrowResult);

      setSuccess(
        `Successfully borrowed ${borrowNum} ${selectedAsset.assetCode} using ${collateralNum} ${selectedAsset.collateralTokenCode} as collateral`
      );
      setCollateralAmount("");
      setBorrowAmount("");
    } catch (err) {
      const friendlyError = extractContractErrorOrNull(err);
      // Only show error if it's not a user cancellation
      if (friendlyError) {
        // Ensure we always pass a string to setError
        const errorMessage =
          typeof friendlyError === "string"
            ? friendlyError
            : "An unexpected error occurred. Please try again.";
        setError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <Box sx={{ width: "100%", px: 3 }}>
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            border: "1px solid rgba(51, 78, 172, 0.2)",
          }}
        >
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow
                sx={{
                  "& th": {
                    backgroundColor: "#f3f4f6",
                    color: "#081F5C",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    borderBottom: "1px solid rgba(51, 78, 172, 0.2)",
                    py: 2,
                  },
                }}
              >
                <TableCell>ID</TableCell>
                <TableCell>POOL</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    BORROW APR
                    <Tooltip title="Annual interest rate you pay when borrowing">
                      <IconButton size="small" sx={{ p: 0 }}>
                        <Info sx={{ fontSize: 16, color: "#081F5C" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    COLLATERAL
                    <Tooltip title="Maximum percentage of collateral value you can borrow">
                      <IconButton size="small" sx={{ p: 0 }}>
                        <Info sx={{ fontSize: 16, color: "#081F5C" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    LIQUIDITY
                    <Tooltip title="Total liquidity in pool">
                      <IconButton size="small" sx={{ p: 0 }}>
                        <Info sx={{ fontSize: 16, color: "#081F5C" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoadingPools ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: "#7096D1" }}>
                      Loading borrow pools...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : poolsError ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: "#dc2626" }}>
                      Error loading borrow pools: {String(poolsError)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: "#7096D1" }}>
                      No active borrow pools available
                    </Typography>
                    <Typography
                      sx={{ color: "#7096D1", fontSize: "0.875rem", mt: 1 }}
                    >
                      {borrowPools.length === 0
                        ? "No pools found in contract"
                        : `${borrowPools.length} pool(s) found but filtered out`}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    sx={{
                      "&:hover": {
                        backgroundColor: "rgba(51, 78, 172, 0.1)",
                      },
                      "& td": {
                        borderBottom: "1px solid rgba(51, 78, 172, 0.2)",
                        py: 2.5,
                      },
                    }}
                  >
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: asset.isActive
                              ? "#028733ff"
                              : "#6b7280",
                          }}
                        />
                        <Typography
                          sx={{
                            color: asset.isActive ? "#028733ff" : "#7096D1",
                            fontWeight: 500,
                          }}
                        >
                          {asset.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{ position: "relative", width: 40, height: 24 }}
                        >
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              position: "absolute",
                              left: 0,
                              border: "2px solid #ffffff",
                              backgroundColor: "#334EAC",
                            }}
                          />
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              position: "absolute",
                              left: 16,
                              border: "2px solid #ffffff",
                              backgroundColor: "#7096D1",
                            }}
                          />
                        </Box>
                        <Box>
                          <Typography
                            sx={{ color: "#081F5C", fontWeight: 500 }}
                          >
                            {asset.pool.token1} / {asset.pool.token2}
                          </Typography>
                          <Chip
                            label={asset.pool.fee}
                            size="small"
                            sx={{
                              backgroundColor: "rgba(51, 78, 172, 0.1)",
                              color: "#081F5C",
                              fontWeight: 600,
                              height: 20,
                              fontSize: "0.7rem",
                            }}
                          />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#081F5C" }}>
                        {asset.borrowApr}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#081F5C" }}>
                        {asset.collateralFactorDisplay}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#081F5C" }}>
                        {asset.liquidity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleBorrowClick(asset)}
                        variant="contained"
                        sx={{
                          backgroundColor: "#081F5C",
                          color: "#ffffff",
                          borderRadius: "12px",
                          px: 3,
                          py: 1,
                          textTransform: "none",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          "&:hover": {
                            backgroundColor: "#334EAC",
                          },
                        }}
                      >
                        Borrow
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Modal */}
        <Modal
          open={isModalOpen}
          onClose={handleCloseModal}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              maxWidth: "500px",
              width: "90%",
              p: 4,
              outline: "none",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 3,
              }}
            >
              <Typography
                variant="h5"
                sx={{ color: "#081F5C", fontWeight: 700 }}
              >
                Borrow {selectedAsset?.assetCode}
              </Typography>
              <IconButton
                onClick={handleCloseModal}
                sx={{
                  color: "#7096D1",
                  "&:hover": {
                    color: "#081F5C",
                    backgroundColor: "rgba(51, 78, 172, 0.1)",
                  },
                }}
              >
                <Typography sx={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  ×
                </Typography>
              </IconButton>
            </Box>

            {/* Error/Success Messages */}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}
            {success && (
              <Alert
                severity="success"
                sx={{ mb: 2 }}
                onClose={() => setSuccess(null)}
              >
                {success}
              </Alert>
            )}

            {/* Collateral Info */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
              }}
            >
              <Typography
                sx={{ color: "#7096D1", fontSize: "0.875rem", mb: 1 }}
              >
                Collateral Token
              </Typography>
              <Typography
                sx={{ color: "#081F5C", fontWeight: 600, fontSize: "1.25rem" }}
              >
                {selectedAsset?.collateralTokenCode}
              </Typography>
              <Typography
                sx={{ color: "#7096D1", fontSize: "0.75rem", mt: 0.5 }}
              >
                Collateral Factor: {selectedAsset?.collateralFactor}%
              </Typography>
            </Box>

            {/* Collateral Amount Input */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ color: "#081F5C", fontWeight: 600, mb: 1 }}>
                Collateral Amount ({selectedAsset?.collateralTokenCode})
              </Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="0.00"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                disabled={isProcessing}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#f9fafb",
                  },
                }}
              />
            </Box>

            {/* Borrow Limit */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                backgroundColor: "#e0f2fe",
                borderRadius: "12px",
              }}
            >
              <Typography sx={{ color: "#0369a1", fontSize: "0.875rem" }}>
                Your Borrow Limit
              </Typography>
              <Typography
                sx={{ color: "#0c4a6e", fontWeight: 700, fontSize: "1.5rem" }}
              >
                {borrowLimit.toFixed(2)} {selectedAsset?.assetCode}
              </Typography>
            </Box>

            {/* Borrow Amount Input */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ color: "#081F5C", fontWeight: 600, mb: 1 }}>
                Borrow Amount ({selectedAsset?.assetCode})
              </Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="0.00"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                disabled={isProcessing}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#f9fafb",
                  },
                }}
              />
              {parseFloat(borrowAmount) > borrowLimit &&
                borrowAmount !== "" && (
                  <Typography
                    sx={{ color: "#dc2626", fontSize: "0.75rem", mt: 0.5 }}
                  >
                    Amount exceeds your borrow limit
                  </Typography>
                )}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleCloseModal}
                disabled={isProcessing}
                sx={{
                  borderRadius: "12px",
                  py: 1.5,
                  borderColor: "#7096D1",
                  color: "#081F5C",
                  "&:hover": {
                    borderColor: "#081F5C",
                    backgroundColor: "rgba(51, 78, 172, 0.1)",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={handleBorrow}
                disabled={
                  isProcessing ||
                  !address ||
                  parseFloat(borrowAmount) > borrowLimit
                }
                sx={{
                  borderRadius: "12px",
                  py: 1.5,
                  backgroundColor: "#081F5C",
                  "&:hover": {
                    backgroundColor: "#334EAC",
                  },
                  "&:disabled": {
                    backgroundColor: "#d1d5db",
                  },
                }}
              >
                {isProcessing ? (
                  <CircularProgress size={24} sx={{ color: "#fff" }} />
                ) : !address ? (
                  "Connect Wallet"
                ) : (
                  "Borrow"
                )}
              </Button>
            </Box>

            {/* Wallet Connection Warning */}
            {!address && (
              <Typography
                sx={{
                  color: "#dc2626",
                  fontSize: "0.75rem",
                  mt: 2,
                  textAlign: "center",
                }}
              >
                Please connect your wallet to borrow
              </Typography>
            )}
          </Box>
        </Modal>
      </Box>
    </ThemeProvider>
  );
};

export default BorrowTable;
