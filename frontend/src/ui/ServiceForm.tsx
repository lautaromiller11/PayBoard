import { useState } from 'react'
import { createServicio, Servicio } from '../lib/api'
import DEFAULT_CATEGORIES, { EXPENSE_CATEGORIES } from '../lib/categories'

type Props = {
  onClose: () => void
  onCreated: (s: Servicio) => void
}

export default function ServiceForm({ onClose, onCreated }: Props) {
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [periodicidad, setPeriodicidad] = useState<'unico' | 'mensual'>('mensual')
  const [linkPago, setLinkPago] = useState('')
  const [categoria, setCategoria] = useState(EXPENSE_CATEGORIES[0] || DEFAULT_CATEGORIES[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const servicio = await createServicio({
        nombre,
        monto,
        vencimiento,
        periodicidad,
        estado: 'por_pagar',
        linkPago: linkPago || undefined,
        categoria
      })
      onCreated(servicio)
      onClose()
    } catch (err) {
      setError('Error al crear el servicio. Por favor intenta nuevamente.')
      console.error('Error creating service:', err)
    } finally {
      setLoading(false)
    }
  }

  // Establecer fecha mínima como hoy
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Nuevo Servicio</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Servicio *
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Electricidad, Internet, Netflix..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Vencimiento *
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={vencimiento}
              onChange={e => setVencimiento(e.target.value)}
              type="date"
              min={today}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periodicidad
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={periodicidad}
              onChange={e => setPeriodicidad(e.target.value as any)}
            >
              <option value="mensual">Mensual</option>
              <option value="unico">Único</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {periodicidad === 'mensual'
                ? 'Se repetirá cada mes'
                : 'Pago único, no se repetirá'
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <div className="relative">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-48 overflow-y-auto"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link de Pago (URL)
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={linkPago}
              onChange={e => setLinkPago(e.target.value)}
              type="url"
              placeholder="https://..."
              pattern="https?://.+"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Guardando...' : 'Crear Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


