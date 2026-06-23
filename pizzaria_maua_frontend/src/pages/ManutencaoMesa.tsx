import imagemManutencao from "../assets/ManutencaoPizzaria.png";
import "../styles/manutencaoMesa.css";

export default function ManutencaoMesa() {
    return (
        <div className="manutencao-fullscreen-container">
            <img
                src={imagemManutencao}
                alt="Mesa em Manutenção - Pizzaria Mauá"
                className="manutencao-imagem"
            />
            </div>
    );
}