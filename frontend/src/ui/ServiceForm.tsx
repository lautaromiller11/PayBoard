import { useEffect, useRef, useState } from 'react'
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
  const [isCatOpen, setIsCatOpen] = useState(false)
  const catDropdownRef = useRef<HTMLDivElement | null>(null)

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

  // Cerrar dropdown en click afuera o ESC
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!catDropdownRef.current) return
      if (!catDropdownRef.current.contains(e.target as Node)) {
        setIsCatOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCatOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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
            <div className="relative" ref={catDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCatOpen((v) => !v)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                aria-haspopup="listbox"
                aria-expanded={isCatOpen}
              >
                <span className={categoria ? 'text-gray-900' : 'text-gray-500'}>
                  {categoria || 'Seleccionar categoría'}
                </span>
                <span className={`ml-2 transform transition-transform ${isCatOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {isCatOpen && (
                <div
                  role="listbox"
                  className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <div
                      key={cat}
                      role="option"
                      aria-selected={categoria === cat}
                      onClick={() => {
                        setCategoria(cat)
                        setIsCatOpen(false)
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${categoria === cat ? 'bg-blue-100 text-blue-900' : 'text-gray-800'}`}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              )}
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


