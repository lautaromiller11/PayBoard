let twilio = null;
try {
  twilio = require('twilio');
} catch (_) {
  twilio = null;
}
const prisma = require('../config/prisma');

// Configura tus credenciales de Twilio aquí
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // Ej: 'whatsapp:+14155238886'

let cachedClient = null;
function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !twilio) {
    return null;
  }
  if (cachedClient) return cachedClient;
  try {
    cachedClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return cachedClient;
  } catch (e) {
    console.error('Error inicializando cliente de Twilio:', e?.message || e);
    return null;
  }
}

async function sendWhatsAppAlert(to, message) {
  const client = getTwilioClient();
  if (!client || !TWILIO_WHATSAPP_FROM) {
    console.warn('Twilio config missing: no se enviará WhatsApp.');
    return null;
  }
  return client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    body: message,
  });
}

// Verifica servicios vencidos y envía alerta si corresponde
async function checkAndSendAlertsForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { servicios: true },
  });
  if (!user || !user.whatsappAlertsEnabled || !user.phoneNumber) return;
  const vencidos = user.servicios.filter(s => s.estado === 'vencido');
  if (vencidos.length === 0) return;
  for (const servicio of vencidos) {
    const msg = `¡Alerta! El servicio "${servicio.nombre}" está vencido. Monto: $${servicio.monto}. Vencimiento: ${servicio.vencimiento}`;
    await sendWhatsAppAlert(user.phoneNumber, msg);
  }
}

module.exports = { sendWhatsAppAlert, checkAndSendAlertsForUser };
