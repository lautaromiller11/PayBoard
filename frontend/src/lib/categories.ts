export const EXPENSE_CATEGORIES: string[] = [
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
]

export const INCOME_CATEGORIES: string[] = [
  'Sueldo y salario',
  'Bonificaciones y comisiones',
  'Negocios propios',
  'Freelance o trabajos independientes',
  'Inversiones (dividendos, intereses)',
  'Alquileres recibidos',
  'Venta de bienes',
  'Regalos y herencias',
  'Reembolsos',
  'Subsidios y ayudas',
  'Otros ingresos'
]

export const ALL_CATEGORIES: string[] = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])]

// Backward compatibility default export (previously a single array)
const DEFAULT = EXPENSE_CATEGORIES
export default DEFAULT