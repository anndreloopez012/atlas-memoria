// Muestra el último aviso unos segundos (región viva: los lectores de pantalla lo leen).
import { useEffect, useState } from 'react';

export default function Avisos() {
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null);
  useEffect(() => {
    let reloj: ReturnType<typeof setTimeout>;
    const nuevo = (e: Event) => {
      clearTimeout(reloj);
      setAviso((a) => ({ texto: (e as CustomEvent<string>).detail, n: (a?.n ?? 0) + 1 }));
      reloj = setTimeout(() => setAviso(null), 3500);
    };
    window.addEventListener('atlas:aviso', nuevo);
    return () => {
      clearTimeout(reloj);
      window.removeEventListener('atlas:aviso', nuevo);
    };
  }, []);
  return (
    <div className="avisos" role="status" aria-live="polite">
      {aviso && (
        <p key={aviso.n} className="aviso">
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
