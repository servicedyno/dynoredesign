const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CHECKOUT_URL || "https://checkout.dynopay.com",
  ...(process.env.NODE_ENV !== 'production' ? ["http://localhost:3000"] : [])
].filter(Boolean);

export const corsOptions = {
  origin: function (origin, callback) {
    console.log("origin======================>", origin);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by Server"));
    }
  },
  optionsSuccessStatus: 200,
};
