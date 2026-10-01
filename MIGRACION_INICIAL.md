# Migración inicial

## Maestro de colaboradores

Fuente: `Book(1).xlsx`.

- Registros con código de empleado informado: 50.
- Códigos únicos encontrados: 47.
- Colaboradores incluidos en la carga inicial: 46.
- Código excluido por duplicidad: `281971`.
- Personas asociadas al código duplicado y por tanto no cargadas automáticamente:
  - Melany Mireya Enriquez Onofa
  - María Emilia Moreno Pazmiño
  - Danny Patricio Parra Alvarez
  - Dayanna Camila Galindo Jaramillo

La exclusión es intencional: el código de empleado se maneja como identificador único y no se inventaron valores sustitutos.

## Horas / T2

La carga inicial solo incorpora registros agregados de horas que tienen una guardia T1 coincidente para el mismo colaborador y fecha dentro del conjunto procesado.

- Registros agregados de horas elegibles: 56.
- Registros de horas omitidos por no encontrar T1 coincidente: 15.

Esto aplica la regla de negocio acordada: una persona que no estaba asignada a guardia no puede generar pago de T2.
