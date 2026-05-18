import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function generateAudioScript(data: any, userName: string = 'Usuario') {
    const today = new Date();
    const dateStr = format(today, "EEEE d 'de' MMMM", { locale: es });
    
    let script = `¡Hola ${userName}! Hoy es ${dateStr}. Aquí tienes tu resumen personalizado. `;

    // 1. Turnos
    if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0];
        script += `Hoy tienes el turno ${shift.title}. Comienzas a las ${format(new Date(shift.start_time), 'HH:mm')} y terminas a las ${format(new Date(shift.end_time), 'HH:mm')}. `;
    } else {
        script += "Hoy no tienes turnos de trabajo programados, ¡disfruta de tu tiempo libre! ";
    }

    // 2. Tareas
    if (data.tasks && data.tasks.length > 0) {
        script += `Tienes ${data.tasks.length} tareas pendientes para hoy. Las más importantes son: ${data.tasks.slice(0, 3).map((t: any) => t.title).join(', ')}. `;
    }

    // 3. Finanzas
    if (data.money && data.money.totalSaved !== undefined) {
        script += `Tu saldo total en cuentas es de ${Math.round(data.money.totalSaved)} euros. `;
    }

    // 4. Compras
    if (data.shopping && data.shopping.length > 0) {
        script += `Recuerda que tienes ${data.shopping.length} artículos en tu lista de la compra. `;
    }

    // 5. Avisos
    if (data.alerts && data.alerts.length > 0) {
        script += `También tienes algunos avisos importantes: ${data.alerts.map((a: any) => a.label).join(', ')}. `;
    }

    script += "Eso es todo por ahora. ¡Que tengas un excelente día!";

    return script;
}
