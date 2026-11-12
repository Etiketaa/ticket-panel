// Preparación de archivos para adjuntarlos a un mensaje del chat.
//
// Las imágenes se comprimen en el navegador (redimensionado + JPEG) para que el
// payload no viaje gigante. Los documentos se mandan tal cual, con un tope de
// tamaño: el body de Vercel admite 4.5 MB y el base64 engorda ~33%.

/** Lado máximo (en px) de la imagen enviada. */
const MAX_IMAGE_DIM = 1600;
/** Calidad del JPEG generado. */
const IMAGE_QUALITY = 0.8;

/** Tope del archivo adjunto (documento) sin comprimir. */
export const MAX_ADJUNTO_BYTES = 3 * 1024 * 1024;

export type AdjuntoPreparado = {
  /** Data URI lista para mandar en el JSON. */
  dataUri: string;
  fileName: string;
  /** `true` si es una imagen (se muestra miniatura); `false` si es un documento. */
  esImagen: boolean;
  /** MIME del archivo. */
  mimeType: string;
  /**
   * `true` si el archivo ES una imagen pero el navegador no la puede mostrar
   * (HEIC del iPhone en Chrome/Edge). Se sube igual y se muestra como chip
   * descargable, en vez de una miniatura rota.
   */
  noRenderizable?: boolean;
};

// Extensiones de imagen por si el navegador no declara el MIME.
const EXTENSIONES_IMAGEN = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

function leerComoDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

/** Comprime la imagen y la devuelve como data URI. */
async function comprimirImagen(file: File): Promise<AdjuntoPreparado> {
  const original = await leerComoDataUri(file);
  const img = new Image();
  // Si el navegador no puede decodificar la imagen (HEIC del iPhone en
  // Chrome/Edge), se sube el original y se muestra como chip descargable.
  const sinPrevisualizar = {
    dataUri: original,
    fileName: file.name,
    esImagen: false,
    noRenderizable: true,
    mimeType: file.type || 'application/octet-stream',
  };

  return new Promise((resolve) => {
    img.onerror = () => resolve(sinPrevisualizar);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
          const scale = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(img, 0, 0, width, height);
        resolve({
          dataUri: canvas.toDataURL('image/jpeg', IMAGE_QUALITY),
          fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          esImagen: true,
          mimeType: 'image/jpeg',
        });
      } catch {
        resolve(sinPrevisualizar);
      }
    };
    img.src = original;
  });
}

/**
 * Prepara cualquier archivo para adjuntarlo: las imágenes se comprimen, los
 * documentos se mandan tal cual (con tope de tamaño).
 *
 * El backend valida el tipo REAL mirando los bytes, no el nombre ni el MIME
 * que declara el navegador.
 */
export async function prepararAdjunto(file: File): Promise<AdjuntoPreparado> {
  const pareceImagen =
    file.type.startsWith('image/') || (!file.type && EXTENSIONES_IMAGEN.test(file.name));

  if (pareceImagen) {
    const imagen = await comprimirImagen(file);
    // La compresión puede fallar (HEIC, canvas no disponible): en ese caso
    // queda la original, que puede no entrar en el body de la request.
    verificarTamanio(imagen.dataUri, imagen.noRenderizable === true);
    return imagen;
  }

  if (file.size > MAX_ADJUNTO_BYTES) {
    throw new Error(
      `El archivo es demasiado grande (máximo ${Math.round(MAX_ADJUNTO_BYTES / 1024 / 1024)} MB).`
    );
  }
  return {
    dataUri: await leerComoDataUri(file),
    fileName: file.name,
    esImagen: false,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Corta si el data URI (base64) supera el tope (base64 engorda ~33%).
 *
 * Si lo que no entra es una foto que el navegador no puede convertir (HEIC del
 * iPhone en Chrome), el mensaje dice la verdad: el problema es el formato.
 */
function verificarTamanio(dataUri: string, noRenderizable: boolean): void {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_ADJUNTO_BYTES) {
    if (noRenderizable) {
      throw new Error(
        'Tu navegador no puede convertir las fotos HEIC del iPhone. ' +
        'Guardala como JPG (o mandala desde Safari) y probá de nuevo.'
      );
    }
    throw new Error(
      `La imagen es demasiado grande (máximo ${Math.round(MAX_ADJUNTO_BYTES / 1024 / 1024)} MB).`
    );
  }
}
