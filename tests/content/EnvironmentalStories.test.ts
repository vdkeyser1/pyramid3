import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENTAL_STORIES,
  resolveEnvironmentalStory,
  getEnvironmentalStoryById,
  type StoryCategory,
} from '@/content/EnvironmentalStories.js';

describe('EnvironmentalStories — Micro-scenari di narrazione visiva (P10)', () => {
  it('contiene oltre 50 micro-scenari narrativi definiti', () => {
    expect(ENVIRONMENTAL_STORIES.length).toBeGreaterThanOrEqual(50);
  });

  it('tutti gli scenari hanno ID, titoli e indizi narrativi univoci e validi', () => {
    const ids = new Set<string>();

    for (const story of ENVIRONMENTAL_STORIES) {
      expect(ids.has(story.id)).toBe(false);
      ids.add(story.id);

      expect(story.title.length).toBeGreaterThan(3);
      expect(story.narrativeClue.length).toBeGreaterThan(15);
      expect(story.requiredProps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('copre tutte le 6 categorie narrative egizie', () => {
    const categories: StoryCategory[] = [
      'SACRILEGE_AND_THEFT',
      'RITUAL_AND_WORSHIP',
      'DEATH_AND_MUMMIFICATION',
      'CATASTROPHE_AND_COLLAPSE',
      'ASTRONOMICAL_AND_MYSTIC',
      'CURSE_OF_THE_PHARAOHS',
    ];

    for (const category of categories) {
      const count = ENVIRONMENTAL_STORIES.filter((s) => s.category === category).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it('resolveEnvironmentalStory è deterministico e produce uno scenario valido', () => {
    const s1 = resolveEnvironmentalStory(42, 3, 'COMBAT', 'FUNERARY');
    const s2 = resolveEnvironmentalStory(42, 3, 'COMBAT', 'FUNERARY');

    expect(s1.id).toBe(s2.id);
    expect(s1.category).toBe('DEATH_AND_MUMMIFICATION');
  });

  it('getEnvironmentalStoryById recupera correttamente', () => {
    const s = getEnvironmentalStoryById('THIEF_CRUSHED_BY_SLAB');
    expect(s).toBeDefined();
    expect(s?.category).toBe('SACRILEGE_AND_THEFT');

    const unknown = getEnvironmentalStoryById('NON_ESISTE');
    expect(unknown).toBeUndefined();
  });
});
