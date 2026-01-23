const allowedOrigins = ["http://localhost:3000"];

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
