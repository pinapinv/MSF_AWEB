import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Ventas from '../src/Ventas'
import { registrarVenta } from '../src/api/productos'

vi.mock('../src/api/productos', () => ({ traerVentas: vi.fn(async () => []), registrarVenta: vi.fn(async () => {}) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('requiere confirmar el pago, calcula monto y registra la venta', async () => {
  const user = userEvent.setup(), recargar = vi.fn(async () => {})
  render(<Ventas productos={[{id:'p1',nombre:'Filete',unidad:'tonelada',stock:5,precio:180}]} recargar={recargar} />)
  const confirmar = screen.getByRole('button',{name:'Confirmar venta y descontar stock'})
  expect(confirmar.disabled).toBe(true)
  await user.selectOptions(screen.getByLabelText('Producto'),'p1')
  await user.type(screen.getByLabelText('Cantidad (tonelada)'),'2.5')
  expect(screen.getByText('Total: $450.00')).toBeTruthy()
  await user.click(screen.getByRole('checkbox'))
  await user.click(confirmar)
  await waitFor(() => expect(registrarVenta).toHaveBeenCalledWith(expect.objectContaining({productoId:'p1',cantidad:'2.5',solicitudId:expect.any(String)})))
  expect(await screen.findByRole('status')).toBeTruthy()
  expect(recargar).toHaveBeenCalledTimes(1)
})
