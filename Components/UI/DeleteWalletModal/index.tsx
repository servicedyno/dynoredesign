import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { WarningAmberRounded, DeleteOutlineRounded } from "@mui/icons-material";
import axiosBaseApi from "@/axiosConfig";

interface DeleteWalletModalProps {
  open: boolean;
  onClose: () => void;
  walletId: number | null;
  walletType: string;
  walletAddress: string;
  companyId?: string | number;
  onDeleted: () => void;
}

const DeleteWalletModal: React.FC<DeleteWalletModalProps> = ({
  open,
  onClose,
  walletId,
  walletType,
  walletAddress,
  companyId,
  onDeleted,
}) => {
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const handleClose = useCallback(() => {
    setStep("confirm");
    setOtp("");
    setError("");
    setLoading(false);
    setMaskedEmail("");
    onClose();
  }, [onClose]);

  const handleSendOtp = useCallback(async () => {
    if (!walletId) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId };
      if (companyId) body.company_id = companyId;
      const response = await axiosBaseApi.post("wallet/wallet/delete/send-otp", body);
      const data = response?.data?.data;
      if (data?.email) setMaskedEmail(data.email);
      setStep("otp");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }, [walletId, companyId]);

  const handleDelete = useCallback(async () => {
    if (!walletId || !otp) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId, otp };
      if (companyId) body.company_id = companyId;
      await axiosBaseApi.post("wallet/wallet/delete/verify", body);
      onDeleted();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to delete wallet");
    } finally {
      setLoading(false);
    }
  }, [walletId, otp, companyId, onDeleted, handleClose]);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : "";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: "12px" } }}
    >
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        {step === "confirm" ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  backgroundColor: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DeleteOutlineRounded sx={{ color: "#DC2626", fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "UrbanistSemibold",
                  fontWeight: 600,
                  fontSize: "18px",
                  lineHeight: "100%",
                }}
              >
                Delete {walletType} Wallet
              </Typography>
            </Box>

            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                color: "#676768",
                mb: 1,
              }}
            >
              Are you sure you want to delete this wallet address?
            </Typography>

            <Box
              sx={{
                p: "12px",
                borderRadius: "8px",
                backgroundColor: "#F9FAFB",
                border: "1px solid #E9ECF2",
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  fontFamily: "UrbanistMedium",
                  fontSize: "13px",
                  color: "#9CA3AF",
                  mb: 0.5,
                }}
              >
                Address
              </Typography>
              <Typography
                sx={{
                  fontFamily: "UrbanistMedium",
                  fontSize: "14px",
                  color: "#111827",
                  wordBreak: "break-all",
                }}
              >
                {truncatedAddress}
              </Typography>
            </Box>

            <Alert severity="warning" sx={{ mb: 1, fontFamily: "UrbanistMedium", fontSize: "13px" }}>
              This action is permanent and cannot be undone. An OTP will be sent to your email for verification.
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mt: 1, fontFamily: "UrbanistMedium", fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  backgroundColor: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <WarningAmberRounded sx={{ color: "#D97706", fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "UrbanistSemibold",
                  fontWeight: 600,
                  fontSize: "18px",
                  lineHeight: "100%",
                }}
              >
                Enter Verification Code
              </Typography>
            </Box>

            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                color: "#676768",
                mb: 2,
              }}
            >
              We sent a 6-digit code to {maskedEmail || "your email"}. Enter it below to confirm deletion.
            </Typography>

            <TextField
              fullWidth
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputProps={{
                maxLength: 6,
                style: {
                  fontFamily: "UrbanistMedium",
                  fontSize: "16px",
                  letterSpacing: "4px",
                  textAlign: "center",
                },
              }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: "UrbanistMedium", fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "24px", display: "flex", gap: "12px" }}>
        <Button
          fullWidth
          onClick={handleClose}
          disabled={loading}
          sx={{
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            fontSize: "14px",
            color: "#676768",
            border: "1px solid #E9ECF2",
            py: "10px",
            borderRadius: "8px",
            textTransform: "none",
          }}
        >
          Cancel
        </Button>

        {step === "confirm" ? (
          <Button
            fullWidth
            onClick={handleSendOtp}
            disabled={loading}
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "14px",
              color: "#FFFFFF",
              backgroundColor: "#DC2626",
              py: "10px",
              borderRadius: "8px",
              textTransform: "none",
              "&:hover": { backgroundColor: "#B91C1C" },
              "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : "Delete Wallet"}
          </Button>
        ) : (
          <Button
            fullWidth
            onClick={handleDelete}
            disabled={loading || otp.length !== 6}
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "14px",
              color: "#FFFFFF",
              backgroundColor: "#DC2626",
              py: "10px",
              borderRadius: "8px",
              textTransform: "none",
              "&:hover": { backgroundColor: "#B91C1C" },
              "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : "Confirm Delete"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeleteWalletModal;
