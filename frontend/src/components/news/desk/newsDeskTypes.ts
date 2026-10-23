/**
 * The News Desk's words for each post type and its form rules (Equoria-wbt8l,
 * owner rulings 2026-10-23). The limits mirror backend/modules/news so the
 * desk can say what is wrong before anything is sent; the server still decides.
 */

import type { ActionCopy } from '@/lib/http/actionMessage';
import type { StaffNewsPostType } from '@/lib/api/news';

export const newsTitleMax = 120;
export const newsBodyMax = 6000;
export const newsCaptionMax = 60;
export const newsTilesMax = 4;

/** The desk's name and one-line purpose for a post type. */
export function deskTypeCopy(
  postType: StaffNewsPostType,
  signatureName: string
): { label: string; hint: string } {
  switch (postType) {
    case 'seasonalEvent':
      return {
        label: 'Seasonal Events',
        hint: 'The month’s event in the large format, with up to four picture tiles. It goes out at the start of the 1st.',
      };
    case 'headAdminLetter':
      return { label: 'From The Head Admin', hint: 'A letter to every player, signed by you.' };
    case 'adminLetter':
      return {
        label: `From Admin ${signatureName}`,
        hint: 'Your own letter to every player, signed with your name.',
      };
    case 'update':
      return { label: 'Updates', hint: 'News about the game itself.' };
    case 'contest':
      return {
        label: 'Contests',
        hint: 'A contest players can enter. Add the last day for entries if it has one.',
      };
  }
}

/** Refusals of a save or a removal, by status. */
export const deskRefused: ActionCopy = {
  400: 'The post couldn’t be saved. Check the title, the words, the month or closing day, and the pictures.',
  403: 'Your staff role can’t write or change this kind of post.',
  404: 'That post no longer exists.',
  409: 'That change isn’t possible: a published seasonal event keeps its month, and game entries can’t be changed.',
};

/** Refusals of a picture upload, by status. */
export const uploadRefused: ActionCopy = {
  400: 'That file isn’t a picture the desk accepts. Use a JPEG, PNG, GIF or WebP under 5 MB.',
  413: 'That picture is larger than 5 MB.',
  502: 'The picture couldn’t be stored just now. Try again.',
  503: 'Picture storage isn’t set up yet, so tiles can’t be added.',
};
