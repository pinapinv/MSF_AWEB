import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LockKeyhole } from 'lucide-react'
import { Button } from './components/ui/button'
import { supabase } from './lib/supabase'

export default function Login() {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const navigate = useNavigate()
  async function entrar(event) {
    event.preventDefault()
    setOcupado(true)
    setError('')
    const datos = new FormData(event.currentTarget)
    try {
      const { error: fallo } = await supabase.auth.signInWithPassword({ email: datos.get('email'), password: datos.get('password') })
      if (fallo) throw fallo
      navigate('/admin', { replace: true })
    } catch { setError('No fue posible iniciar sesión. Revisa tus credenciales y tu conexión.') }
    finally { setOcupado(false) }
  }
  return <main className="container login-page"><section className="login-card"><span className="login-icon"><LockKeyhole /></span><p className="eyebrow">ACCESO RESTRINGIDO</p><h1>Administración</h1><p className="muted">Accede para gestionar productos e inventario.</p>
    {!supabase ? <div className="notice">El acceso administrativo no está disponible en este momento. Inténtalo más tarde.</div> : <form onSubmit={entrar}><label>Correo electrónico<input type="email" name="email" autoComplete="username" required /></label><label>Contraseña<input type="password" name="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="notice error">{error}</p>}<Button type="submit" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Iniciar sesión'}</Button></form>}
    <Link className="back-link" to="/">Volver al catálogo</Link>
  </section></main>
}
