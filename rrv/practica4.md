1

PRÁCTICA 4
Implementación de un
Sistema Nacional de
Cómputo Electoral (Bolivia)

Contexto

El Órgano Electoral Plurinacional requiere diseñar e implementar un sistema
distribuido capaz de procesar los resultados de elecciones nacionales en Bolivia. El
sistema debe garantizar rapidez en la difusión de resultados preliminares y
rigurosidad en el cómputo oﬁcial, considerando condiciones reales de
infraestructura, conectividad limitada y alta demanda concurrente.

Se dispone de:

●  5.368 recintos electorales
●  35.000 mesas electorales

No todos los recintos cuentan con conectividad estable, por lo que el sistema
debe contemplar mecanismos alternativos de transmisión de datos, incluyendo
mensajería SMS.

Objetivo

Diseñar e implementar una arquitectura de sistemas distribuidos basada en
dos pipelines desacoplados, que permitan:

1.  Procesar resultados preliminares en tiempo real (Recuento Rápido de

Votos - RRV)

2.  Generar resultados oﬁciales auditables (Cómputo Oﬁcial)
3.  Comparar ambos resultados mediante un sistema de visualización analítica

(dashboard)

Descripción del Problema

El sistema deberá implementar dos ﬂujos independientes pero coherentes:

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

2

1. Sistema RRV (Recuento Rápido de Votos)

Entrada: Fotografías de actas electorales enviadas desde recintos

Procesamiento

●  Procesamiento de imágenes
●  Extracción de datos mediante OCR
●  Validaciones básicas (estructura, duplicados simples)

Almacenamiento  en un clúster de base de datos a elección (relacional o no
relacional) justiﬁcando la elección del motor. Este cluster debe siempre estar
sincronizado. y en cuanto uno caiga debe levantarse automáticamente el/los
otros

 Características

●  Baja latencia
●  Consistencia eventual
●  Procesamiento en tiempo real

Uso

●  Publicación de resultados preliminares
●  Visualización pública temprana

2. Sistema de Cómputo Oﬁcial

Entrada

●  Se proporcionará un archivos CSV con la transcripción de todas las actas
●  Se desarrollará una aplicación cliente (Consola/Windows Forms/Web)
●
●

Integración mediante herramientas de automatización (ej: n8n)

Procesamiento

●  Validación rigurosa de datos
●  Control de consistencia
●  Registro de auditoría
●  Validación cruzada

Almacenamiento

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

3

●  Base de datos (relacional / no relacional)
●  Persistencia orientada a auditoría (eventos)

Características

●  Alta exactitud
●  Consistencia fuerte
●  Trazabilidad completa

Uso  generación de resultados oﬁciales vinculantes

Integración y Comparación

Ambos sistemas deben ser integrados en un Dashboard Analítico, el cual
permita:

●  Comparar resultados entre RRV y cómputo oﬁcial
●  Detectar inconsistencias
●  Visualizar métricas e indicadores clave

El Dashboard debe incluir como mínimo:

1) Métricas (datos crudos)

●  Participación electoral
●  Total de votos (válidos, nulos, blancos)
●  Votos por candidato
●  Estado de actas (recibidas, procesadas, pendientes)

2) Indicadores (KPIs)

●  Tasa de participación
●  Porcentaje por candidato
●  Margen de victoria
●  Velocidad de procesamiento
●  Diferencias entre conteo rápido y oﬁcial

3) Análisis geográﬁco

●  Resultados por región
●  Mapas de calor

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

4

●  Distribución territorial del voto

4) Transparencia

●  % de actas publicadas
●  Trazabilidad del procesamiento
●  Acceso a actas digitalizadas

5) Indicadores técnicos

●  Latencia
●  Throughput
●  Disponibilidad
●  Seguridad

6) Analítica avanzada (opcional)

●  Detección de anomalías
●  Patrones atípicos
●  Análisis estadístico del voto

Obligatorio

Debido a limitaciones de conectividad:

●  Algunos recintos deberán reportar resultados mediante SMS
●  El sistema debe:

○  Recibir mensajes SMS
○
○

Interpretar el contenido
Integrarlo al ﬂujo de procesamiento para RRV

●

Implementar los mecanismos de seguridad para evitar suplantación  y
calidad de dato

Criterios de Diseño Arquitectónico

La solución debe justiﬁcar e implementar los siguientes patrones:

CQRS (Command Query Responsibility Segregation)

●  Escritura basada en eventos

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

5

●  Lectura optimizada para consultas

 Event Sourcing

●  Persistencia basada en eventos
●  Capacidad de reconstrucción del sistema

Idempotencia

●  Procesamiento seguro de eventos duplicados o inconsistencias. Se

recomienda registrar en Logs

○

Inconsistencia aritmética: Suma de votos por candidatos que no
coincide con el total de "votos válidos" o "votos emitidos".

○  Datos contradictorios: Discrepancia entre el número de ciudadanos

que votaron (según la lista de índice) y el total de papeletas
encontradas en el ánfora.

○  Falta de datos de apertura o cierre: Omisión de la hora exacta de

inicio o ﬁnalización de la jornada electoral en el acta.
○  Acta recibida con anterioridad y no coinciden los datos

Tolerancia a fallos

●  Reintentos automáticos
●  Procesamiento asíncrono
●  Manejo de caídas parciales del sistema

Entregables

Los estudiantes deberán presentar (la base de datos cargada):

50

Implementación funcional RRV (OCR + almacenamiento) Cómputo
oﬁcial (CSV + validación) + Documentación técnica no más de 2 págs y
capturas de pantallas de las partes más importantes de la
implementación

20  Dashboard Visualización de métricas e indicadores y  esquemas de

bases de datos

30  Defensa Individual cada estudiante deberá explicar la parte que hizo en

inglés y responder a preguntas técnicas

15

Automatización: n8n o cualquier mecanismo que nos permita
transcripción de datos leyendo desde un archivo csv

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

6

15

Aplicación móvil: que permita la captura de la foto del acta y continúe
con el ﬂujo

Presentacion

Se evaluará:

●  Correcta aplicación de arquitectura distribuida
●  Separación de responsabilidades (RRV vs Oﬁcial)
●  Escalabilidad y resiliencia
●  Visualización y análisis
●  Manejo de escenarios reales (SMS, fallos, duplicados)
●  Decisiones arquitectónicas
●  Problemas encontrados
●  Estrategias de escalabilidad
●  Capturas de pantalla de ambos ﬂujos

Nota ﬁnal

El enfoque de esta práctica no es solo programar, sino pensar como arquitectos
de sistemas distribuidos, diseñando soluciones que operen bajo condiciones
reales de un país; el project manager tendrá una evaluación de 50% y la defensa
será en inglés.

Recursos

https://docs.google.com/spreadsheets/d/1aJk5lt17I0pSHJpq8cjJuLnDXONwPy
FJySitKyDJnQA/edit?usp=sharing

CodigoDistribucionTerritorial  Departamento

Municipio

Provincia

10101

10102

10103

10201

10202

Chuquisaca

Chuquisaca

Chuquisaca

Chuquisaca

Chuquisaca

Oropeza

Oropeza

Oropeza

Azurduy

Azurduy

Sucre

Yotala

Poroma

Azurduy

Tarvita

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

7

CodigoRecin
toElectoralD

CodigoDistribuci
onTerritorial

RECINTO ELECTORAL

DIRECCIÓN

10101

U. E. Santa Mónica

1

2

3

4

5

Calle Achanq’ara entre las calles Chariña
y Qoyllur, OTB Ticti Norte

Se encuentra sobre la carretera
cochabamba a Santa Cruz km 150,
sindicato agrario Padresama

U. E. Padresama

10102

10103

U.E. Lacolaconi

Lacolaconi

10201

U.E. Genoveva Ríos

Calle Los Robles entre Av. Segunda
Circunvalación y Calle Sófocles

10202

U.E. 27 de Mayo

René Barrientos Ortuño

CodigoMesa

Nro Mesa

CantidadHabilitada

CodigoRecintoElectoralD

35000

34999

34998

34997

34996

34995

1

2

3

4

5

6

589

538

259

524

992

808

10101

10102

10103

10201

10202

10301

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

8

Banco de consultas elecciones

1. Cantidad de mesas por recinto y departam

ento

Departamento

Recinto

Cantidad de Mesas

La Paz

La Paz

Colegio Ayacucho

Liceo Venezuela

Santa Cruz

U.E. San Martin

Cochabamba

Colegio Alemán

12

8

15

10

2. Registro de votos (los que están en ánfora) por municipio

Departamento  Municipio

Total Votos

La Paz

El Alto

345,000

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

9

Santa Cruz

Warnes

120,000

Tarija

Yacuiba

95,000

3. Cantidad de votos por departamento

Departamento

Votos Totales

La Paz

1,200,000

Santa Cruz

1,500,000

Cochabamba

980,000

4. Top 5 recintos con más votos para X partido

Partido

Recinto

Votos

P1

P1

P1

P1

P1

Colegio Ayacucho  5,400

Liceo Venezuela

5,300

San Martín

Don Bosco

Juan XXIII

5,250

5,100

5,000

5. Votos nulos por departamento y el % en relación al total de validos

Departamento

Votos Nulos

%

La Paz

35,000

Santa Cruz

42,000

Oruro

12,000

17.50

18.77

44.10

6. Listado de boletas anuladas en el TREP

ID Boleta

Recinto

Mesa

Motivo de Anulación

120054

Colegio Ayacucho  4

Error en cantidad de boletas no usadas

130902

Don Bosco

145678

Liceo Venezuela

6

2

Error en número de votos nulos

Error en la legibilidad de datos

7. Cantidad de votos totales TREP vs Oficial

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

10

Fuente

Votos
Totales

TREP

7,200,000

Oficial

7,180,000

 8. Total de votos por candidato (TREP vs Oficial)

Candidato

TREP

Oficial

MASISP

3,500,000

3,495,000

Partido2

2,800,000

2,810,000

Partido3

900,000

875,000

9. Votos nulos, blancos, Válidos pero no blancos y Total  por
departamento

Departamento

Votos Nulos

Votos Blancos

Por
Candidatos

(Válidos - Blancos)

Total

Beni

Pando

10,000

5,000

7,000

3,000

100000

1001700

20000

20300

10. Centros de votación activos y cantidad de actas enviadas por cada
recinto electoral

ID Centro

Nombre del Centro

Departamento

Actas

10301

U.E. San Martín

Santa Cruz

10404

Colegio Nacional Sucre  La Paz

8

12

11. Mesas con >20% de abstención (Ciudadanos que no fueron a votar)

Departamento

Recinto

Mesa  Abstención (%)

Cochabamba

U.E. Ayacucho  3

23.5%

La Paz

Don Bosco

5

21.1%

12. Actas TREP | OFICIAL  recibidas en el centro de cómputo en un
periodo de tiempo por hora ( o por minuto o por segundo )

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

11

Hora

Actas Recibidas

18:00-19:00

19:00-20:00

20:00-21:00

1,200

2,300

1,800

13. Porcentaje de actas recibidas anuladas en el trep vs Oficial por
departamento

Departamento

Total actas
anuladas trep

Total actas
anuladas Oficial

% Anulación
TREP

% Anulación
Oficial

La Paz

1,200,000

1,352,652

Santa Cruz

1,500,000

16,875,52

Cochabamba

980,000

1,200,141

19.4%

14.6%

16.1%

19.5%

15.2%

18.3%

14. Tiempo promedio entre cierre y recepción de la votación oficial entre
la recepción de la primera y la última acta de cada departamento

Recinto

Primera Acta

Última Acta

La Paz

18/04/2024 10:18:16

18/04/2024 11:18:16

Santa Cruz

18/04/2024 9:18:16

18/04/2024 16:18:16

Tiempo
Promedio (min)

45

152

15. Haga una consulta que nos permita saber el % de confiabilidad del
TREP vs el Oficial (Justifique que factores tomo )

Fuente

TREP

OFICIAL

% de confianza

98.99

99.16

16. Porcentaje de participación ciudadana por departamento

Departamento  Participación (%)

La Paz

78.5%

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

12

Santa Cruz

82.1%

Tarija

75.3%

17. Actas inconsistentes entre TREP y Oficial (Diff = Oficial - TREP) es la
diferencia entre todos los campos que se leen tanto de las actas como
del transcriptor

ID Acta

Fuente

Diff field1

Dif field2

Diff fieldN

789010

TREP

789022

OFICIAL

-1

+5

2

-1

11

2

18. Cantidad de MegaBytes utilizados por PDF recibidos por
departamento y número de archivos (sin importar si fueron actas validas
o invalidas)

Recinto

Archivos PDF

Tamaño PDF (MB)

Santa Cruz

1523

La Paz

1426

Cochabamba

1254

3500

4202

30533

19. Resultados por departamento, municipio o provincia (input
específico departamento, municipio o provincia)

(Ejemplo: Municipio: El Alto)

Candidato

Total
Votos

Provincia 1

150,000

Provincia  2

120,000

Provincia 3

30,000

20. Error más común en verificación de PDFs o transcripción de datos

Tipo de Error

Frecuencia

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

13

Error en Cantidad de ciudadanos habilitados

1,200

Error en Votos Válidos

Error Cantidad de boletas en ánfora

980

540

Sistemas Distribuidos
Practica 3: Sincronización de Procesos

