const express = require('express');
const prisma = require('../config/prisma');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Protect all routes below
router.use(authenticateJWT);

// GET /api/servicios - list services for current user (with optional month/year filter)
router.get('/', async (req, res) => {
  try {
    const { mes, anio, año } = req.query;

    const where = { userId: req.user.id };

    if (mes && (anio || año)) {
      const y = parseInt((anio || año), 10);
      const m = parseInt(mes, 10);
      where.vencimiento = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59)
      };
    }

    let servicios = await prisma.servicio.findMany({
      where,
      orderBy: { vencimiento: 'asc' }
    });

    // Auto-move to vencido if date is past today
    const today = new Date();
    const updates = [];
    for (const s of servicios) {
      if (s.estado !== 'pagado' && new Date(s.vencimiento) < today && s.estado !== 'vencido') {
        updates.push(
          prisma.servicio.update({ where: { id: s.id }, data: { estado: 'vencido' } })
        );
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates);
      servicios = await prisma.servicio.findMany({ where, orderBy: { vencimiento: 'asc' } });
    }

    return res.json(servicios);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/servicios - create service
router.post('/', async (req, res) => {
  try {
    const { nombre, monto, vencimiento, periodicidad, estado, linkPago, categoria } = req.body;
    if (!nombre || monto === undefined || !vencimiento || !periodicidad) {
      return res.status(400).json({ error: 'nombre, monto, vencimiento and periodicidad are required' });
    }

    const servicio = await prisma.servicio.create({
      data: {
        nombre,
        monto: String(monto),
        vencimiento: new Date(vencimiento),
        periodicidad,
        estado: estado || 'por_pagar',
        userId: req.user.id,
        linkPago: linkPago || null,
        categoria: categoria || 'Otros'
      }
    });
    return res.status(201).json(servicio);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/servicios/:id - update service
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const service = await prisma.servicio.findUnique({ where: { id } });
    if (!service || service.userId !== req.user.id) {
      return res.status(404).json({ error: 'Servicio not found' });
    }

    const { nombre, monto, vencimiento, periodicidad, estado, linkPago, categoria } = req.body;
    const updated = await prisma.servicio.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(monto !== undefined ? { monto: String(monto) } : {}),
        ...(vencimiento !== undefined ? { vencimiento: new Date(vencimiento) } : {}),
        ...(periodicidad !== undefined ? { periodicidad } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(linkPago !== undefined ? { linkPago } : {}),
        ...(categoria !== undefined ? { categoria } : {})
      }
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/servicios/:id/estado - update status and optionally create expense transaction when paid
router.patch('/:id/estado', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { estado } = req.body; // 'por_pagar' | 'pagado' | 'vencido'
    if (!estado) {
      return res.status(400).json({ error: 'estado is required' });
    }
    const service = await prisma.servicio.findUnique({ where: { id } });
    if (!service || service.userId !== req.user.id) {
      return res.status(404).json({ error: 'Servicio not found' });
    }

    const updated = await prisma.servicio.update({ where: { id }, data: { estado } });

    // If marked as pagado, create an expense transaction in Finanzas
    if (estado === 'pagado') {
      await prisma.transaccion.create({
        data: {
          tipo: 'gasto',
          monto: String(service.monto),
          descripcion: `Pago de servicio: ${service.nombre}`,
          categoria: service.categoria || 'Otros',
          fecha: new Date(),
          periodicidad: service.periodicidad === 'mensual' ? 'mensual' : 'unico',
          esRecurrente: false,
          userId: req.user.id
        }
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/servicios/:id - delete service
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const service = await prisma.servicio.findUnique({ where: { id } });
    if (!service || service.userId !== req.user.id) {
      return res.status(404).json({ error: 'Servicio not found' });
    }

    await prisma.pago.deleteMany({ where: { servicioId: id } });
    await prisma.servicio.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


