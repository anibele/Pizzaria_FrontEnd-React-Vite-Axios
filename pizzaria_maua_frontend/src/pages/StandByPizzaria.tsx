import imagemStandBy from "../assets/StandByPizzaria.png";
import "../styles/standBy.css";

interface StandByPizzariaProps {
    onToque: () => void;
}

export default function StandByPizzaria({ onToque }: StandByPizzariaProps) {
    return (
        <div className="standby-fullscreen-container" onClick={onToque}>
            <img
                src={imagemStandBy}
                alt="Standby Pizzaria Mauá"
                className="standby-imagem"
            />
            <div className="standby-overlay-texto">
                Toque em qualquer lugar para iniciar
            </div>
        </div>
    );
}