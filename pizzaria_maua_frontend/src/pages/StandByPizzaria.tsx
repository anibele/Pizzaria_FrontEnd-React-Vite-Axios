import imagemStandBy from "../assets/StandByPizzaria.png";
import "../styles/standBy.css";

interface StandByPizzariaProps {
    onToque: () => void;
}

export default function StandByPizzaria({ onToque }: StandByPizzariaProps) {
    return (
        <button type="button" autoFocus className="standby-fullscreen-container" aria-label="Retomar cardápio" onClick={onToque}
            onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); }}>
            <img
                src={imagemStandBy}
                alt="Standby Pizzaria Mauá"
                className="standby-imagem"
            />
        </button>
    );
}
