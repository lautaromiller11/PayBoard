import { useState, useEffect, useRef } from 'react'
import { createTransaccion, fetchCategorias, Transaccion } from '../lib/api'
import CATEGORIES from '../lib/categories'

interface TransactionFormProps {
  tipo: 'ingreso' | 'gasto'
  onClose: () => void
  onCreated: (transaccion: Transaccion) => void
}

export default function TransactionForm({ tipo, onClose, onCreated }: TransactionFormProps) {
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fecha, setFecha] = useState('')
  const [periodicidad, setPeriodicidad] = useState<'unico' | 'mensual'>('unico')
  const [categorias, setCategorias] = useState<string[]>(CATEGORIES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCatOpen, setIsCatOpen] = useState(false)
  const catDropdownRef = useRef<HTMLDivElement | null>(null)

  // Cargar categorías al montar el componente
  useEffect(() => {
    const loadCategorias = async () => {
      try {
        // Intentar tomar desde API; si falla, usar lista local
        const data = await fetchCategorias()
        if (Array.isArray(data) && data.length > 0) {
          setCategorias(data)
        }
      } catch (err) {
        console.error('Error loading categorias:', err)
        // En error mantenemos las categorías locales
      }
      // Establecer selección por defecto
      setCategoria((prev) => prev || (categorias[0] ?? CATEGORIES[0]))
    }
    
    loadCategorias()
    
    // Establecer fecha actual por defecto
    const today = new Date().toISOString().split('T')[0]
    setFecha(today)
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const transaccion = await createTransaccion({
        tipo,
        monto: parseFloat(monto),
        descripcion,
        categoria,
        fecha,
        periodicidad
      })

      onCreated(transaccion)
      onClose()
    } catch (err) {
      console.error('Error creating transaction:', err)
      setError('Error al crear la transacción. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const getTipoColor = () => {
    return tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
  }

  const getBtnColor = () => {
    return tipo === 'ingreso' 
      ? 'bg-green-600 hover:bg-green-700' 
      : 'bg-red-600 hover:bg-red-700'
  }

  const getTipoLabel = () => {
    return tipo === 'ingreso' ? 'Ingreso' : 'Gasto'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-semibold ${getTipoColor()}`}>
            Nuevo {getTipoLabel()}
          </h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción *
            </label>
            <input 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={descripcion} 
              onChange={e => setDescripcion(e.target.value)}
              placeholder={`Ej: ${tipo === 'ingreso' ? 'Salario mensual, Freelance' : 'Compras, Electricidad'}`}
              required 
            />
          </div>

          {/* Monto */}
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

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría *
            </label>
            <div className="relative" ref={catDropdownRef}>
              {/* Hidden input to keep required validation semantics */}
              <input type="text" className="hidden" value={categoria} onChange={() => {}} required readOnly />
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
                  className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {categorias.map((cat) => (
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

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <input 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={fecha} 
              onChange={e => setFecha(e.target.value)}
              type="date"
              required 
            />
          </div>

          {/* Periodicidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periodicidad
            </label>
            <select 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={periodicidad} 
              onChange={e => setPeriodicidad(e.target.value as 'unico' | 'mensual')}
            >
              <option value="unico">Único</option>
              <option value="mensual">Mensual</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {periodicidad === 'mensual' 
                ? 'Se repetirá automáticamente cada mes' 
                : 'Solo se registrará una vez'
              }
            </p>
          </div>

          {/* Botones */}
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
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${getBtnColor()}`}
            >
              {loading ? 'Guardando...' : `Crear ${getTipoLabel()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
