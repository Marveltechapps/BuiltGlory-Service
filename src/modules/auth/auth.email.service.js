import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand, GetSendQuotaCommand, ListIdentitiesCommand, GetIdentityVerificationAttributesCommand } from "@aws-sdk/client-ses";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "./auth.error.js";

let transporter;
let sesClient;

const clean = (value) => String(value || "").trim();

const useSes = () => clean(env.EMAIL_TRANSPORT).toLowerCase() === "ses";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isTransientEmailError = (error) => {
  const code = String(error?.code || error?.name || "");
  const message = String(error?.message || "");
  return /Throttl|ServiceUnavailable|Timeout|RequestTimeout|ECONNRESET|ETIMEDOUT|EPIPE|TooManyRequests|InternalFailure|NetworkingError/i.test(`${code} ${message}`);
};

export const isSesIdentityError = (error) => {
  const code = String(error?.code || error?.name || "");
  const message = String(error?.message || "");
  return /MessageRejected|MailFromDomainNotVerified|ConfigurationSetDoesNotExist|EmailAddressNotVerified|InvalidParameterValue/i.test(`${code} ${message}`)
    || /not verified|identity|sandbox/i.test(message);
};

export const withEmailRetry = async (operation, { attempts = 3, label = "email" } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientEmailError(error)) throw error;
      const delayMs = Math.min(250 * 2 ** (attempt - 1), 2000);
      logger.warn({
        event: "email_retry",
        label,
        attempt,
        nextDelayMs: delayMs,
        code: error.code || error.name,
        message: error.message
      });
      await sleep(delayMs);
    }
  }
  throw lastError;
};

const getSesClient = () => {
  if (sesClient) return sesClient;
  const accessKeyId = clean(env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.AWS_SECRET_ACCESS_KEY);
  sesClient = new SESClient({
    region: clean(env.AWS_REGION) || "ap-south-1",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    maxAttempts: 1
  });
  return sesClient;
};

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new AppError(500, "EMAIL_CONFIG_MISSING", "SMTP email configuration is missing.");
  }
  const port = Number(env.SMTP_PORT);
  const secure = port === 465 || String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && port === 587,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user: env.SMTP_USER,
      pass: String(env.SMTP_PASS).replace(/\s+/g, "")
    }
  });
  return transporter;
};

const smtpConfigSummary = () => ({
  transport: useSes() ? "ses" : "smtp",
  host: useSes() ? `ses.${clean(env.AWS_REGION) || "ap-south-1"}.amazonaws.com` : env.SMTP_HOST,
  port: useSes() ? null : Number(env.SMTP_PORT),
  secure: useSes() ? true : Number(env.SMTP_PORT) === 465,
  authUser: useSes() ? "(aws-iam)" : env.SMTP_USER,
  region: clean(env.AWS_REGION) || "ap-south-1"
});

const serializeSendMailInfo = (info = {}) => ({
  messageId: info.messageId,
  response: info.response,
  accepted: info.accepted,
  rejected: info.rejected,
  pending: info.pending,
  envelope: info.envelope
});

const serializeSmtpError = (error) => ({
  name: error.name,
  message: error.message,
  code: error.code,
  command: error.command,
  responseCode: error.responseCode,
  response: error.response
});

const isSmtpAuthFailure = (error) => error.code === "EAUTH"
  || error.responseCode === 534
  || error.responseCode === 535
  || /auth|authentication|credentials|login|WebLoginRequired/i.test(`${error.command || ""} ${error.message || ""} ${error.response || ""}`);

/** Safe SES status for deploy checks — never sends mail. */
export const getSesSendingStatus = async () => {
  const client = getSesClient();
  const [quota, identities] = await Promise.all([
    client.send(new GetSendQuotaCommand({})),
    client.send(new ListIdentitiesCommand({ MaxItems: 50 }))
  ]);
  const list = identities.Identities || [];
  let verification = {};
  if (list.length) {
    const attrs = await client.send(new GetIdentityVerificationAttributesCommand({ Identities: list }));
    verification = Object.fromEntries(
      Object.entries(attrs.VerificationAttributes || {}).map(([identity, row]) => [identity, row.VerificationStatus])
    );
  }
  const from = clean(env.EMAIL_FROM || env.ADMIN_EMAIL);
  return {
    region: clean(env.AWS_REGION) || "ap-south-1",
    max24HourSend: quota.Max24HourSend,
    sentLast24Hours: quota.SentLast24Hours,
    identities: list,
    verification,
    fromConfigured: from,
    fromVerified: from ? verification[from] === "Success" : false
  };
};

const renderEmailOtpTemplate = ({ otp }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BuiltGlory Email Verification</title>
  </head>
  <body style="margin:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#111827;color:#ffffff;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;">BuiltGlory Email Verification</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Your verification code is:</p>
                <div style="letter-spacing:8px;font-size:36px;font-weight:700;text-align:center;background:#f3f4f6;border-radius:12px;padding:18px 12px;color:#111827;">${otp}</div>
                <p style="margin:20px 0 0;font-size:15px;line-height:1.6;">This code expires in 5 minutes.</p>
                <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendViaSes = async ({ from, to, subject, text, html }) => {
  const result = await withEmailRetry(
    () => getSesClient().send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: text, Charset: "UTF-8" },
          ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {})
        }
      }
    })),
    { attempts: 3, label: "ses-send" }
  );
  return {
    messageId: result.MessageId,
    response: "ses-accepted",
    accepted: [to],
    rejected: [],
    pending: [],
    envelope: { from, to: [to] }
  };
};

const deliver = async (message) => {
  if (useSes()) {
    if (!clean(env.AWS_ACCESS_KEY_ID) || !clean(env.AWS_SECRET_ACCESS_KEY)) {
      throw new AppError(500, "EMAIL_CONFIG_MISSING", "AWS credentials are required for EMAIL_TRANSPORT=ses.");
    }
    try {
      return await sendViaSes(message);
    } catch (error) {
      if (isSesIdentityError(error)) {
        throw new AppError(
          502,
          "EMAIL_IDENTITY_UNVERIFIED",
          "SES rejected the send — verify EMAIL_FROM (or domain) in Amazon SES, then retry.",
          [serializeSmtpError(error)]
        );
      }
      throw error;
    }
  }
  return withEmailRetry(
    () => getTransporter().sendMail(message),
    { attempts: 3, label: "smtp-send" }
  );
};

export const sendEmailOtp = async ({ email, otp }) => {
  const from = env.EMAIL_FROM || "admin@builtglory.com";
  const message = {
    from,
    to: email,
    subject: "BuiltGlory Email Verification",
    text: `Your verification code is ${otp}.\nThis code expires in 5 minutes.`,
    html: renderEmailOtpTemplate({ otp })
  };

  logger.info({
    event: "email_otp_sendmail_attempt",
    email,
    from,
    smtp: smtpConfigSummary()
  });

  try {
    const info = await deliver(message);
    const smtpInfo = serializeSendMailInfo(info);
    logger.info({
      event: "email_otp_sendmail_success",
      email,
      smtp: smtpConfigSummary(),
      smtpResponse: smtpInfo.response,
      smtpInfo
    });

    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      throw new AppError(502, "EMAIL_DELIVERY_REJECTED", "SMTP server did not accept the OTP email.", [smtpInfo]);
    }

    return info;
  } catch (error) {
    const smtpError = serializeSmtpError(error);
    const level = isSmtpAuthFailure(error) ? "error" : "warn";
    logger[level]({
      event: isSmtpAuthFailure(error) ? "email_otp_smtp_auth_failed" : "email_otp_sendmail_failed",
      email,
      smtp: smtpConfigSummary(),
      smtpResponse: smtpError.response,
      smtpError
    });

    if (error instanceof AppError) throw error;
    throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Failed to send verification email.", [smtpError]);
  }
};

const renderTransactionalTemplate = ({ subject, body }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#111827;color:#ffffff;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;">BuiltGlory</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font-size:16px;line-height:1.7;white-space:pre-wrap;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const sendTransactionalEmail = async ({ to, subject, body, from }) => {
  const sender = from || env.EMAIL_FROM || env.ADMIN_EMAIL || "admin@builtglory.com";
  const message = {
    from: sender,
    to,
    subject,
    text: body,
    html: renderTransactionalTemplate({ subject, body })
  };

  logger.info({
    event: "transactional_email_send_attempt",
    to,
    from: sender,
    subject,
    smtp: smtpConfigSummary()
  });

  try {
    const info = await deliver(message);
    const smtpInfo = serializeSendMailInfo(info);
    logger.info({
      event: "transactional_email_send_success",
      to,
      subject,
      smtpResponse: smtpInfo.response,
      smtpInfo
    });

    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      throw new AppError(502, "EMAIL_DELIVERY_REJECTED", "SMTP server did not accept the email.", [smtpInfo]);
    }

    return info;
  } catch (error) {
    const smtpError = serializeSmtpError(error);
    logger.error({
      event: "transactional_email_send_failed",
      to,
      subject,
      smtp: smtpConfigSummary(),
      smtpError
    });

    if (error instanceof AppError) throw error;
    throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Failed to send email.", [smtpError]);
  }
};
