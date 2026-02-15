export const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CHECKOUT_URL || "https://checkout.dynopay.com",
  ...(process.env.NODE_ENV !== 'production' ? ["http://localhost:3000"] : [])
].filter(Boolean);

