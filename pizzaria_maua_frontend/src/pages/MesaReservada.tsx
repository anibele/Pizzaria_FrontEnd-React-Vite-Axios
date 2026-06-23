import imagemReservada from "../assets/MesaReservadaPizzaria.png";
import "../styles/manutencaoMesa.css";

export default function MesaReservada() {
    return (
        <div className="manutencao-fullscreen-container">
            <img
                src={imagemReservada}
                alt="Mesa Reservada - Pizzaria Mauá"
                className="manutencao-imagem"
            />
        </div>
    );
}