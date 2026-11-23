import { useState } from 'react'
import { afterEach,expect,it,vi } from 'vitest'
import { cleanup,render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter,Outlet,Route,Routes } from 'react-router'
import Carrito from '../src/Carrito'
import CantidadProducto from '../src/components/ui/CantidadProducto'
import { supabase } from '../src/lib/supabase'
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:vi.fn()}}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('agrega la cantidad seleccionada y bloquea exceder las existencias restantes',async()=>{
  const agregar=vi.fn(),user=userEvent.setup()
  render(<CantidadProducto producto={{id:'p1',nombre:'Filete',stock:5}} enCarrito={1} agregar={agregar}/>)
  const campo=screen.getByLabelText('Toneladas de Filete')
  await user.clear(campo);await user.type(campo,'1.5')
  await user.click(screen.getByRole('button',{name:'Agregar al carrito'}))
  expect(agregar).toHaveBeenCalledWith(expect.objectContaining({id:'p1'}),1.5)
  await user.clear(campo);await user.type(campo,'4.5')
  expect(screen.getByRole('button',{name:'Agregar al carrito'}).disabled).toBe(true)
})
function Contexto(){
  const [carrito,setCarrito]=useState([{producto_id:'p1',cantidad:0.5},{producto_id:'p2',cantidad:0.5}])
  return <Outlet context={{carrito,setCarrito,cargando:false,productos:[{id:'p1',nombre:'Filete',precio:180000,stock:5},{id:'p2',nombre:'Camarón',precio:260000,stock:3}]}} />
}
it('elige cantidades en la página y prepara un único carrito para Telegram sin registrar ventas',async()=>{
  supabase.rpc.mockResolvedValue({data:{id:'carrito-de-prueba',total:310000,resumen:'Filete 1 t\nCamarón 0.5 t'}})
  const user=userEvent.setup()
  render(<MemoryRouter initialEntries={['/carrito']}><Routes><Route element={<Contexto/>}><Route path="carrito" element={<Carrito/>}/></Route></Routes></MemoryRouter>)
  const cantidad=screen.getByLabelText('Toneladas de Filete')
  await user.clear(cantidad);await user.type(cantidad,'1')
  expect(screen.getByText('$310,000.00')).toBeTruthy()
  await user.click(screen.getByRole('button',{name:'Procesar carrito'}))
  await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledWith('crear_carrito',{p_solicitud:expect.any(String),p_lineas:[{producto_id:'p1',cantidad:1},{producto_id:'p2',cantidad:0.5}]}))
  const enlace=await screen.findByRole('link',{name:'Enviar carrito en Telegram Web'})
  expect(decodeURIComponent(enlace.href)).toContain('start=carrito_carrito-de-prueba')
  expect(supabase.rpc).toHaveBeenCalledTimes(1)
})
