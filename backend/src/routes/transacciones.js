const express = require('express');
const prisma = require('../config/prisma');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Proteger todas las rutas
router.use(authenticateJWT);

// Categorías disponibles
const CATEGORIAS_VALIDAS = [
  'Servicios',
  'Hogar',
  'Impuestos',
  'Salud',
  'Educación',
  'Alimentación',
  'Transporte',
  'Ocio y entretenimiento',
  'Trabajo y negocios',
  'Tecnología y electrónica',
  'Ropa y accesorios',
  'Viajes y vacaciones',
  'Ahorros e inversiones',
  'Deudas y préstamos',
  'Donaciones y caridad',
  'Seguros',
  'Cuidado personal y belleza',
  'Mascotas',
  'Mantenimiento y reparaciones',
  'Facturas y suscripciones',
  'Regalos y celebraciones',
  'Otros'
];

// GET /api/transacciones - obtener transacciones del usuario
router.get('/', async (req, res) => {
  try {
    const { mes, tipo } = req.query;
    const anio = req.query.anio || req.query['año'];
    
    let whereClause = { userId: req.user.id };
    
    // Filtrar por mes y año si se proporcionan
    if (mes && anio) {
      const parsedAnio = parseInt(anio);
      const parsedMes = parseInt(mes);
      const startDate = new Date(parsedAnio, parsedMes - 1, 1);
      const endDate = new Date(parsedAnio, parsedMes, 0, 23, 59, 59);
      
      whereClause.fecha = {
        gte: startDate,
        lte: endDate
      };
    }
    
    // Filtrar por tipo si se proporciona
    if (tipo && (tipo === 'ingreso' || tipo === 'gasto')) {
      whereClause.tipo = tipo;
    }
    
    const transacciones = await prisma.transaccion.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' }
    });
    
    return res.json(transacciones);
  } catch (err) {
    console.error('Error fetching transacciones:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/transacciones - crear nueva transacción
router.post('/', async (req, res) => {
  try {
    const { tipo, monto, descripcion, categoria, fecha, periodicidad } = req.body;
    
    // Validaciones
    if (!tipo || !monto || !descripcion || !categoria || !fecha || !periodicidad) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos: tipo, monto, descripcion, categoria, fecha, periodicidad' 
      });
    }
    
    if (tipo !== 'ingreso' && tipo !== 'gasto') {
      return res.status(400).json({ error: 'El tipo debe ser "ingreso" o "gasto"' });
    }
    
    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return res.status(400).json({ 
        error: `La categoría debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}` 
      });
    }
    
    if (periodicidad !== 'unico' && periodicidad !== 'mensual') {
      return res.status(400).json({ error: 'La periodicidad debe ser "unico" o "mensual"' });
    }
    
    // Crear la transacción principal
    const transaccion = await prisma.transaccion.create({
      data: {
        tipo,
        monto: String(monto),
        descripcion,
        categoria,
        fecha: new Date(fecha),
        periodicidad,
        esRecurrente: false,
        userId: req.user.id
      }
    });
    
    // Si es mensual, crear transacciones para los próximos 11 meses
    if (periodicidad === 'mensual') {
      const transaccionesRecurrentes = [];
      const fechaBase = new Date(fecha);
      
      for (let i = 1; i <= 11; i++) {
        const nuevaFecha = new Date(fechaBase);
        nuevaFecha.setMonth(nuevaFecha.getMonth() + i);
        
        transaccionesRecurrentes.push({
          tipo,
          monto: String(monto),
          descripcion,
          categoria,
          fecha: nuevaFecha,
          periodicidad,
          esRecurrente: true,
          transaccionPadreId: transaccion.id,
          userId: req.user.id
        });
      }
      
      // Crear todas las transacciones recurrentes
      await prisma.transaccion.createMany({
        data: transaccionesRecurrentes
      });
    }
    
    return res.status(201).json(transaccion);
  } catch (err) {
    console.error('Error creating transaccion:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/transacciones/:id - actualizar transacción
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { tipo, monto, descripcion, categoria, fecha, periodicidad } = req.body;
    
    // Verificar que la transacción existe y pertenece al usuario
    const transaccionExistente = await prisma.transaccion.findUnique({ 
      where: { id } 
    });
    
    if (!transaccionExistente || transaccionExistente.userId !== req.user.id) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }
    
    // Validaciones (si se proporcionan los campos)
    if (tipo && tipo !== 'ingreso' && tipo !== 'gasto') {
      return res.status(400).json({ error: 'El tipo debe ser "ingreso" o "gasto"' });
    }
    
    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
      return res.status(400).json({ 
        error: `La categoría debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}` 
      });
    }
    
    if (periodicidad && periodicidad !== 'unico' && periodicidad !== 'mensual') {
      return res.status(400).json({ error: 'La periodicidad debe ser "unico" o "mensual"' });
    }
    
    // Actualizar la transacción
    const transaccionActualizada = await prisma.transaccion.update({
      where: { id },
      data: {
        ...(tipo !== undefined ? { tipo } : {}),
        ...(monto !== undefined ? { monto: String(monto) } : {}),
        ...(descripcion !== undefined ? { descripcion } : {}),
        ...(categoria !== undefined ? { categoria } : {}),
        ...(fecha !== undefined ? { fecha: new Date(fecha) } : {}),
        ...(periodicidad !== undefined ? { periodicidad } : {})
      }
    });
    
    return res.json(transaccionActualizada);
  } catch (err) {
    console.error('Error updating transaccion:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/transacciones/:id - eliminar transacción
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Verificar que la transacción existe y pertenece al usuario
    const transaccion = await prisma.transaccion.findUnique({ 
      where: { id } 
    });
    
    if (!transaccion || transaccion.userId !== req.user.id) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }
    
    // Si es una transacción padre (no recurrente), eliminar también las recurrentes
    if (!transaccion.esRecurrente && transaccion.periodicidad === 'mensual') {
      await prisma.transaccion.deleteMany({
        where: { 
          transaccionPadreId: id,
          userId: req.user.id
        }
      });
    }
    
    // Eliminar la transacción principal
    await prisma.transaccion.delete({ where: { id } });
    
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting transaccion:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/transacciones/resumen/:anio/:mes - obtener resumen mensual (usar ASCII en params)
router.get('/resumen/:anio/:mes', async (req, res) => {
  try {
    const anio = parseInt(req.params.anio, 10);
    const mes = parseInt(req.params.mes, 10);
    
    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 0, 23, 59, 59);
    
    const transacciones = await prisma.transaccion.findMany({
      where: {
        userId: req.user.id,
        fecha: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    // Calcular totales
    const ingresos = transacciones
      .filter(t => t.tipo === 'ingreso')
      .reduce((sum, t) => sum + parseFloat(t.monto), 0);
      
    const gastos = transacciones
      .filter(t => t.tipo === 'gasto')
      .reduce((sum, t) => sum + parseFloat(t.monto), 0);
    
    // Agrupar por categoría
    const porCategoria = transacciones.reduce((acc, t) => {
      if (!acc[t.categoria]) {
        acc[t.categoria] = { ingresos: 0, gastos: 0 };
      }
      
      if (t.tipo === 'ingreso') {
        acc[t.categoria].ingresos += parseFloat(t.monto);
      } else {
        acc[t.categoria].gastos += parseFloat(t.monto);
      }
      
      return acc;
    }, {});
    
    return res.json({
      totales: {
        ingresos,
        gastos,
        balance: ingresos - gastos
      },
      porCategoria,
      transacciones: transacciones.length
    });
  } catch (err) {
    console.error('Error getting resumen:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/transacciones/categorias - obtener categorías disponibles
router.get('/categorias', (req, res) => {
  return res.json(CATEGORIAS_VALIDAS);
});

module.exports = router;
