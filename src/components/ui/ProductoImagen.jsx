import { Fish, Shell, Shrimp } from 'lucide-react'

export default function ProductoImagen({ producto }) {
  const Icono = producto.categoria === 'Moluscos' ? Shell : producto.categoria === 'Mariscos' ? Shrimp : Fish
  return <div className={`product-image ${producto.categoria === 'Moluscos' ? 'sand' : producto.categoria === 'Mariscos' ? 'rose' : 'blue'}`}>
    <Icono size={88} strokeWidth={1} aria-hidden="true" />
    {producto.foto_url && <img key={producto.foto_url} src={producto.foto_url} alt={producto.nombre} loading="lazy" onError={(e) => { e.currentTarget.hidden = true }} />}
    {!producto.foto_url && <span>Imagen ilustrativa</span>}
  </div>
}
