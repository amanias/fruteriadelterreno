import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

const ENTRADA_DIR = 'img/sugerencias';
const IMG_DIR = 'img';
const HTML_FILE = 'index.html';

async function main() {
  // 1. Buscar la foto nueva y el archivo de texto en img/sugerencias/
  const archivos = await fs.readdir(ENTRADA_DIR);
  const fotoArchivo = archivos.find((f) => /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f));
  const textoArchivo = archivos.find((f) => f === 'descripcion.txt');

  if (!fotoArchivo) {
    console.log('No hay foto nueva en img/sugerencias/. Saliendo.');
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
      altoFinal = infoJpg.height;
      await fs.copyFile(
        path.join(IMG_DIR, 'sugerencia-del-dia-1204.jpg'),
        path.join(IMG_DIR, 'sugerencia-del-dia.jpg')
      );
    }
  }

  // 4. Actualizar index.html
  const htmlOriginal = await fs.readFile(HTML_FILE, 'utf-8');
  const $ = cheerio.load(htmlOriginal, { decodeEntities: false });

  // Párrafo visible con sus emojis intactos
  $('#fruteria-sugerencia').text(descripcion);

  // Construir un alt seguro y coherente para SEO
  const textoSinEmojis = descripcion
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const altFinal = textoSinEmojis.length >= 10
    ? `Sugerencia del día: ${textoSinEmojis}`
    : 'Sugerencia del día en Frutería del Terreno';

  const $img = $('#fruteria-foto img');
  $img.attr('alt', altFinal);
  $img.attr('width', String(anchoFinal));
  $img.attr('height', String(altoFinal));

  await fs.writeFile(HTML_FILE, $.html(), 'utf-8');

  // 5. Borrar los archivos temporales de img/sugerencias/
  await fs.unlink(rutaFoto);
  if (textoArchivo) {
    await fs.unlink(path.join(ENTRADA_DIR, textoArchivo));
  }

  console.log(`Actualizado y limpiado: ${anchoFinal}x${altoFinal} - "${altFinal}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});