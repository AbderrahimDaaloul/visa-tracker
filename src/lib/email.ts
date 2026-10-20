export type SendResult = { sent: boolean; devCode?: string };

export async function sendOtpEmail(email: string, code: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const html = `
    <p style="font-size:18px">Votre code de connexion VisaTrack TN :</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
    <p>Il expire dans 15 minutes.</p>
  `;
  if (!apiKey) {
    console.info(`[dev] Code OTP pour ${email} : ${code}`);
    return { sent: false, devCode: code };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "VisaTrack TN <onboarding@resend.dev>",
      to: [email],
      subject: `Code de connexion VisaTrack TN : ${code}`,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("resend error", res.status, body);
    throw new Error("Échec de l'envoi de l'email");
  }
  return { sent: true };
}
