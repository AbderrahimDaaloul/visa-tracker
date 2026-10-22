import nodemailer from "nodemailer";

export type SendResult = { sent: boolean; devUrl?: string; error?: string };

function fromAddress(smtpUser: string): string {
  return process.env.EMAIL_FROM || `VisaTrack TN <${smtpUser}>`;
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
  smtpUser: string,
  smtpPass: string
): Promise<SendResult> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const from = fromAddress(smtpUser);
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass.replace(/\s+/g, "") },
      tls: { servername: host },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      replyTo: from,
      envelope: { from: smtpUser, to },
      headers: {
        "X-Auto-Response-Suppress": "All",
        "X-Entity-Ref-ID": `visatrack-${Date.now()}`,
      },
    });
    const accepted = (info.accepted ?? []).map((a) => String(a).toLowerCase());
    if (info.rejected?.length || !accepted.includes(to.toLowerCase())) {
      console.error("[email] destinataire refusé", { to, accepted, rejected: info.rejected, response: info.response });
      return { sent: false, error: "L'adresse email a été refusée. Vérifiez-la et réessayez." };
    }
    console.info("[email] accepté par le serveur", { to, response: info.response, messageId: info.messageId });
    return { sent: true };
  } catch (error) {
    const responseCode = (error as { responseCode?: number } | null)?.responseCode;
    console.error("[email] erreur SMTP :", error instanceof Error ? error.message : error, responseCode ?? "");
    return { sent: false, error: "Envoi de l'email impossible. Réessayez dans quelques minutes." };
  }
}

async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };
  const from = process.env.EMAIL_FROM || "VisaTrack TN <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: from,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] erreur Resend", res.status, body);
      const notVerified = res.status === 403 && /verif|domain|test address/i.test(body);
      return {
        sent: false,
        error: notVerified
          ? "Le domaine expéditeur n'est pas encore vérifié. Utilisez une adresse d'expédition vérifiée pour envoyer à d'autres destinataires."
          : "Envoi de l'email impossible. Réessayez dans quelques minutes.",
      };
    }
    console.info("[email] accepté par Resend", { to });
    return { sent: true };
  } catch (error) {
    console.error("[email] erreur Resend :", error instanceof Error ? error.message : error);
    return { sent: false, error: "Envoi de l'email impossible. Réessayez dans quelques minutes." };
  }
}

async function deliverEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  const hasSmtp = Boolean(smtpUser && smtpPass);
  const hasResend = Boolean(process.env.RESEND_API_KEY);

  if (provider === "resend" && hasResend) {
    return sendViaResend(to, subject, html, text);
  }
  if (provider === "smtp" && hasSmtp) {
    return sendViaSmtp(to, subject, html, text, smtpUser!, smtpPass!);
  }

  if (hasSmtp) {
    const smtpResult = await sendViaSmtp(to, subject, html, text, smtpUser!, smtpPass!);
    if (smtpResult.sent || !hasResend) return smtpResult;
    console.warn("[email] SMTP indisponible, nouvel essai via Resend");
    return sendViaResend(to, subject, html, text);
  }

  if (hasResend) {
    return sendViaResend(to, subject, html, text);
  }

  console.error("[email] aucun fournisseur configuré (SMTP_USER/SMTP_PASS ou RESEND_API_KEY)");
  return {
    sent: false,
    error: "Service email non configuré. Contactez l'administrateur de la plateforme.",
  };
}

export async function sendEmailVerificationEmail(email: string, link: string): Promise<SendResult> {
  const subject = "Vérifiez votre adresse email VisaTrack TN";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;color:#1f2937">
      <h2 style="margin:0 0 12px">Confirmez votre adresse email</h2>
      <p>Bienvenue sur VisaTrack TN. Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
      <p style="margin:20px 0">
        <a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          Vérifier mon adresse email
        </a>
      </p>
      <p>Ce lien expire dans 24 heures.</p>
      <p style="font-size:12px;color:#6b7280;margin-top:24px">
        Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
      </p>
    </div>
  `;
  const text = [
    "Confirmez votre adresse email VisaTrack TN",
    "",
    "Bienvenue sur VisaTrack TN. Cliquez sur le lien ci-dessous pour activer votre compte.",
    `Vérifier mon adresse email : ${link}`,
    "",
    "Ce lien expire dans 24 heures.",
    "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",
  ].join("\n");

  if (!emailProvider()) {
    if (process.env.NODE_ENV === "production") {
      return {
        sent: false,
        error: "Service email non configuré. Contactez l'administrateur de la plateforme.",
      };
    }
    console.info(`[dev] Lien de vérification pour ${email} : ${link}`);
    return { sent: false, devUrl: link };
  }

  return deliverEmail(email, subject, html, text);
}

export async function sendPasswordResetEmail(email: string, link: string): Promise<SendResult> {
  const subject = "Réinitialisez votre mot de passe VisaTrack TN";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;color:#1f2937">
      <h2 style="margin:0 0 12px">Nouveau mot de passe</h2>
      <p>Vous avez demandé à réinitialiser le mot de passe de votre compte VisaTrack TN.</p>
      <p style="margin:20px 0">
        <a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          Choisir un nouveau mot de passe
        </a>
      </p>
      <p>Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.</p>
      <p style="font-size:12px;color:#6b7280;margin-top:24px">
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email. Votre mot de passe actuel reste inchangé.
      </p>
    </div>
  `;
  const text = [
    "Nouveau mot de passe VisaTrack TN",
    "",
    "Vous avez demandé à réinitialiser le mot de passe de votre compte.",
    `Choisir un nouveau mot de passe : ${link}`,
    "",
    "Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join("\n");

  if (!emailProvider()) {
    if (process.env.NODE_ENV === "production") {
      return {
        sent: false,
        error: "Service email non configuré. Contactez l'administrateur de la plateforme.",
      };
    }
    console.info(`[dev] Lien de réinitialisation pour ${email} : ${link}`);
    return { sent: false, devUrl: link };
  }

  return deliverEmail(email, subject, html, text);
}

export function emailProvider(): "smtp" | "resend" | null {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (provider === "resend" && process.env.RESEND_API_KEY) return "resend";
  if (provider === "smtp" && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}
