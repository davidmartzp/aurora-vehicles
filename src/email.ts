import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromAddress = process.env.FROM_ADDRESS || 'alerts@example.com';
const alertEmailTo = process.env.ALERT_EMAIL_TO || smtpUser;

let transporter: nodemailer.Transporter | null = null;
if (smtpHost && smtpUser) {
  transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
}

export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  if (!transporter) {
    console.log('[EMAIL-STUB] transporter not configured, logging instead');
    console.log(subject);
    console.log(body);
    return;
  }

  await transporter.sendMail({ from: fromAddress, to: alertEmailTo, subject, text: body });
}
