import axios from 'axios'
import { getAuthToken } from './auth'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } catch {}
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export type Servicio = {
  id: number
  nombre: string
  monto: string
  vencimiento: string
  periodicidad: 'unico' | 'mensual'
  estado: 'por_pagar' | 'pagado' | 'vencido'
  userId: number
  createdAt: string
}

export type Pago = {
  id: number
  servicioId: number
  fechaPago: string
  montoPagado: string
  createdAt: string
}

export type Transaccion = {
  id: number
  tipo: 'ingreso' | 'gasto'
  monto: string
  descripcion: string
  categoria: string
  fecha: string
  periodicidad: 'unico' | 'mensual'
  esRecurrente: boolean
  transaccionPadreId?: number
  userId: number
  createdAt: string
  updatedAt: string
}

export type ResumenFinanciero = {
  totales: {
    ingresos: number
    gastos: number
    balance: number
  }
  porCategoria: {
    [categoria: string]: {
      ingresos: number
      gastos: number
    }
  }
  transacciones: number
}

export async function fetchServicios(): Promise<Servicio[]> {
  const { data } = await api.get('/servicios')
  return data
}

export async function createServicio(payload: Partial<Servicio>): Promise<Servicio> {
  const { data } = await api.post('/servicios', payload)
  return data
}

export async function updateServicio(id: number, payload: Partial<Servicio>): Promise<Servicio> {
  const { data } = await api.put(`/servicios/${id}`, payload)
  return data
}

export async function deleteServicio(id: number): Promise<void> {
  await api.delete(`/servicios/${id}`)
}

export async function changeEstado(id: number, estado: Servicio['estado']): Promise<Servicio> {
  const { data } = await api.patch(`/servicios/${id}/estado`, { estado })
  return data
}

export async function createPago(payload: { servicioId: number; fechaPago: string; montoPagado: string }) {
  const { data } = await api.post('/pagos', payload)
  return data
}

// ========== FUNCIONES PARA TRANSACCIONES ==========

export async function fetchTransacciones(mes?: number, año?: number, tipo?: 'ingreso' | 'gasto'): Promise<Transaccion[]> {
  const params = new URLSearchParams()
  if (mes) params.append('mes', mes.toString())
  if (año) params.append('año', año.toString())
  if (tipo) params.append('tipo', tipo)
  
  const { data } = await api.get(`/transacciones?${params.toString()}`)
  return data
}

export async function createTransaccion(payload: {
  tipo: 'ingreso' | 'gasto'
  monto: number | string
  descripcion: string
  categoria: string
  fecha: string
  periodicidad: 'unico' | 'mensual'
}): Promise<Transaccion> {
  const { data } = await api.post('/transacciones', payload)
  return data
}

export async function updateTransaccion(id: number, payload: Partial<Transaccion>): Promise<Transaccion> {
  const { data } = await api.put(`/transacciones/${id}`, payload)
  return data
}

export async function deleteTransaccion(id: number): Promise<void> {
  await api.delete(`/transacciones/${id}`)
}

export async function fetchResumenFinanciero(año: number, mes: number): Promise<ResumenFinanciero> {
  const { data } = await api.get(`/transacciones/resumen/${año}/${mes}`)
  return data
}

export async function fetchCategorias(): Promise<string[]> {
  const { data } = await api.get('/transacciones/categorias')
  return data
}

export async function fetchCategoriasPorTipo(tipo: 'ingreso' | 'gasto'): Promise<string[]> {
  const { data } = await api.get(`/transacciones/categorias?tipo=${tipo}`)
  return data
}


