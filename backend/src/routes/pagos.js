const express = require('express');
const prisma = require('../config/prisma');
const { authenticateJWT, ensureUserExists } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateJWT, ensureUserExists);

// GET /api/pagos?servicioId=
router.get('/', async (req, res) => {
  try {
    const servicioId = req.query.servicioId ? parseInt(req.query.servicioId, 10) : undefined;

    // Only pagos for the current user's services
    const where = servicioId
      ? { servicioId }
      : undefined;

    const pagos = await prisma.pago.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { servicio: true }
    });

    const filtered = pagos.filter((p) => p.servicio.userId === req.user.id);
    return res.json(filtered);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pagos - register a payment
router.post('/', async (req, res) => {
  try {
    const { servicioId, fechaPago, montoPagado } = req.body;
    if (!servicioId || !fechaPago || montoPagado === undefined) {
      return res.status(400).json({ error: 'servicioId, fechaPago and montoPagado are required' });
    }

    const service = await prisma.servicio.findUnique({ where: { id: Number(servicioId) } });
    if (!service || service.userId !== req.user.id) {
      return res.status(404).json({ error: 'Servicio not found' });
    }

    const pago = await prisma.pago.create({
      data: {
        servicioId: Number(servicioId),
        fechaPago: new Date(fechaPago),
        montoPagado: String(montoPagado)
      }
    });

    // Mark service as pagado when a payment is registered (simplified rule)
    await prisma.servicio.update({ where: { id: Number(servicioId) }, data: { estado: 'pagado' } });

    return res.status(201).json(pago);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


