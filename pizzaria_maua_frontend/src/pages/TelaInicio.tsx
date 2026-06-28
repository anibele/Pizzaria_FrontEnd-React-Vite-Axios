import imagemInicio from "../assets/TelaInicio.png";
import "../styles/TelaInicio.css";

interface TelaInicioProps {
    onIniciar: () => void;
}

export default function TelaInicio({ onIniciar }: TelaInicioProps) {
    return (
        <div className="tela-inicio-fullscreen-container" onClick={onIniciar}>
            <img
                src={imagemInicio}
                alt="Toque para iniciar - Pizzaria Mauá"
                className="tela-inicio-imagem"
            />
        </div>
    );
}