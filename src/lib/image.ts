import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

/**
 * Krymper och komprimerar en bild inför uppladdning.
 * Moderna mobilkameror ger 4000+ px breda bilder på flera MB — nedskalning
 * till maxWidth + JPEG-komprimering kapar både uppladdningstid och
 * storage-kostnad utan synlig kvalitetsförlust i appens vyer.
 *
 * @param originalWidth Bildens kända bredd (t.ex. från ImagePicker-asseten) —
 *                      skickas den med skalas bilden bara ner, aldrig upp.
 */
export async function compressImage(
  uri: string,
  originalWidth?: number,
  maxWidth = 1600,
  quality = 0.8,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  if (!originalWidth || originalWidth > maxWidth) {
    context.resize({ width: maxWidth, height: null })
  }
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality })
  return result.uri
}
