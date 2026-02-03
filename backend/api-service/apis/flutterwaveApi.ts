import Flutterwave from "flutterwave-node-v3";

let flw: unknown = null;

// Only initialize if credentials are provided
if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
  flw = new Flutterwave(
    process.env.FLW_PUBLIC_KEY,
    process.env.FLW_SECRET_KEY
  );
}

export default flw;
