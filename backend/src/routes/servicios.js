const express = require('express');
const prisma = require('../config/prisma');
const { authenticateJWT } = require('../middleware/auth');
const { sendWhatsAppAlert } = require('../lib/whatsapp');

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

function normalizeEstado(raw) {
  if (!raw) return raw;
  const val = String(raw).toLowerCase();
  if (val === 'pagado' || val === 'por_pagar' || val === 'vencido') return val;
  return raw; // fallback untouched if unknown
}

async function maybeSendVencidoAlert(userId, servicioAntes, servicioDespues) {
  try {
    const before = servicioAntes?.estado;
    const after = servicioDespues?.estado;
    if (before === 'vencido' || after !== 'vencido') return;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true, whatsappAlertsEnabled: true }
    });
    if (!user || !user.whatsappAlertsEnabled || !user.phoneNumber) return;
    const msg = `¡Alerta! El servicio "${servicioDespues.nombre}" está vencido. Monto: $${servicioDespues.monto}. Vencimiento: ${servicioDespues.vencimiento}`;
    await sendWhatsAppAlert(user.phoneNumber, msg);
  } catch (e) {
    console.error('Error enviando alerta de WhatsApp:', e?.message || e);
  }
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
    // Validación desactivada: los servicios ya no se marcan automáticamente como vencidos si la fecha es anterior a hoy.

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
    // Validación de fecha desactivada: se permite cualquier fecha de vencimiento, incluso anterior a hoy.

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
    const estadoNorm = estado !== undefined ? normalizeEstado(estado) : undefined;
    const data = {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(monto !== undefined ? { monto: String(monto) } : {}),
      ...(vencimiento !== undefined ? { vencimiento: toUtcNoon(vencimiento) } : {}),
      ...(periodicidad !== undefined ? { periodicidad } : {}),
      ...(estadoNorm !== undefined ? { estado: estadoNorm } : {}),
      ...(linkPago !== undefined ? { linkPago } : {}),
      ...(categoria !== undefined ? { categoria } : {})
    };

    const updated = await prisma.servicio.update({ where: { id }, data });

    // Enviar alerta si transiciona a vencido
    await maybeSendVencidoAlert(req.user.id, service, updated);

    // Actualizar transacción de gasto asociada si existe (solo si el servicio está pagado)
    if (updated.estado === 'pagado') {
      // Buscar la transacción asociada por tipo 'gasto', userId y descripción con el nombre anterior
      const oldNombre = service.nombre;
      const transaccion = await prisma.transaccion.findFirst({
        where: {
          tipo: 'gasto',
          userId: updated.userId,
          descripcion: `Pago de servicio: ${oldNombre}`
        }
      });
      if (transaccion) {
        await prisma.transaccion.update({
          where: { id: transaccion.id },
          data: {
            monto: String(updated.monto),
            categoria: updated.categoria,
            periodicidad: updated.periodicidad,
            descripcion: `Pago de servicio: ${updated.nombre}`
          }
        });
      }
    }
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
    const estadoNorm = normalizeEstado(estado);
    const service = await prisma.servicio.findUnique({ where: { id } });
    if (!service || service.userId !== req.user.id) {
      return res.status(404).json({ error: 'Servicio not found' });
    }

    const updated = await prisma.servicio.update({ where: { id }, data: { estado: estadoNorm } });

    // Enviar alerta si transiciona a vencido
    await maybeSendVencidoAlert(req.user.id, service, updated);

    // Si se marca como pagado, crear la transacción de gasto
    if (estadoNorm === 'pagado') {
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


    // Si se mueve a por_pagar o vencido, eliminar la transacción de gasto asociada
    if (estadoNorm === 'por_pagar' || estadoNorm === 'vencido') {
      await prisma.transaccion.deleteMany({
        where: {
          tipo: 'gasto',
          descripcion: `Pago de servicio: ${service.nombre}`,
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


