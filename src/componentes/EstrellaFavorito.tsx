// La estrella para guardar (o quitar) algo de favoritos.
import { Star } from 'lucide-react';
import { alternarFavorito, esFavorito, useFavoritos, type Favorito } from '../lib/favoritos';

export default function EstrellaFavorito({ item }: { item: Favorito }) {
  const favoritos = useFavoritos();
  const activo = esFavorito(favoritos, item.tipo, item.id);
  return (
    <button
      className={`icono-boton estrella-favorito ${activo ? 'activa' : ''}`}
      onClick={() => alternarFavorito(item)}
      aria-pressed={activo}
      aria-label={activo ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={activo ? 'Quitar de favoritos' : 'Guardar en favoritos (aparece en Hoy y en ⌘K)'}
    >
      <Star size={16} fill={activo ? 'currentColor' : 'none'} />
    </button>
  );
}
