# Mi Biblioteca — lector personal de PDFs

App web (sin instalación de tienda, sin backend, sin cuentas) para
importar tus propios libros en PDF y leerlos con el mismo lector que
hicimos para "Los juegos del hambre": fondo y tipografía a tu gusto,
tamaño de letra ajustable sin distorsionar el texto, giro de página en
3D con el dedo, índice y marcadores.

## Cómo se decide texto o imágenes, por libro

Cada vez que importas un PDF, la app lo analiza automáticamente:

- Si tiene **texto real** (la mayoría de libros descargados o
  convertidos), lo reconstruye como texto HTML reflowable — igual que
  se hizo a mano con "Los juegos del hambre", pero ahora de forma
  automática para cualquier PDF. Detecta los títulos de capítulo por
  su tamaño de letra más grande, y arma el índice con ellos.
- Si el PDF es un **escaneo** (fotos de páginas, sin texto
  seleccionable), en vez de forzar una mala extracción, guarda cada
  página como imagen optimizada y las muestra centradas sobre fondo
  negro, con zoom táctil (pellizcar con dos dedos).

**Nota honesta sobre el detector de capítulos:** con "Los juegos del
hambre" el índice fue perfecto porque revisé el PDF a mano. Aquí, para
que funcione con *cualquier* libro que importes, la detección de
capítulos es automática (se basa en qué tan grande es la letra del
título comparada con el resto del texto). Con la mayoría de novelas
funciona bien; con PDFs de diseño más inusual puede que no detecte
algún título, o marque alguno de más — el texto en sí nunca se pierde
ni se corta, solo el índice puede no ser perfecto en esos casos.

## Estructura de archivos

```
mi-biblioteca/
├── index.html            ← ábrelo para usar la app
├── manifest.json          ← permite "instalarla" en el teléfono
├── icons/                 ← ícono de la app
├── css/style.css
└── js/
    ├── db.js               ← guarda todo en el propio dispositivo (IndexedDB)
    ├── pdf-extract.js       ← analiza cada PDF que importas
    ├── paginator.js         ← ajusta el texto a la pantalla, página por página
    ├── page-turn.js         ← animación del giro de página
    ├── reader.js             ← pantalla de lectura
    ├── library.js            ← pantalla de biblioteca
    └── app.js                 ← arranque general y ajustes de apariencia
```

**Todo lo que importas se queda en el dispositivo de cada persona.**
No hay servidor propio ni de terceros guardando tus libros — cada
quien importa los suyos desde su propio teléfono o computadora.

## Cómo probarla en Windows

1. Descomprime la carpeta `mi-biblioteca`.
2. Abre `index.html` haciendo doble clic (o arrástralo a Chrome/Edge).
3. Toca el botón **+** y elige un PDF de tu computadora.
4. Espera a que termine de analizarlo (verás una barra de progreso) —
   toca el libro en la biblioteca para empezar a leer.
5. Prueba también el ícono de engranaje ⚙ arriba, en la biblioteca:
   ahí eliges color de fondo, tipografía y tamaño de letra por
   defecto para todos tus libros.

> Nota: la primera vez que abras la app necesitas conexión a
> internet, porque usa una librería (`pdf.js`) que se carga desde
> internet para poder leer los PDF. Los libros que ya importaste se
> guardan en tu dispositivo; para seguir leyéndolos más adelante,
> igual conviene tener conexión al menos un momento para que esa
> librería cargue (el navegador normalmente la deja en caché).

## Leer sin conexión (por ejemplo, en un viaje)

La app ya incluye lo necesario para esto: una vez que la abriste **al
menos una vez con internet** (y, sobre todo, una vez que la instalaste
desde su enlace de GitHub Pages — ver más abajo), el propio navegador
guarda la app completa en el dispositivo. Después de eso:

- **Abrir la app y leer los libros que ya importaste funciona sin
  ninguna conexión** — el texto, las imágenes de páginas escaneadas,
  los marcadores y el progreso de lectura viven todos en el propio
  dispositivo (`IndexedDB`), no en internet.
- **Importar un libro nuevo sigue necesitando internet** (como
  hablamos, es inevitable: se usa una librería externa para leer el
  PDF). Si intentas importar sin conexión, la app te avisa con un
  mensaje en vez de fallar sin explicación.

Este modo sin conexión funciona una vez que la app está publicada en
`https://` (por ejemplo, en GitHub Pages) — no funciona si solo abres
`index.html` localmente con doble clic, porque ese modo requiere una
conexión segura (`https`) para activarse. Para probarlo: sube la app
(ver el paso siguiente), ábrela una vez desde el enlace con internet,
importa un libro, y luego prueba a abrirla de nuevo en modo avión.


## Cómo subirla a GitHub Pages (para instalarla en un iPhone/Android)

Mismos pasos que ya usaste con el lector de "Los juegos del hambre":

```
git init
git add .
git commit -m "Mi Biblioteca"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mi-biblioteca.git
git push -u origin main
```

Luego, en GitHub: **Settings → Pages → Source: Deploy from a branch →
main / (root) → Save**. En 1-2 minutos tendrás un enlace como:

```
https://TU-USUARIO.github.io/mi-biblioteca/
```

## Cómo "instalarla" como app en el teléfono

**iPhone (Safari):**
1. Abre el enlace en Safari.
2. Toca el ícono de compartir (el cuadrado con flecha hacia arriba).
3. Elige **"Agregar a pantalla de inicio"**.

**Android (Chrome):**
1. Abre el enlace en Chrome.
2. Toca el menú (⋮) → **"Agregar a pantalla de inicio"** o
   **"Instalar aplicación"** (Chrome a veces lo ofrece solo, con un
   banner).

En ambos casos queda un ícono como cualquier otra app, a pantalla
completa, sin la barra del navegador. Cada persona que la instale así
tiene su propia biblioteca local, separada de la tuya.

## Límites que debes conocer

- No hay forma de "compartir" un libro ya importado entre
  dispositivos automáticamente — cada quien importa su propio PDF
  (fue justo lo que pediste).
- PDFs muy grandes (varios cientos de páginas escaneadas) pueden
  tardar bastante en importarse la primera vez, porque cada página se
  convierte a imagen dentro del propio teléfono.
- Si en algún momento quieres una app 100% nativa (con ícono propio en
  la App Store, notificaciones, etc.), este proyecto web serviría como
  base funcional, pero habría que reconstruir la parte de interfaz en
  Flutter o React Native — igual que hablamos antes, eso ya no lo
  puedo compilar yo aquí mismo.
