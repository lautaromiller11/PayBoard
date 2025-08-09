const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { email, password: hashed },
      select: { id: true, email: true, createdAt: true }
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ user: { id: user.id, email: user.email, createdAt: user.createdAt }, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// GET /api/user/servicios-vencidos (ejemplo de integración de alerta)
const { checkAndSendAlertsForUser } = require('../lib/whatsapp');
router.get('/user/servicios-vencidos', require('../middleware/auth').authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { servicios: true }
  });
  const vencidos = user.servicios.filter(s => s.estado === 'vencido');
  // Enviar alerta si corresponde
  await checkAndSendAlertsForUser(userId);
  res.json({ vencidos });
});

// GET /api/user/config
const { authenticateJWT } = require('../middleware/auth');
router.get('/user/config', authenticateJWT, async (req, res) => {
  try {
    console.log('GET /api/auth/user/config - req.user:', req.user);
    if (!req.user || !req.user.id) {
      console.log('No user or user.id in request');
      return res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        phoneNumber: true,
        whatsappAlertsEnabled: true,
      },
    });
    console.log('Resultado de prisma.user.findUnique:', user);
    if (!user) {
      console.log('Usuario no encontrado en la base de datos');
      return res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
    }
    res.json(user);
  } catch (err) {
    console.error('Error inesperado en GET /api/auth/user/config:', err);
    res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
  }
});

// POST /api/user/config
router.post('/user/config', authenticateJWT, async (req, res) => {
  try {
    console.log('POST /api/auth/user/config - req.user:', req.user);
    if (!req.user || !req.user.id) {
      console.log('No user or user.id in request');
      return res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
    }
    const { phoneNumber, whatsappAlertsEnabled } = req.body;
    console.log('Datos recibidos:', { phoneNumber, whatsappAlertsEnabled });
    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          phoneNumber: phoneNumber || '',
          whatsappAlertsEnabled: typeof whatsappAlertsEnabled === 'boolean' ? whatsappAlertsEnabled : false,
        },
        select: {
          phoneNumber: true,
          whatsappAlertsEnabled: true,
        },
      });
      console.log('Resultado de prisma.user.update:', user);
    } catch (e) {
      console.error('Error en prisma.user.update:', e);
      return res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
    }
    res.json(user);
  } catch (err) {
    console.error('Error inesperado en POST /api/auth/user/config:', err);
    res.json({ phoneNumber: '', whatsappAlertsEnabled: false });
  }
});

// Envío de WhatsApp de prueba con la configuración del usuario
const { sendWhatsAppAlert } = require('../lib/whatsapp');
router.post('/whatsapp/test', authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phoneNumber: true, whatsappAlertsEnabled: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.whatsappAlertsEnabled) return res.status(400).json({ error: 'Las alertas de WhatsApp no están activadas' });
    if (!user.phoneNumber) return res.status(400).json({ error: 'Número de teléfono no configurado' });

    const result = await sendWhatsAppAlert(user.phoneNumber, 'Mensaje de prueba de PayBoard ✅');
    const sent = !!result; // será null si no hay config Twilio
    return res.json({ ok: true, sent, info: sent ? 'Mensaje enviado' : 'Twilio no está configurado, no se envió' });
  } catch (err) {
    console.error('Error en /api/auth/whatsapp/test:', err);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje de prueba' });
  }
});

module.exports = router;


