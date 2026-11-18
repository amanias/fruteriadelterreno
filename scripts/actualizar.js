import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

const ENTRADA_DIR = 'img/sugerencias';
const IMG_DIR = 'img';
const HTML_FILE = 'index.html';

async function main() {
  const archivos = await fs.readdir(ENTRADA_DIR);
  const fotoArchivo = archivos.find((f) => /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f));
  const textoArchivo = archivos.find((f) => f === 'descripcion.txt');

  if (!fotoArchivo && !textoArchivo) {
    console.log('No hay archivos nuevos en img/sugerencias/. Saliendo.');
    return;
  }

  let anchoFinal = null;
  let altoFinal = null;

  // 1. Si hay foto nueva, generar las 7 variantes y borrar la original de entrada
  if (fotoArchivo) {
    const rutaFoto = path.join(ENTRADA_DIR, fotoArchivo);
    const imagenBase = sharp(rutaFoto).rotate();
    const tamanos = [480, 960, 1204];

    for (const ancho of tamanos) {
      await imagenBase
        .clone()
        .resize({ width: ancho, withoutEnlargement: false })
        .avif({ quality: 65 })
        .toFile(path.join(IMG_DIR, `sugerencia-del-dia-${ancho}.avif`));

      const infoJpg = await imagenBase
        .clone()
        .resize({ width: ancho, withoutEnlargement: false })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(IMG_DIR, `sugerencia-del-dia-${ancho}.jpg`));

      if (ancho === 1204) {
        anchoFinal = infoJpg.width;
        altoFinal = infoJpg.height;
        await fs.copyFile(
          path.join(IMG_DIR, 'sugerencia-del-dia-1204.jpg'),
          path.join(IMG_DIR, 'sugerencia-del-dia.jpg')
        );
      }
    }

    await fs.unlink(rutaFoto);
  }

  // 2. Actualizar index.html respetando el alt original
  const htmlOriginal = await fs.readFile(HTML_FILE, 'utf-8');
  const $ = cheerio.load(htmlOriginal, { decodeEntities: false });

  if (textoArchivo) {
    const rutaTexto = path.join(ENTRADA_DIR, textoArchivo);
    const contenido = await fs.readFile(rutaTexto, 'utf-8');
    if (contenido.trim()) {
      $('#fruteria-sugerencia').text(contenido.trim());
    }
    await fs.unlink(rutaTexto);
  }

  if (anchoFinal && altoFinal) {
    const $img = $('#fruteria-foto img');
    $img.attr('width', String(anchoFinal));
    $img.attr('height', String(altoFinal));
  }

  await fs.writeFile(HTML_FILE, $.html(), 'utf-8');

    // 3. Actualizar la versión de caché en service-worker.js
  const swPath = 'service-worker.js';
  const swContenido = await fs.readFile(swPath, 'utf-8');
  const marcaTiempo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
  }).format(new Date()).replace(/[-: ]/g, '');
  const swActualizado = swContenido.replace(
    /const CACHE_NAME = "fruteria-del-terreno-[^"]+";/,
    `const CACHE_NAME = "fruteria-del-terreno-${marcaTiempo}";`
  );
  await fs.writeFile(swPath, swActualizado, 'utf-8');

  console.log('Actualización completada y carpeta img/sugerencias limpia.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});