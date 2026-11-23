import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import Admin from '../src/Admin'
import { registrarMovimiento } from '../src/api/productos'

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'admin' } } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { usuario_id: 'admin' } }) }) }) })),
  },
}))
vi.mock('../src/api/productos', () => ({
  traerMovimientos: vi.fn(async () => []),
  registrarMovimiento: vi.fn(async () => {}),
  guardarProducto: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

function abrirPanel() {
  const recargar = vi.fn(async () => {})
  render(<MemoryRouter initialEntries={['/admin']}><Routes>
    <Route element={<Outlet context={{ productos: [{ id: 'producto-1', nombre: 'Filete', categoria: 'Pescados', unidad: 'tonelada', precio: 180, stock: 5, stock_minimo: 2 }], recargar, cargando: false, error: '' }} />}>
      <Route path="admin" element={<Admin />} />
      <Route path="admin/inventario" element={<Admin inventario />} />
    </Route>
  </Routes></MemoryRouter>)
  return recargar
}

describe('Acceso e interacción del inventario', () => {
  it('abre un diálogo visible, registra una entrada y cierra al guardar', async () => {
    const user = userEvent.setup()
    const recargar = abrirPanel()
    await user.click(await screen.findByRole('button', { name: 'Inventario', exact: true }))
    const dialog = await screen.findByRole('dialog', { name: 'Movimiento de inventario' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.type(within(dialog).getByLabelText('Cantidad (tonelada)'), '2.5')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar movimiento' }))
    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ productoId: 'producto-1', tipo: 'entrada', cantidad: '2.5', solicitudId: expect.any(String) })))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('muestra errores dentro del diálogo y permite cancelar sin guardar', async () => {
    registrarMovimiento.mockRejectedValueOnce(new Error('Error de conexión'))
    const user = userEvent.setup()
    abrirPanel()
    await user.click(await screen.findByRole('button', { name: 'Inventario', exact: true }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Cantidad (tonelada)'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar movimiento' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Error de conexión')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('permite abrir Inventario desde la navegación administrativa', async () => {
    const user = userEvent.setup()
    abrirPanel()
    await screen.findByRole('button', { name: 'Inventario', exact: true })
    await user.click(screen.getByRole('link', { name: 'Inventario', exact: true }))
    expect(await screen.findByRole('heading', { name: 'Inventario', exact: true })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Inventario', exact: true }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
