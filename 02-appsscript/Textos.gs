/**
 * Textos fijos del informe — copiados literalmente de run_engine.py:327-479.
 *
 * Separados del armado para que Documento.gs se lea como la estructura del
 * informe y no como un muro de prosa. Son textos de uso profesional: se
 * transcriben tal cual, no se reescriben ni se corrigen de estilo.
 */

/** Nombres de las dimensiones NEO en la tabla cuantitativa. */
var NEO_NOMBRES_TABLA = {
  N: 'Neuroticismo (N)',
  E: 'Extraversión (E)',
  O: 'Apertura (O)',
  A: 'Amabilidad (A)',
  C: 'Responsabilidad (C)'
};

/** Última columna de la tabla NEO. */
var NEO_INTERPRETACION_BREVE = {
  N: 'Nivel de reactividad emocional y vulnerabilidad al estrés.',
  E: 'Sociabilidad, energía y orientación al contacto interpersonal.',
  O: 'Apertura a la novedad, creatividad y flexibilidad intelectual.',
  A: 'Orientación prosocial, cooperación y empatía interpersonal.',
  C: 'Organización, planificación y orientación al logro.'
};

/** Nombres de las dimensiones NEO en la sección cualitativa. */
var NEO_NOMBRES = {
  N: 'Neuroticismo',
  E: 'Extraversión',
  O: 'Apertura a la Experiencia',
  A: 'Amabilidad',
  C: 'Responsabilidad (Conscientiousness)'
};

/** Interpretación tendencial por dimensión y nivel. */
var NEO_TEXTOS = {
  N: {
    'Muy Alto': 'Alta tendencia a la reactividad emocional y el malestar psicológico. Puede experimentar ansiedad, irritabilidad y dificultad para manejar el estrés de forma sostenida. Para un rol de conducción es prioritario desarrollar estrategias activas de regulación emocional y construir redes de apoyo que amortigüen la demanda del puesto.',
    'Alto': 'Tendencia moderada-alta a la reactividad emocional. En situaciones de presión prolongada puede mostrar mayor vulnerabilidad al estrés, lo que puede impactar en la toma de decisiones y el clima del equipo. Conviene trabajar estrategias de autorregulación como recurso central para sostener el rol.',
    'Promedio': 'Presenta un nivel intermedio de reactividad emocional. Ante situaciones de estrés moderado mantiene la compostura, aunque puede experimentar tensión ante demandas prolongadas o alta incertidumbre. Para un rol de conducción, este nivel sugiere la conveniencia de desarrollar estrategias de autorregulación emocional como recurso preventivo.',
    'Bajo': 'Buen nivel de estabilidad emocional. Generalmente mantiene la calma ante situaciones de presión y no se deja dominar por el estrés cotidiano. Recurso valioso para el rol de conducción, especialmente en contextos de incertidumbre y alta demanda sostenida.',
    'Muy Bajo': 'Alta estabilidad emocional, rasgo notable para roles de conducción. Mantiene la calma incluso bajo presión sostenida, transmite serenidad al equipo y toma decisiones con menor carga emocional. Esta fortaleza permite sostener el rol exigente de liderazgo con consistencia.'
  },
  E: {
    'Muy Alto': 'Persona de muy alta energía social y orientación al contacto. Genera dinamismo y entusiasmo en el equipo. La clave en el liderazgo es canalizar esta energía en escucha activa y sostener la atención a las necesidades individuales de cada colaborador sin perder profundidad en el vínculo.',
    'Alto': 'Persona sociable, enérgica y con marcada orientación al contacto interpersonal. Disfruta del trabajo en equipo, se muestra disponible y activa en la relación con sus colaboradores. Esta característica es una fortaleza central para construir vínculos de confianza y ejercer un liderazgo cercano y participativo.',
    'Promedio': 'Nivel equilibrado de sociabilidad. Puede funcionar con eficacia tanto en tareas individuales como grupales, adaptando su nivel de energía social según el contexto. Cuenta con recursos para el contacto interpersonal sin depender exclusivamente de él para funcionar.',
    'Bajo': 'Tendencia a la introversión. Prefiere los vínculos más selectivos y el trabajo reflexivo. En el liderazgo esto puede traducirse en mayor capacidad de escucha y análisis, aunque conviene fortalecer la visibilidad y la presencia activa ante el equipo para consolidar el rol.',
    'Muy Bajo': 'Marcada orientación introspectiva. Se desenvuelve mejor en entornos de trabajo independiente. Para el liderazgo de equipos será importante desarrollar estrategias activas de comunicación y presencia que requieren un esfuerzo deliberado más allá del estilo natural.'
  },
  O: {
    'Muy Alto': 'Alta apertura a nuevas ideas, creatividad e innovación. Busca activamente la novedad y puede generar un ambiente de experimentación y cambio. En el liderazgo el desafío es equilibrar el impulso innovador con la necesidad de estabilidad y consistencia que el equipo requiere.',
    'Alto': 'Clara apertura a la novedad y las nuevas ideas. Perfil receptivo a la innovación y el cambio. Facilita la adaptación ante nuevos desafíos y la generación de soluciones creativas ante problemas complejos del entorno laboral.',
    'Promedio': 'Equilibrio entre apertura a nuevas ideas y apego a lo conocido. No tiene un perfil marcadamente innovador, aunque se adapta a los cambios con normalidad. Aporta pragmatismo y consistencia: propone cambios cuando los percibe como funcionales, sin buscar la novedad por sí misma.',
    'Bajo': 'Tendencia a preferir lo conocido y probado. Pragmatismo y consistencia como fortalezas: confiable y predecible en entornos estables. En contextos de alta velocidad de cambio puede necesitar apoyo para adaptarse a transformaciones aceleradas.',
    'Muy Bajo': 'Fuerte preferencia por lo establecido y los procedimientos conocidos. Alta consistencia y confiabilidad en entornos estables. En contextos de innovación o cambio organizacional acelerado será importante trabajar la flexibilidad y la tolerancia a la ambigüedad.'
  },
  A: {
    'Muy Alto': 'Alta orientación prosocial y necesidad de armonía. Tendencia a priorizar el bienestar del grupo por encima de la consecución de objetivos. En el liderazgo el riesgo es la complacencia y la dificultad para sostener posiciones y dar feedback negativo. Es importante desarrollar la asertividad como competencia complementaria indispensable.',
    'Alto': 'Fuerte orientación colaborativa y empática. Construye relaciones de alta confianza con el equipo. El desafío es mantener la capacidad de confrontación productiva y la exigencia necesaria para el logro de resultados sin caer en la complacencia.',
    'Promedio': 'Perfil equilibrado entre la orientación prosocial y la asertividad. Puede ser empático/a y cooperativo/a, y también sostener posiciones con firmeza cuando la situación lo requiere. Este balance facilita la gestión de conflictos y la negociación sin caer en la complacencia ni en la confrontación innecesaria.',
    'Bajo': 'Tendencia más asertiva e independiente. Puede sostener posiciones con firmeza y dar feedback directo sin dificultad. El desafío es desarrollar la sensibilidad hacia las necesidades emocionales del equipo para equilibrar el foco en resultados con el clima organizacional.',
    'Muy Bajo': 'Marcada independencia y tendencia a la confrontación directa. Fuerte asertividad que puede generar fricciones en el equipo. Será importante trabajar la empatía y las habilidades de comunicación empática para construir relaciones de confianza sostenibles.'
  },
  C: {
    'Muy Alto': "Alta organización, planificación y orientación al logro. Perfil metódico orientado a la excelencia. El riesgo es el perfeccionismo y la dificultad para delegar o aceptar resultados 'suficientemente buenos'. Conviene desarrollar flexibilidad ante la imperfección y tolerancia al error ajeno.",
    'Alto': 'Clara orientación a la planificación, el orden y el logro. Confiable y consistente en la ejecución de compromisos. Esta característica es una fortaleza para la organización del equipo y el cumplimiento de objetivos con calidad.',
    'Promedio': 'Nivel adecuado de planificación, organización y orientación al logro. Eficiente y confiable sin rasgos de rigidez perfeccionista. Conserva flexibilidad para adaptarse a cambios de planes, lo que lo/la hace apto/a para entornos dinámicos donde la priorización constante es parte del rol.',
    'Bajo': 'Menor énfasis en la planificación sistemática. Mayor flexibilidad y espontaneidad, con menor atención a los detalles formales. En el liderazgo conviene apoyarse en estructuras y herramientas de gestión que compensen la tendencia a la improvisación y aseguren el cumplimiento de compromisos.',
    'Muy Bajo': 'Tendencia marcada a la espontaneidad y menor orientación a la planificación. Puede presentar dificultades en el cumplimiento consistente de compromisos y en la organización sistemática del equipo. Se recomienda desarrollar herramientas de gestión del tiempo y planificación como competencias clave para el rol.'
  }
};

/** Conductas Camino-Meta: rótulo, clave del percentil y glosa fija. */
var CAMIN_CONDUCTAS = [
  ['Conducta Considerada (Apoyo)', 'Cons', 'Atiende activamente las necesidades personales de los colaboradores.'],
  ['Conducta Participativa', 'Part', 'Consulta, escucha e involucra al equipo en las decisiones.'],
  ['Conducta Directiva', 'Dir', 'Comunica expectativas con claridad cuando la situación lo requiere.'],
  ['Conducta Orientada a Metas', 'Or', 'Establece objetivos exigentes y alienta el rendimiento superior.']
];
