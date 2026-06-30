import { Clock, AlertTriangle, Flame } from "lucide-react";
import type {KdsStatus} from "../services/kdsCalculadora";
import "../styles/badgeTimerKds.css";

interface BadgeTimerKdsProps {
    status: KdsStatus;
    minutosRestantes: number;
}

export default function BadgeTimerKds({ status, minutosRestantes }: BadgeTimerKdsProps) {
    let icon;
    let texto = "";
    let classeBase = "badge-timer ";

    if (status === 'ATRASADO') {
        icon = <Flame size={14} />;
        texto = `Atrasado ${Math.abs(minutosRestantes)}m`;
        classeBase += "atrasado";
    } else if (status === 'ALERTA') {
        icon = <AlertTriangle size={14} />;
        texto = `${minutosRestantes}m restantes`;
        classeBase += "alerta";
    } else {
        icon = <Clock size={14} />;
        texto = `${minutosRestantes}m restantes`;
        classeBase += "normal";
    }

    return (
        <div className={classeBase}>
            {icon}
            <span>{texto}</span>
        </div>
    );
}