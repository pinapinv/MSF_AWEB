// Contacto del negocio proporcionado por su responsable.
export const telefono = (import.meta.env.VITE_WHATSAPP_NUMBER || '526462757981').replace(/[+\s()-]/g, '')
export const telefonoVisible = telefono === '526462757981' ? '+52 646 275 7981' : `+${telefono}`
