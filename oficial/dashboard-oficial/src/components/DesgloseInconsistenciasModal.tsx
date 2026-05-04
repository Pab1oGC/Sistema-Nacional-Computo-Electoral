import { useEffect, useRef } from 'react';
import { formatearNumero } from '../utils/formatearNumero';

interface Props {
  open: boolean;
  onClose: () => void;
  aritmeticas: number;
  discrepanciaMesa: number;
  duplicadas: number;
}

export function DesgloseInconsistenciasModal({
  open,
  onClose,
  aritmeticas,
  discrepanciaMesa,
  duplicadas,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sincroniza prop `open` con la API nativa de <dialog>.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Cerrar al hacer click sobre el backdrop (fuera del contenido).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onClose();
      }
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onClose]);

  const total = aritmeticas + discrepanciaMesa + duplicadas;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="modal-desglose-titulo"
      className="rounded-lg p-0 max-w-xl w-[90vw] backdrop:bg-black/40"
    >
      <div className="bg-oficial-card text-oficial-text">
        <div className="flex justify-between items-start gap-4 p-6 border-b border-oficial-border">
          <div>
            <h2 id="modal-desglose-titulo" className="text-xl font-semibold">
              Desglose de actas observadas
            </h2>
            <p className="text-sm text-oficial-text-secondary mt-1">
              {formatearNumero(total)} actas en total, registradas para auditoría
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-oficial-text-secondary hover:text-oficial-text text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-5">
          <SeccionTipo
            titulo="Observaciones aritméticas"
            valor={aritmeticas}
            color="bg-oficial-yellow"
            descripcion="Actas donde el conteo de papeletas o la suma de votos no balancea con los totales reportados. Quedan registradas para que las verifique el equipo de auditoría."
          />
          <SeccionTipo
            titulo="Discrepancia de mesa"
            valor={discrepanciaMesa}
            color="bg-oficial-yellow"
            descripcion="Actas cuyo código de mesa no coincide con el catálogo oficial del padrón. Se rechazan automáticamente para evitar contaminar el cómputo con datos no verificables."
          />
          <SeccionTipo
            titulo="Duplicadas (rechazadas por idempotencia)"
            valor={duplicadas}
            color="bg-oficial-yellow"
            descripcion="Actas idénticas a otras ya procesadas (mismo contenido). El sistema las detecta y descarta para garantizar que cada acta cuente una sola vez."
          />
        </div>
      </div>
    </dialog>
  );
}

interface SeccionTipoProps {
  titulo: string;
  valor: number;
  color: string;
  descripcion: string;
}

function SeccionTipo({ titulo, valor, color, descripcion }: SeccionTipoProps) {
  return (
    <article>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-2xl font-bold tabular-nums">
          {formatearNumero(valor)}
        </p>
      </div>
      <div className={`w-full h-1 ${color} rounded mb-2`} aria-hidden="true" />
      <p className="text-sm text-oficial-text-secondary leading-relaxed">
        {descripcion}
      </p>
    </article>
  );
}
