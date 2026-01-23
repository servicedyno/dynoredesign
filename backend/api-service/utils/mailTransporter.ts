import nodemailer from "nodemailer";

const mailTransporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,

  auth: {
    user: "temp@krushang.dev",
    pass: "303Vb>2FIcyv",
  },
});

export default mailTransporter;
