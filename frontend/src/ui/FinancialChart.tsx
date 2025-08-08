import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ResumenFinanciero } from '../lib/api'

interface FinancialChartProps {
  resumen: ResumenFinanciero
  mes: number
  año: number
}

export default function FinancialChart({ resumen, mes, año }: FinancialChartProps) {
  
  // Datos para el gráfico de barras (comparación general)
  const datosComparacion = [
    {
      name: 'Ingresos',
      monto: resumen.totales.ingresos,
      color: '#10B981'
    },
    {
      name: 'Gastos', 
      monto: resumen.totales.gastos,
      color: '#EF4444'
    }
  ]

  // Datos para el gráfico de barras por categoría
  const datosPorCategoria = Object.entries(resumen.porCategoria).map(([categoria, datos]) => ({
    categoria,
    ingresos: datos.ingresos,
    gastos: datos.gastos,
    total: datos.ingresos + datos.gastos
  })).filter(item => item.total > 0)

  // Datos para gráfico circular de gastos por categoría
  const gastosCategoria = Object.entries(resumen.porCategoria)
    .filter(([, datos]) => datos.gastos > 0)
    .map(([categoria, datos]) => ({
      name: categoria,
      value: datos.gastos
    }))

  // Colores para el gráfico circular
  const COLORS = ['#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#10B981']

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(value)
  }

  const nombreMes = new Date(año, mes - 1).toLocaleDateString('es-ES', { month: 'long' })

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 capitalize">
          Análisis Financiero - {nombreMes} {año}
        </h3>
      </div>

      {/* Gráfico de comparación general */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Ingresos vs Gastos</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={datosComparacion} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="monto">
              {datosComparacion.map((item, idx) => (
                <Cell key={`cell-${idx}`} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficos por categoría */}
      {datosPorCategoria.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de barras por categoría */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Por Categoría</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosPorCategoria} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="categoria" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" fill="#10B981" name="Ingresos" />
                <Bar dataKey="gastos" fill="#EF4444" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico circular de gastos */}
          {gastosCategoria.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Distribución de Gastos</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gastosCategoria}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {gastosCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Resumen textual */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Resumen del Mes</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumen.totales.ingresos)}
            </div>
            <div className="text-sm text-green-700">Total Ingresos</div>
          </div>
          
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(resumen.totales.gastos)}
            </div>
            <div className="text-sm text-red-700">Total Gastos</div>
          </div>
          
          <div className={`p-4 rounded-lg ${resumen.totales.balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className={`text-2xl font-bold ${resumen.totales.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(resumen.totales.balance)}
            </div>
            <div className={`text-sm ${resumen.totales.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              Balance {resumen.totales.balance >= 0 ? 'Positivo' : 'Negativo'}
            </div>
          </div>
        </div>
        
        {/* Mensaje motivacional */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
          <div className="text-sm text-gray-600">
            {resumen.totales.balance >= 0 
              ? '¡Excelente! Tienes un balance positivo este mes. 💰'
              : 'Considera revisar tus gastos para mejorar tu balance. 📊'
            }
          </div>
        </div>
      </div>
    </div>
  )
}
