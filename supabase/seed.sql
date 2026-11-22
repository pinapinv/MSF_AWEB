-- OPCIONAL: productos ficticios, autorizados únicamente para demostración.
-- Las existencias comienzan en cero: registrar entradas desde el panel.
insert into public.productos (id, nombre, descripcion, categoria, unidad, precio, stock_minimo, promocion)
values
('00000000-0000-4000-8000-000000000001', 'Filete de pescado', '', 'Pescados', 'kg', 180, 3, true),
('00000000-0000-4000-8000-000000000002', 'Camarón mediano', '', 'Mariscos', 'kg', 260, 2, false),
('00000000-0000-4000-8000-000000000003', 'Pulpo', '', 'Mariscos', 'kg', 320, 2, false),
('00000000-0000-4000-8000-000000000004', 'Ostión', '', 'Moluscos', 'pieza', 25, 12, false),
('00000000-0000-4000-8000-000000000005', 'Almeja', '', 'Moluscos', 'kg', 95, 3, true),
('00000000-0000-4000-8000-000000000006', 'Pescado entero', '', 'Pescados', 'kg', 140, 3, false)
on conflict (id) do nothing;
