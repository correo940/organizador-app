import type { Article, ArticleCategory } from '@/types';
import { PlaceHolderImages } from './placeholder-images';
import { slugify } from './utils';

const getImage = (id: string) => {
  const img = PlaceHolderImages.find((p) => p.id === id);
  if (!img) return { url: 'https://picsum.photos/seed/error/600/400', hint: 'placeholder image' };
  return { url: img.imageUrl, hint: img.imageHint };
};

const articles: Omit<Article, 'slug'>[] = [
  {
    id: '1',
    title: 'La Rutina de Ejercicios Matutinos de 10 Minutos para Gente Ocupada',
    excerpt: 'Comienza tu día con esta rutina de ejercicios rápida y efectiva que puedes hacer desde cualquier lugar.',
    content: `<p>Encontrar tiempo para hacer ejercicio puede ser un desafío, pero incluso un entrenamiento corto puede marcar una gran diferencia en tus niveles de energía y salud en general. Esta rutina de 10 minutos está diseñada para aumentar tu ritmo cardíaco y activar los principales grupos musculares, estableciendo un tono positivo para el resto del día.</p>
<h3>La Rutina:</h3>
<ul>
  <li><strong>1 Minuto:</strong> Jumping Jacks (saltos de tijera)</li>
  <li><strong>1 Minuto:</strong> Rodillas altas</li>
  <li><strong>2 Minutos:</strong> Sentadillas con peso corporal</li>
  <li><strong>2 Minutos:</strong> Flexiones (de rodillas si es necesario)</li>
  <li><strong>2 Minutos:</strong> Puentes de glúteos</li>
</ul>
<p>Realiza cada ejercicio con un descanso mínimo entre ellos. Recuerda escuchar a tu cuerpo y modificar según sea necesario. La constancia es clave, así que intenta hacer esta rutina al menos 3-4 veces por semana.</p>`,
    category: 'salud física',
    imageUrl: getImage('article-1').url,
    imageHint: getImage('article-1').hint,
    author: 'Dra. Elena Vance',
    authorImageUrl: getImage('author-1').url,
    authorImageHint: getImage('author-1').hint,
    date: '15 de junio de 2024',
    featured: true,
    ingredients: [
      "Agua (hidratación)",
      "Ropa cómoda",
      "Esterilla de yoga (opcional)"
    ]
  },
  {
    id: '2',
    title: 'Mindfulness para Principiantes: Una Guía para una Mente más Serena',
    excerpt: 'Aprende los conceptos básicos del mindfulness y cómo puede ayudar a reducir el estrés y mejorar tu concentración.',
    content: `<p>En nuestro mundo acelerado, encontrar momentos de paz puede parecer imposible. El mindfulness es la práctica de estar presente y plenamente consciente del momento actual, sin juzgar. Es una herramienta poderosa para manejar el estrés, la ansiedad y mejorar tu bienestar mental en general.</p>
<h3>Cómo Empezar:</h3>
<ol>
  <li><strong>Encuentra un Espacio Tranquilo:</strong> Siéntate en una posición cómoda donde no te molesten.</li>
  <li><strong>Concéntrate en tu Respiración:</strong> Cierra los ojos y dirige tu atención a la sensación de tu aliento entrando y saliendo de tu cuerpo.</li>
  <li><strong>Reconoce tus Pensamientos:</strong> Tu mente divagará. Cuando lo haga, reconoce suavemente el pensamiento y guía tu enfoque de nuevo a tu respiración.</li>
  <li><strong>Empieza con Poco:</strong> Comienza con solo 5 minutos al día y aumenta gradualmente el tiempo a medida que te sientas más cómodo.</li>
</ol>
<p>Hay muchas aplicaciones de meditación guiada y videos en línea que pueden ayudarte a empezar. El objetivo no es dejar de pensar, sino observar tus pensamientos sin dejarte llevar por ellos.</p>`,
    category: 'salud mental',
    imageUrl: getImage('article-2').url,
    imageHint: getImage('article-2').hint,
    author: 'Mark Chen',
    authorImageUrl: getImage('author-2').url,
    authorImageHint: getImage('author-2').hint,
    date: '12 de junio de 2024',
    featured: true,
  },
  {
    id: '3',
    title: 'Crear un Presupuesto Familiar que Realmente Funcione',
    excerpt: 'Una guía paso a paso para ayudar a tu familia a tomar el control de sus finanzas y ahorrar para el futuro.',
    content: `<p>Un presupuesto no se trata de restricción; se trata de empoderamiento. Te da una imagen clara de a dónde va tu dinero y te ayuda a tomar decisiones intencionadas que se alinean con los objetivos de tu familia. Así es como se crea uno que perdure.</p>
<h3>Pasos para el Éxito:</h3>
<ol>
  <li><strong>Rastrea tus Gastos:</strong> Durante un mes, registra cada gasto. Esto revelará tus hábitos de consumo.</li>
  <li><strong>Establece Metas Financieras:</strong> ¿Para qué estás ahorrando? ¿Unas vacaciones, un coche nuevo, la jubilación? Tener metas claras proporciona motivación.</li>
  <li><strong>Categoriza los Gastos:</strong> Divide tus gastos en costos fijos (alquiler, hipoteca) y costos variables (comestibles, entretenimiento).</li>
  <li><strong>Crea tu Presupuesto:</strong> Usa una simple hoja de cálculo o una aplicación de presupuestos. La regla 50/30/20 es un gran punto de partida: 50% para necesidades, 30% para deseos y 20% para ahorros y pago de deudas.</li>
  <li><strong>Revisa y Ajusta:</strong> Un presupuesto es un documento vivo. Revísalo mensualmente y ajústalo a medida que cambien tus ingresos o gastos.</li>
</ol>
<p>Involucrar a toda la familia puede aumentar tus posibilidades de éxito. ¡Hazlo un esfuerzo de equipo!</p>`,
    category: 'finanzas familiares',
    imageUrl: getImage('article-3').url,
    imageHint: getImage('article-3').hint,
    author: 'Sofía Rodríguez',
    authorImageUrl: getImage('author-3').url,
    authorImageHint: getImage('author-3').hint,
    date: '10 de junio de 2024',
    ingredients: [
      "Libreta de gastos",
      "Calculadora",
      "Sobres para efectivo"
    ]
  },
  {
    id: '4',
    title: 'Los Beneficios del Entrenamiento de Intervalos de Alta Intensidad (HIIT)',
    excerpt: 'Descubre por qué el HIIT es una de las formas más eficientes de quemar grasa, mejorar la salud del corazón y acelerar tu metabolismo.',
    content: `<p>El Entrenamiento de Intervalos de Alta Intensidad (HIIT) implica ráfagas cortas de ejercicio intenso alternadas con períodos de recuperación de baja intensidad. Es el secreto para lograr más en menos tiempo.</p>
<h3>Por Qué Funciona el HIIT:</h3>
<ul>
  <li><strong>Eficiente en Tiempo:</strong> Obtén los beneficios de un entrenamiento más largo en solo 15-20 minutos.</li>
  <li><strong>Quema Más Calorías:</strong> El HIIT puede quemar más calorías que el cardio tradicional, tanto durante como después del entrenamiento (el "efecto postcombustión").</li>
  <li><strong>Mejora la Salud del Corazón:</strong> Llevar tu ritmo cardíaco a la zona anaeróbica mejora su eficiencia y fuerza.</li>
</ul>
<p>Un ejemplo de entrenamiento HIIT podría ser 30 segundos de sprints seguidos de 60 segundos de caminata, repetido de 8 a 10 veces. Puedes aplicar este principio al ciclismo, la natación o los ejercicios con peso corporal.</p>`,
    category: 'salud física',
    imageUrl: getImage('article-4').url,
    imageHint: getImage('article-4').hint,
    author: 'Dra. Elena Vance',
    authorImageUrl: getImage('author-1').url,
    authorImageHint: getImage('author-1').hint,
    date: '28 de mayo de 2024',
    ingredients: [
      "Zapatillas de correr",
      "Cronómetro",
      "Toalla",
      "Botella de agua"
    ]
  },
  {
    id: '5',
    title: 'Cómo Enseñar a los Niños Sobre el Dinero',
    excerpt: 'Nunca es demasiado pronto para empezar a enseñar educación financiera. Aquí hay formas apropiadas para cada edad de hablar con tus hijos sobre el dinero.',
    content: `<p>La educación financiera es una habilidad vital fundamental. Al introducir conceptos temprano, puedes preparar a tus hijos para una vida de bienestar financiero.</p>
<h3>Guía por Edades:</h3>
<ul>
  <li><strong>De 3 a 5 años:</strong> Introduce el concepto de dinero y monedas. Usa un frasco transparente para los ahorros para que puedan verlo crecer.</li>
  <li><strong>De 6 a 10 años:</strong> Introduce el concepto de una paga por tareas. Ayúdalos a dividir su dinero en frascos de "Ahorrar", "Gastar" y "Compartir".</li>
  <li><strong>De 11 a 13 años:</strong> Ábreles una cuenta de ahorros. Discute las necesidades frente a los deseos y la importancia de la gratificación postergada.</li>
  <li><strong>De 14 a 18 años:</strong> Habla sobre conceptos como el interés compuesto, el crédito y los préstamos estudiantiles. Considera ayudarlos a conseguir un trabajo a tiempo parcial.</li>
</ul>
<p>Lo más importante es ser abierto y honesto sobre el dinero. Deja que te vean tomando decisiones financieras inteligentes.</p>`,
    category: 'finanzas familiares',
    youtubeUrl: 'https://www.youtube.com/watch?v=l_8I3C_L1e4',
    imageUrl: getImage('article-5').url,
    imageHint: getImage('article-5').hint,
    author: 'Sofía Rodríguez',
    authorImageUrl: getImage('author-3').url,
    authorImageHint: getImage('author-3').hint,
    date: '25 de mayo de 2024',
    featured: true,
    ingredients: [
      "Huchas transparentes (3)",
      "Monedas de juguete o reales",
      "Libreta de ahorro infantil"
    ]
  },
  {
    id: '6',
    title: 'El Poder de Escribir un Diario para la Claridad Mental',
    excerpt: 'Poner tus pensamientos en papel puede ser una forma simple pero profunda de manejar la ansiedad y entender tus emociones.',
    content: `<p>Escribir un diario es una forma de autocuidado que no requiere más que un bolígrafo y papel. Proporciona un espacio seguro para explorar tus pensamientos y sentimientos sin temor al juicio.</p>
<h3>Cómo Empezar a Escribir un Diario:</h3>
<ul>
  <li><strong>No lo Pienses Demasiado:</strong> Simplemente empieza a escribir. No tiene que ser perfecto. Usa viñetas, dibuja o escribe libremente.</li>
  <li><strong>Prueba con Indicaciones:</strong> Si estás atascado, usa una indicación. "¿De qué estoy agradecido hoy?" o "¿Qué me pesa actualmente en la mente?" son excelentes puntos de partida.</li>
  <li><strong>Conviértelo en un Hábito:</strong> Intenta reservar unos minutos cada día, quizás por la mañana o antes de acostarte, para escribir en tu diario.</li>
</ul>
<p>Escribir un diario regularmente puede ayudarte a identificar patrones en tu pensamiento, procesar eventos difíciles y cultivar una perspectiva más positiva de la vida.</p>`,
    category: 'salud mental',
    imageUrl: getImage('article-6').url,
    imageHint: getImage('article-6').hint,
    author: 'Mark Chen',
    authorImageUrl: getImage('author-2').url,
    authorImageHint: getImage('author-2').hint,
    date: '20 de mayo de 2024',
    ingredients: [
      "Cuaderno bonito",
      "Bolígrafo de gel",
      "Vela relajante (opcional)"
    ]
  },
  {
    id: '7',
    title: 'Estiramientos Esenciales para Mejorar la Flexibilidad en 15 Minutos',
    excerpt: 'Una serie de estiramientos rápidos y seguros para incorporar al final del día o después del ejercicio.',
    content: `<p>La flexibilidad es clave para prevenir lesiones y mantener una buena movilidad a lo largo de la vida. Estos estiramientos están diseñadas para trabajar los principales grupos musculares y se pueden realizar en 15 minutos.</p>
<h3>Rutina de 15 minutos:</h3>
<ol>
  <li><strong>2 minutos:</strong> Respiración diafragmática y calentamiento ligero (caminar en el sitio).</li>
  <li><strong>3 minutos:</strong> Estiramiento de isquiotibiales (sentado, una pierna estirada).</li>
  <li><strong>3 minutos:</strong> Estiramiento de cuádriceps (de pie, llevar talón a glúteo).</li>
  <li><strong>3 minutos:</strong> Aperturas de cadera / estiramiento de piriforme (posición de mariposa o figura 4).</li>
  <li><strong>2 minutos:</strong> Estiramiento de pecho y hombros (puerta o brazo cruzado)</li>
  <li><strong>2 minutos:</strong> Flexión de columna y estiramiento de lumbares (gato-vaca o inclinación hacia delante apoyando manos).</li>
</ol>
<p>Haz cada estiramiento de forma controlada, manteniendo la postura sin rebotes durante 20-40 segundos por lado. Adapta la intensidad según tu nivel y, si sientes dolor agudo, detente y consulta con un profesional.</p>`,
    category: 'salud física',
    imageUrl: getImage('article-7').url,
    imageHint: getImage('article-7').hint,
    author: 'Dr. Carlos Méndez',
    authorImageUrl: getImage('author-4').url,
    authorImageHint: getImage('author-4').hint,
    date: '11 de octubre de 2025',
  },
  {
    id: '8',
    title: 'PROBANDO TITULO',
    excerpt: 'EXCERPT_AQUI AQUÍ PROBANDO QUE ES EXCERPT (resumen corto)',
    content: `<p>AQUÍ ES DONDE VA A IR EL CONTENIDO (HTML o texto)</p>`,
    category: 'salud física',
    imageUrl: getImage('article-8').url,
    imageHint: getImage('article-8').hint,
    author: 'PROBANDO NOMBRE AUTOR',
    authorImageUrl: getImage('author-4').url,
    authorImageHint: getImage('author-4').hint,
    date: '12 de junio de 2024',
    featured: false,
  },
];

export const allArticles: Article[] = articles.map((article) => ({
  ...article,
  slug: slugify(article.title),
}));

export const categories: ArticleCategory[] = ['salud física', 'salud mental', 'finanzas familiares'];
