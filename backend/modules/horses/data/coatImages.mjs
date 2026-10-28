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
 *   images: image name -> its files in that folder (the owner's own file names,
 *           spelling and extension kept as delivered, e.g. 'classsicchampagne').
 *   colors: colorName -> either
 *             - an image name, or a list of image names (any shade), or
 *             - { shade: image name | image names } (one entry per shade).
 *           Every file of every listed image name is one variant.
 * A color, or a shade of a color, that is not listed has no portrait yet: the
 * horse keeps no stored image and the page shows the breed's single picture.
 *
 * To give another breed portraits, add its entry here with the same shape.
 */

const saddlebredImages = {
  standardbay: ['standardbay1.png', 'standardbay2.png'],
  mahoganybay: ['mahoganybay1.png', 'mahoganybay2.png'],
  goldenbay: ['goldenbay1.png', 'goldenbay2.png'],
  bloodbay: ['bloodbay1.png', 'bloodbay2.png'],
  copperbay: ['copperbay1.png', 'copperbay2.png'],
  wildbay: ['wildbay1.png', 'wildbay2.png'],
  redchestnut: ['redchestnut1.png', 'redchestnut2.png'],
  darkchestnut: ['darkchestnut1.png', 'darkchestnut2.png'],
  liverchestnut: ['liverchestnut1.png', 'liverchestnut2.png'],
  lightchestnut: ['lightchestnut1.png', 'lightchestnut2.png'],
  goldenchestnut: ['goldenchestnut1.png', 'goldenchestnut2.png'],
  nonfadingblack: ['nonfadingblack1.png', 'nonfadingblack2.png'],
  fadingblack: ['fadingblack1.png', 'fadingblack2.png'],
  smokyblack: ['smokyblack1.jpg', 'smokyblack2.png'],
  goldenbuckskin: ['goldenbuckskin1.png', 'goldenbuckskin2.png'],
  classicbuckskin: ['classicbuckskin1.jpg', 'classicbuckskin2.png'],
  buttermilkbuckskin: ['buttermilkbuckskin1.png', 'buttermilkbuckskin2.png'],
  goldenpalomino: ['goldenpalomino1.png', 'goldenpalomino2.png'],
  lightpalomino: ['lightpalomino1.png', 'lightpalomino2.png'],
  darkpalomino: ['darkpalomino1.png', 'darkpalomino2.png'],
  chocolatepalomino: ['chocolatepalomino1.png', 'chocolatepalomino2.png'],
  cremello: ['cremello1.png', 'cremello2.png'],
  perlino: ['perlino1.png', 'perlino2.png'],
  smokycream: ['smokycream1.png', 'smokycream2.png'],
  sealperlino: ['sealperlino1.png', 'sealperlino2.png'],
  darksealbrown: ['darksealbrown1.png', 'darksealbrown2.png'],
  lightsealbrown: ['lightsealbrown1.png', 'lightsealbrown2.png'],
  sealskin: ['sealskin1.png', 'sealskin2.png'],
  goldchampagne: ['goldchampagne1.png', 'goldchampagne2.png'],
  classsicchampagne: ['classsicchampagne1.png', 'classsicchampagne2.png'],
  sablechampagne: ['sablechampagne1.png', 'sablechampagne2.png'],
  dapplegrey: ['dapplegrey1.png', 'dapplegrey2.png'],
  lightdapplegrey: ['lightdapplegrey1.png', 'lightdapplegrey2.png'],
  steelgrey: ['steelgrey1.png', 'steelgrey2.png'],
  rosegrey: ['rosegrey1.png', 'rosegrey2.jpg', 'rosegrey2.png', 'rosegrey3.jpeg', 'rosegrey4.jpeg'],
  whitegrey: ['whitegrey1.png', 'whitegrey2.png'],
  fleabittengrey: ['fleabittengrey1.jpg', 'fleabittengrey2.jpg'],
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
  'Amber Champagne': 'sablechampagne',
  // Seal Brown + Champagne is named Sable Champagne by the color engine.
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
