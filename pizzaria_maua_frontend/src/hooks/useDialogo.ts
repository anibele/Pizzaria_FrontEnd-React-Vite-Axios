import { useId, useLayoutEffect, useRef } from 'react';
import { controleHttpSessao } from '../services/httpSessao';
import '../styles/dialogo.css';

interface DialogoAtivo { elemento: HTMLElement; acionador: HTMLElement | null; geracao: number; inertAnterior: boolean }
const dialogos: DialogoAtivo[] = [];
let retornoPendente: DialogoAtivo | null = null;
let overflowAnterior = '';
const topo = () => dialogos[dialogos.length - 1];
const isolarDialogosAnteriores = () => dialogos.forEach(d => { d.elemento.inert = d !== topo() || d.inertAnterior; });
const visivel = (el: HTMLElement) => el.isConnected && [...el.getClientRects()].some(r => r.width > 0 && r.height > 0)
    && !el.closest('[hidden], [inert], [aria-hidden="true"]') && !el.matches(':disabled')
    && getComputedStyle(el).visibility !== 'hidden';
const destinoInterativo = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && visivel(el)
    && el.matches('button, a[href], input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]');
const controles = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
    .filter(e => e.tabIndex >= 0 && visivel(e));

// Contenção por eventos + backdrop existente. Não esconde regiões de alerta/live da página.
export function useDialogo(aberto: boolean, onClose: () => void, podeFechar = true) {
    const ref = useRef<HTMLDivElement>(null);
    const tituloId = useId();
    const atual = useRef({ onClose, podeFechar });
    useLayoutEffect(() => { atual.current = { onClose, podeFechar }; }, [onClose, podeFechar]);
    useLayoutEffect(() => {
        const elemento = ref.current;
        if (!aberto || !elemento) return;
        const geracao = controleHttpSessao.geracao;
        const ativo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        const anterior = topo() || retornoPendente;
        const acionador = ativo && !ativo.closest('[role="dialog"]') ? ativo
            : anterior?.geracao === geracao ? anterior.acionador : ativo;
        const registro = { elemento, acionador, geracao, inertAnterior: elemento.inert };
        if (!dialogos.length) { overflowAnterior = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
        dialogos.push(registro);
        isolarDialogosAnteriores();
        const focar = () => elemento.focus({ preventScroll: true });
        const teclado = (e: KeyboardEvent) => {
            if (topo() !== registro) return;
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (!e.repeat && atual.current.podeFechar) atual.current.onClose();
            } else if (e.key === 'Tab') {
                const lista = controles(elemento), primeiro = lista[0], ultimo = lista[lista.length - 1];
                const ativo = document.activeElement;
                if (!primeiro) { e.preventDefault(); focar(); }
                else if (!lista.includes(ativo as HTMLElement)) { e.preventDefault(); (e.shiftKey ? ultimo : primeiro).focus(); }
                else if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus(); }
                else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
            }
        };
        const conferir = () => {
            if (topo() === registro && (!(document.activeElement instanceof HTMLElement)
                || !elemento.contains(document.activeElement) || !visivel(document.activeElement))) focar();
        };
        document.addEventListener('keydown', teclado, true);
        document.addEventListener('focusin', conferir, true);
        const observer = new MutationObserver(conferir);
        observer.observe(elemento, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'style', 'class'] });
        focar();
        return () => {
            observer.disconnect(); document.removeEventListener('keydown', teclado, true); document.removeEventListener('focusin', conferir, true);
            dialogos.splice(dialogos.indexOf(registro), 1);
            elemento.inert = registro.inertAnterior;
            isolarDialogosAnteriores();
            retornoPendente = registro;
            if (!dialogos.length) document.body.style.overflow = overflowAnterior;
            queueMicrotask(() => {
                if (retornoPendente === registro) retornoPendente = null;
                if (controleHttpSessao.geracao !== geracao) return;
                const superior = topo();
                if (superior) {
                    if (!superior.elemento.contains(document.activeElement)) superior.elemento.focus({ preventScroll: true });
                } else if (destinoInterativo(document.activeElement) && !elemento.contains(document.activeElement)) {
                    // A nova interface (por exemplo, standby) já assumiu um foco realmente utilizável.
                    return;
                } else if (destinoInterativo(acionador)) acionador.focus({ preventScroll: true });
                else {
                    const main = document.querySelector<HTMLElement>('main');
                    const destino = main && controles(main).find(destinoInterativo);
                    destino?.focus({ preventScroll: true });
                }
            });
        };
    }, [aberto]);
    return [ref, tituloId, () => { if (podeFechar) onClose(); }] as const;
}
