# Generador de carruseles · Entrena Your Life

Plantilla de marca (1080x1350): portada y cierre en oscuro con degradado verde, interiores en crema (#F4EFE4),
verde #2FE36F (oscuro) / #12AA52 (crema), cabecera «EYL | ENTRENA YOUR LIFE», pie «ENTRENO INTELIGENTE. / RESULTADOS REALES.».

Uso: `python3 gen.py <carpeta_salida> semanaN.json` (necesita Playwright con Chromium y la fuente Inter).

Tipos de slide en el JSON: cover, text, checks, steps, diag, table, cols, cal, close.
Extras: `save` (sello GUÁRDALO), `shot` + `shotw` + `hint` (captura de la app en un móvil), `[palabras]` en verde.

Las imágenes finales van a `instagram/<tema>/01.png…08.png` (¡dentro de `instagram`, no en «instagram 2»!)
y se programan en Metricool con `https://migueli21.github.io/entrena/instagram/<tema>/NN.png`.
