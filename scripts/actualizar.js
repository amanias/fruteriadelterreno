import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

const ENTRADA_DIR = 'img/sugerencias';
const IMG_DIR = 'img';
const HTML_FILE = 'index.html';

async function main() {
  // 1. Buscar la foto nueva y el archivo de texto en la carpeta entrada/
  const archivos = await fs.readdir(ENTRADA_DIR);
  const fotoArchivo = archivos.find((f) => /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f));
  const textoArchivo = archivos.find((f) => f === 'descripcion.txt');

  if (!fotoArchivo) {
    console.log('No hay foto nueva en entrada/. Saliendo.');
    return;
  }

  const rutaFoto = path.join(ENTRADA_DIR, fotoArchivo);
  let descripcion = 'Sugerencia del día en Frutería del Terreno';

  if (textoArchivo) {
    const contenido = await fs.readFile(path.join(ENTRADA_DIR, textoArchivo), 'utf-8');
    if (contenido.trim()) descripcion = contenido.trim();
  }

  // 2. Preparar la imagen base (corrige rotación automática del móvil)
  const imagenBase = sharp(rutaFoto).rotate();

  // 3. Generar los 3 tamaños (480, 960, 1204) en AVIF y JPG
  const tamanos = [480, 960, 1204];
  let anchoFinal = 1204;
  let altoFinal = 1599;

  for (const ancho of tamanos) {
    // Guardar AVIF
    await imagenBase
      .clone()
      .resize({ width: ancho, withoutEnlargement: false })
      .avif({ quality: 65 })
      .toFile(path.join(IMG_DIR, `sugerencia-del-dia-${ancho}.avif`));

    // Guardar JPG
    const infoJpg = await imagenBase
      .clone()
      .resize({ width: ancho, withoutEnlargement: false })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(IMG_DIR, `sugerencia-del-dia-${ancho}.jpg`));

    // Si es la versión de 1204px, guardamos también la copia base y sus dimensiones reales
    if (ancho === 1204) {
      altoFinal = infoJpg.height;
      await fs.copyFile(
        path.join(IMG_DIR, 'sugerencia-del-dia-1204.jpg'),
        path.join(IMG_DIR, 'sugerencia-del-dia.jpg')
      );
    }
  }

  // 4. Actualizar index.html manteniendo toda tu estructura intacta
  const htmlOriginal = await fs.readFile(HTML_FILE, 'utf-8');
  const $ = cheerio.load(htmlOriginal, { decodeEntities: false });

  // Actualizar párrafo visible con sus emojis
  $('#fruteria-sugerencia').text(descripcion);

  // Limpiar emojis para el atributo alt (mejor SEO y accesibilidad)
  const altLimpio = descripcion.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ' ').replace(/\s+/g, ' ').trim();

  // Actualizar atributos de la imagen
  const $img = $('#fruteria-foto img');
  $img.attr('alt', altLimpio || 'Sugerencia del día en Frutería del Terreno');
  $img.attr('width', String(anchoFinal));
  $img.attr('height', String(altoFinal));

  await fs.writeFile(HTML_FILE, $.html(), 'utf-8');
  console.log(`Actualizado: ${anchoFinal}x${altoFinal} - "${descripcion}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});