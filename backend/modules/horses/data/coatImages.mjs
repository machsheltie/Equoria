/**
 * Coat-color portraits per breed (Equoria-de7ts).
 *
 * Owner request 2026-10-28: a breed's portrait follows the horse's coat color.
 * Each color (colorName + shade from calculatePhenotype) maps to one of the
 * owner's image names; every image name has two or more files (variants). When
 * a horse is created it rolls ONE variant of its color and keeps it in
 * horses.imageUrl, so its picture never changes.
 *
 * The color-to-image mapping was approved by the owner (decisions page q269,
 * 2026-10-28: "match up the current color + shade system to the ones I turned in").
 *
 * Shape, per breed name:
 *   folder: the public URL folder the files live in (frontend/public/...).
 *   images: image name -> its files in that folder. The files are ~1024px WebP
 *           copies of the owner's originals (q275, 2026-10-29: the originals stay
 *           out of the repo), named as she delivered them (e.g. the misspelled
 *           'classsicchampagne'), except the second rosegrey2 original, whose
 *           copy is rosegrey5 so all five rose grey portraits are used (q276).
 *   colors: colorName -> either
 *             - an image name, or a list of image names (any shade), or
 *             - { shade: image name | image names } (one entry per shade).
 *           Every file of every listed image name is one variant.
 * A color, or a shade of a color, that is not listed has no portrait yet: the
 * horse keeps no stored image and the page shows the breed's single picture.
 *
 * To give another breed portraits, add its entry here with the same shape.
 */

/** name1.webp ... nameN.webp: the numbered variants of one portrait. */
function numbered(name, count = 2) {
  return Array.from({ length: count }, (_, i) => `${name}${i + 1}.webp`);
}

const saddlebredImages = {
  standardbay: numbered('standardbay'),
  mahoganybay: numbered('mahoganybay'),
  goldenbay: numbered('goldenbay'),
  bloodbay: numbered('bloodbay'),
  copperbay: numbered('copperbay'),
  wildbay: numbered('wildbay'),
  redchestnut: numbered('redchestnut'),
  darkchestnut: numbered('darkchestnut'),
  liverchestnut: numbered('liverchestnut'),
  lightchestnut: numbered('lightchestnut'),
  goldenchestnut: numbered('goldenchestnut'),
  nonfadingblack: numbered('nonfadingblack'),
  fadingblack: numbered('fadingblack'),
  smokyblack: numbered('smokyblack'),
  goldenbuckskin: numbered('goldenbuckskin'),
  classicbuckskin: numbered('classicbuckskin'),
  buttermilkbuckskin: numbered('buttermilkbuckskin'),
  goldenpalomino: numbered('goldenpalomino'),
  lightpalomino: numbered('lightpalomino'),
  darkpalomino: numbered('darkpalomino'),
  chocolatepalomino: numbered('chocolatepalomino'),
  cremello: numbered('cremello'),
  perlino: numbered('perlino'),
  smokycream: numbered('smokycream'),
  sealperlino: numbered('sealperlino'),
  darksealbrown: numbered('darksealbrown'),
  lightsealbrown: numbered('lightsealbrown'),
  sealskin: numbered('sealskin'),
  goldchampagne: numbered('goldchampagne'),
  classsicchampagne: numbered('classsicchampagne'),
  amberchampagne: numbered('amberchampagne'),
  sablechampagne: numbered('sablechampagne'),
  dapplegrey: numbered('dapplegrey'),
  lightdapplegrey: numbered('lightdapplegrey'),
  steelgrey: numbered('steelgrey'),
  rosegrey: numbered('rosegrey', 5),
  whitegrey: numbered('whitegrey'),
  fleabittengrey: numbered('fleabittengrey'),
};

const saddlebredColors = {
  Bay: {
    standard: 'standardbay',
    dark: 'mahoganybay',
    light: 'goldenbay',
    blood: 'bloodbay',
    copper: 'copperbay',
    wild: 'wildbay',
  },
  Chestnut: {
    medium: 'redchestnut',
    dark: ['darkchestnut', 'liverchestnut'],
    light: 'lightchestnut',
    golden: 'goldenchestnut',
  },
  Black: { standard: 'nonfadingblack', faded: 'fadingblack' },
  'Smoky Black': 'smokyblack',
  Buckskin: { golden: 'goldenbuckskin', burnished: 'classicbuckskin', cream: 'buttermilkbuckskin' },
  Palomino: {
    golden: 'goldenpalomino',
    pale: 'lightpalomino',
    copper: 'darkpalomino',
    chocolate: 'chocolatepalomino',
  },
  Cremello: 'cremello',
  Perlino: 'perlino',
  'Smoky Cream': 'smokycream',
  'Seal Perlino': 'sealperlino',
  'Seal Brown': { dark: 'darksealbrown', light: 'lightsealbrown', sealskin: 'sealskin' },
  'Gold Champagne': 'goldchampagne',
  'Classic Champagne': 'classsicchampagne',
  'Amber Champagne': 'amberchampagne',
  // Seal Brown + Champagne is Sable Champagne (owner ruling q276, 2026-10-29).
  'Sable Champagne': 'sablechampagne',
  Gray: 'dapplegrey',
  'Steel Dark Dapple Gray': 'dapplegrey',
  'Steel Light Dapple Gray': 'lightdapplegrey',
  'Steel Gray': 'steelgrey',
  'Rose Gray': 'rosegrey',
  'Rose Dark Dapple Gray': 'rosegrey',
  'Rose Light Dapple Gray': 'rosegrey',
  'White Gray': 'whitegrey',
  'Fleabitten Gray': 'fleabittengrey',
};

export const coatImages = Object.freeze({
  'American Saddlebred': Object.freeze({
    folder: '/images/breeds/american_saddlebred',
    images: saddlebredImages,
    colors: saddlebredColors,
  }),
});
