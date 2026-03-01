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
import { useBorrowExecution } from "@/features/borrowing/hooks/useBorrowExecution";
import {
  poolsToTableAssets,
  calculateBorrowLimit,
} from "@/features/borrowing/utils/borrowUtils";
import type { BorrowTableAsset } from "@/features/borrowing/types/borrowing";

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
  const [selectedAsset, setSelectedAsset] = useState<BorrowTableAsset | null>(
    null
  );
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const {
    data: borrowPools = [],
    isLoading: isLoadingPools,
    error: poolsError,
  } = useBorrowPools();

  const {
    handleBorrow,
    isLoading: isProcessing,
    error: executionError,
    clearError,
    isWalletConnected: address,
  } = useBorrowExecution();

  const assets = useMemo(() => poolsToTableAssets(borrowPools), [borrowPools]);

  const borrowLimit = useMemo(() => {
    if (!selectedAsset || !collateralAmount) return 0;
    const collateralValue = parseFloat(collateralAmount);
    return calculateBorrowLimit(
      collateralValue,
      selectedAsset.collateralFactor
    );
  }, [selectedAsset, collateralAmount]);

  const handleBorrowClick = (asset: BorrowTableAsset) => {
    setSelectedAsset(asset);
    setCollateralAmount("");
    setBorrowAmount("");
    setSuccess(null);
    clearError();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAsset(null);
    setCollateralAmount("");
    setBorrowAmount("");
    setSuccess(null);
    clearError();
  };

  const onBorrowSubmit = async () => {
    if (!selectedAsset) return;

    const collateralNum = parseFloat(collateralAmount);
    const borrowNum = parseFloat(borrowAmount);

    if (
      !Number.isFinite(collateralNum) ||
      collateralNum <= 0 ||
      !Number.isFinite(borrowNum) ||
      borrowNum <= 0
    ) {
      return;
    }
    if (borrowNum > borrowLimit) return;

    const result = await handleBorrow({
      collateralTokenCode: selectedAsset.collateralTokenCode,
      assetCode: selectedAsset.assetCode,
      collateralAmount,
      borrowAmount,
      collateralDecimals: 7,
      borrowDecimals: 7,
    });

    if (result?.success && result.message) {
      setSuccess(result.message);
      setCollateralAmount("");
      setBorrowAmount("");
    }
  };

  const borrowLimitExceeded =
    parseFloat(borrowAmount) > borrowLimit && borrowAmount !== "";
  const canSubmit =
    address &&
    Number.isFinite(parseFloat(collateralAmount)) &&
    parseFloat(collateralAmount) > 0 &&
    Number.isFinite(parseFloat(borrowAmount)) &&
    parseFloat(borrowAmount) > 0 &&
    !borrowLimitExceeded;

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

            {executionError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
                {executionError}
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
              {borrowLimitExceeded && (
                <Typography
                  sx={{ color: "#dc2626", fontSize: "0.75rem", mt: 0.5 }}
                >
                  Amount exceeds your borrow limit
                </Typography>
              )}
            </Box>

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
                onClick={onBorrowSubmit}
                disabled={isProcessing || !canSubmit}
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
