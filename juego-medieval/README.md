# Sangre y Linaje

Juego de estrategia medieval para PC (Windows) en 3D, hecho con Godot 4.3. Modelos CC0 de Quaternius (ver CREDITS.md).

**Fase 1 (actual):** controlas a un personaje en una aldea. Talas, picas piedra, cultivas y comercias. Construyes y mejoras tu casa, te casas y tienes hijos, que heredan cuando mueres. El rey te llama a la guerra y luchas en batallas en tiempo real. Con prestigio llegas a jefe del pueblo.

**Economía del pueblo:** parcelas de cultivo (trigo, zanahorias, remolachas, coles, calabazas), corral con gallinas, ovejas, cerdos y vacas, manzanos, bayas, setas, pesca en el estanque, caza de ciervos, molino (trigo → harina) y horno (harina → pan). Tecla I: inventario.

**Edificios y talleres:** 8 solares donde construir herrería (herramientas, espadas y armaduras con hierro), telar (lana → tela), curtiduría (cuero → piel), quesería (leche → queso), cervecería (trigo → cerveza), establo, granero, colmenar y capilla. Mina de hierro al oeste del pueblo.

**Pueblo vivo:** cada aldeano tiene su oficio (leñador, cantero, agricultor, pescador, cazador, pastor, minero, panadero, tejedor, herrero), su oro y su inventario; trabajan de día, comercian entre ellos y con mercaderes, y cambian de oficio si les va mal. Puedes comerciar con ellos (comprar, vender o trueque). La prosperidad del pueblo abre terrenos en el barrio sur: cómpralos para levantar una Casona o una Casa fuerte, o llegarán forasteros a vivir en ellos.

**De aldea a ciudad:** además de los vecinos con nombre, el pueblo llano crece por inmigración según el ánimo, la comida y los edificios. Aldea (hasta 100 habitantes) → Villa (barrio este, empalizada, cuartel; hasta 400) → Ciudad (barrios del norte, murallas de piedra, catedral; hasta 1.200). Las casas se dibujan según la población.

**Ejército:** como jefe de una villa o ciudad, recluta en el cuartel milicia, lanceros, arqueros, hombres de armas y, en una ciudad, caballería (jinetes a caballo, rápidos y fuertes) sacados del pueblo llano (con coste y paga diaria; sin paga, desertan). En batalla tus tropas te siguen con órdenes (1: ¡Cargad!, 2: Mantened, 3: Seguidme), los arqueros disparan flechas, entran refuerzos por oleadas y las bajas se descuentan del ejército.

**Mapa de la región (tecla M):** marcha con tu ejército entre pueblos (viajar consume días). Cuatro señores con sus pueblos que crecen y fundan aldeas nuevas. Puedes fundar tus propias aldeas en lugares libres, darles empalizada o murallas, guarnición y colonos; atacar pueblos y, si ganas, saquearlos, conquistarlos o hacerlos vasallos. Los señores enemistados asaltan tus aldeas mal defendidas.

**Señores, guerra, comercio y corte:** los señores se declaran guerras, firman paces y alianzas, y levantan ejércitos que marchan por el mapa y conquistan pueblos (también los tuyos). Puedes interceptarlos o sufrir emboscadas. Cada pueblo tiene mercado con productos baratos y buscados; las caravanas los recorren. En la corte de cada señor: visitas, banquetes, cacerías, ajedrez, torneos y bodas entre casas. Tecla D: diplomacia.

**Próximas fases:** gobernar el pueblo y dirigir ejércitos (fase 2), y un mapa del mundo para viajar y combatir (fase 3).

**Visitar pueblos:** desde el mapa puedes pasear a pie por cualquier pueblo (calles, casas, murallas, mercado, taberna con rumores y la corte de su señor). Los asedios se libran delante de las murallas del pueblo atacado.

**Peligros del bosque:** manadas de lobos (más de noche y en invierno) que te atacan y se llevan ganado del corral; bandidos que acampan en un claro del bosque y saquean el pueblo si no los echas.

**Caballo:** cómpralo en el mercado (150 oro). H para montar o desmontar en la aldea; viajas más rápido por el mapa y en batalla luchas a caballo (más rápido, más vida y golpes más fuertes).

**Sonido:** música original para aldea, mapa y batalla, y efectos (talar, picar, pasos, espadas, monedas). La música se activa o desactiva en el menú principal.

## Controles
- WASD: moverse · Shift: correr · Clic derecho + ratón: girar cámara · Rueda: zoom · E: interactuar (mantén E para recoger recursos) · H: montar/desmontar · T: velocidad del tiempo · Esc: menú · F5: guardar
- En batalla: el ratón mueve la cámara; clic izquierdo ataca, clic derecho (mantener) bloquea; Esc suelta el ratón

## Compilar
1. Abre la carpeta con Godot 4.3 y usa Proyecto → Exportar → "Windows Desktop" (genera `build/SangreYLinaje.exe`).
2. Opcional: `makensis installer.nsi` crea `build/SangreYLinaje_Instalador.exe`.
