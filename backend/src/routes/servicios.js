const express = require('express');
const prisma = require('../config/prisma');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Protect all routes below
router.use(authenticateJWT);

// Normalize a date-only input (YYYY-MM-DD or Date) to UTC noon to avoid timezone shifts
function toUtcNoon(dateInput) {
  if (!dateInput) return null;
  let y, m, d;
  if (typeof dateInput === 'string') {
    // Expecting 'YYYY-MM-DD' or ISO string; take first 10 chars safely
    const part = dateInput.slice(0, 10);
    const segs = part.split('-');
    if (segs.length === 3) {
      y = parseInt(segs[0], 10);
      m = parseInt(segs[1], 10);
      d = parseInt(segs[2], 10);
    } else {
      const tmp = new Date(dateInput);
      y = tmp.getUTCFullYear();
      m = tmp.getUTCMonth() + 1;
      d = tmp.getUTCDate();
    }
  } else {
    const tmp = new Date(dateInput);
    y = tmp.getUTCFullYear();
    m = tmp.getUTCMonth() + 1;
    d = tmp.getUTCDate();
  }
  return new Date(Date.UTC(y, (m - 1), d, 12, 0, 0));
}

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

    const vencimientoUtc = toUtcNoon(vencimiento);

    const servicio = await prisma.servicio.create({
      data: {
        nombre,
        monto: String(monto),
        vencimiento: vencimientoUtc,
        periodicidad,
        estado: estado || 'por_pagar',
        userId: req.user.id,
        linkPago: linkPago || null,
        categoria: categoria || 'Otros'
      }
    });

    // Si es mensual, crear servicios para los próximos 11 meses
    if (periodicidad === 'mensual') {
      const serviciosFuturos = [];
      const baseDate = vencimientoUtc;
      for (let i = 1; i <= 11; i++) {
        const fechaNuevaLocal = new Date(baseDate);
        fechaNuevaLocal.setUTCMonth(fechaNuevaLocal.getUTCMonth() + i);
        // Asegurar que siga en UTC mediodía del día correspondiente
        const yyyy = fechaNuevaLocal.getUTCFullYear();
        const mm = fechaNuevaLocal.getUTCMonth() + 1;
        const dd = fechaNuevaLocal.getUTCDate();
        const fechaNueva = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
        serviciosFuturos.push({
          nombre,
          monto: String(monto),
          vencimiento: fechaNueva,
          periodicidad,
          estado: 'por_pagar',
          userId: req.user.id,
          linkPago: linkPago || null,
          categoria: categoria || 'Otros'
        });
      }
      if (serviciosFuturos.length > 0) {
        await prisma.servicio.createMany({ data: serviciosFuturos });
      }
    }

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
    const data = {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(monto !== undefined ? { monto: String(monto) } : {}),
      ...(vencimiento !== undefined ? { vencimiento: toUtcNoon(vencimiento) } : {}),
      ...(periodicidad !== undefined ? { periodicidad } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(linkPago !== undefined ? { linkPago } : {}),
      ...(categoria !== undefined ? { categoria } : {})
    };

    const updated = await prisma.servicio.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/servicios/:id/estado - update status and optionally create/remove expense transaction when paid/reverted
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

    if (estado === 'pagado') {
      // Avoid duplicate expense: check if exists linked or by description
      const desc = `Pago de servicio: ${service.nombre}`;
      const existing = await prisma.transaccion.findFirst({
        where: {
          userId: req.user.id,
          tipo: 'gasto',
          OR: [
            { servicioId: service.id },
            { servicioId: null, descripcion: desc }
          ]
        }
      });
      if (!existing) {
        await prisma.transaccion.create({
          data: {
            tipo: 'gasto',
            monto: String(service.monto),
            descripcion: desc,
            categoria: service.categoria || 'Otros',
            fecha: new Date(),
            periodicidad: service.periodicidad === 'mensual' ? 'mensual' : 'unico',
            esRecurrente: false,
            userId: req.user.id,
            servicioId: service.id
          }
        });
      }
    }

    if (estado === 'por_pagar') {
      // Remove any linked expense transactions for this service
      const desc = `Pago de servicio: ${service.nombre}`;
      await prisma.transaccion.deleteMany({
        where: {
          userId: req.user.id,
          tipo: 'gasto',
          OR: [
            { servicioId: service.id },
            { servicioId: null, descripcion: desc }
          ]
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


