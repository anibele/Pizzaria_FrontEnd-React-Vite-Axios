import imagemInicio from "../assets/TelaInicio.png";
import "../styles/TelaInicio.css";

interface TelaInicioProps {
    onIniciar: () => void;
}

export default function TelaInicio({ onIniciar }: TelaInicioProps) {
    return (
        <button type="button" autoFocus className="tela-inicio-fullscreen-container" aria-label="Iniciar pedido no cardápio" onClick={onIniciar}
            onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); }}>
            <img
                src={imagemInicio}
                alt="Toque para iniciar - Pizzaria Mauá"
                className="tela-inicio-imagem"
            />
        </button>
    );
}
