import type { GameConfig } from '@/config/GameConfig.js';

export type ColorBlindMode = GameConfig['accessibility']['colorBlindMode'];

export interface UiAccessibilityPalette {
  readonly textColor: string;
  readonly borderColor: string;
  readonly surfaceColor: string;
  readonly accentColor: string;
  readonly minimapColor: string;
}

export interface WorldAccessibilityPalette {
  readonly backgroundColor: number;
  readonly floorColor: number;
  readonly wallColor: number;
  readonly doorColor: number;
  readonly enemyColor: number;
  readonly exitColor: number;
  readonly placedTorchColor: number;
  readonly placedTorchEmissive: number;
  readonly digSiteColor: number;
  readonly digSiteEmissive: number;
  readonly brazierColor: number;
  readonly brazierEmissive: number;
}

export function resolveUiAccessibilityPalette(
  mode: ColorBlindMode,
  highContrast: boolean,
): UiAccessibilityPalette {
  if (mode === 'protanopia') {
    return {
      textColor: highContrast ? '#F0F3E8' : '#C6DDE3',
      borderColor: highContrast ? '#A9D8E6' : '#3D6F7B',
      surfaceColor: highContrast ? '#101416' : '#162024',
      accentColor: highContrast ? '#8DE4F7' : '#58BDD4',
      minimapColor: highContrast ? '#E7F6FA' : '#82ACB5',
    };
  }

  if (mode === 'deuteranopia') {
    return {
      textColor: highContrast ? '#F5EFD6' : '#D7C8A5',
      borderColor: highContrast ? '#F2D48A' : '#84683E',
      surfaceColor: highContrast ? '#15120E' : '#201811',
      accentColor: highContrast ? '#7FC8FF' : '#5C96C7',
      minimapColor: highContrast ? '#F6E7C0' : '#A78A5E',
    };
  }

  if (mode === 'tritanopia') {
    return {
      textColor: highContrast ? '#FFE7E2' : '#E7C0C8',
      borderColor: highContrast ? '#FFB8B0' : '#875164',
      surfaceColor: highContrast ? '#161011' : '#221619',
      accentColor: highContrast ? '#FF9AA8' : '#CC6F89',
      minimapColor: highContrast ? '#FFE2DA' : '#B7857E',
    };
  }

  return {
    textColor: highContrast ? '#F7E6B6' : '#D4A05A',
    borderColor: highContrast ? '#E1B85A' : '#4A2F1A',
    surfaceColor: highContrast ? '#121212' : '#1A1512',
    accentColor: highContrast ? '#F7E6B6' : '#2E8B8B',
    minimapColor: highContrast ? '#F7E6B6' : '#4A2F1A',
  };
}

export function resolveWorldAccessibilityPalette(
  mode: ColorBlindMode,
  highContrast: boolean,
): WorldAccessibilityPalette {
  if (mode === 'protanopia') {
    return {
      backgroundColor: highContrast ? 0x040708 : 0x090e10,
      floorColor: highContrast ? 0x7d8060 : 0x4b5650,
      wallColor: highContrast ? 0xa3a68a : 0x62706b,
      doorColor: highContrast ? 0xd4bf7f : 0x8a744b,
      enemyColor: highContrast ? 0xe4ebe8 : 0xaeb8ba,
      exitColor: highContrast ? 0xa8dfff : 0x5c86a7,
      placedTorchColor: highContrast ? 0xc59a5a : 0x856339,
      placedTorchEmissive: highContrast ? 0x4b2d08 : 0x2a1a09,
      digSiteColor: highContrast ? 0xa8a888 : 0x808570,
      digSiteEmissive: highContrast ? 0x3a5870 : 0x284858,
      brazierColor: highContrast ? 0xc19458 : 0x7d5f36,
      brazierEmissive: highContrast ? 0x4f2b08 : 0x2c1507,
    };
  }

  if (mode === 'deuteranopia') {
    return {
      backgroundColor: highContrast ? 0x060606 : 0x0d0a08,
      floorColor: highContrast ? 0x88774d : 0x4f4530,
      wallColor: highContrast ? 0xb2a06c : 0x76674a,
      doorColor: highContrast ? 0xe0c47d : 0x9b7a44,
      enemyColor: highContrast ? 0xede6d6 : 0xb9b09b,
      exitColor: highContrast ? 0x8bc5ff : 0x5688bf,
      placedTorchColor: highContrast ? 0xcf9142 : 0x8a6131,
      placedTorchEmissive: highContrast ? 0x5c2705 : 0x2f1204,
      digSiteColor: highContrast ? 0xb8a070 : 0x886050,
      digSiteEmissive: highContrast ? 0x3a5080 : 0x283860,
      brazierColor: highContrast ? 0xd1913f : 0x885924,
      brazierEmissive: highContrast ? 0x632504 : 0x341005,
    };
  }

  if (mode === 'tritanopia') {
    return {
      backgroundColor: highContrast ? 0x090506 : 0x11090b,
      floorColor: highContrast ? 0x86656a : 0x574147,
      wallColor: highContrast ? 0xae858d : 0x765861,
      doorColor: highContrast ? 0xe0ab9b : 0x936258,
      enemyColor: highContrast ? 0xf0dfe2 : 0xbea4ab,
      exitColor: highContrast ? 0xffc4be : 0xb97b75,
      placedTorchColor: highContrast ? 0xd9987f : 0x8d5e51,
      placedTorchEmissive: highContrast ? 0x5f1f1c : 0x351213,
      digSiteColor: highContrast ? 0xb88880 : 0x806058,
      digSiteEmissive: highContrast ? 0x70283a : 0x502028,
      brazierColor: highContrast ? 0xcf8f73 : 0x865441,
      brazierEmissive: highContrast ? 0x5d1713 : 0x310d0d,
    };
  }

  return {
    backgroundColor: highContrast ? 0x050505 : 0x0b0908,
    floorColor: highContrast ? 0x7e6738 : 0x3a2a1a,
    wallColor: highContrast ? 0xaa8f5a : 0x6b5432,
    doorColor: highContrast ? 0xc99d3d : 0x6a4a2a,
    enemyColor: highContrast ? 0xe2ded0 : 0x8d8a73,
    exitColor: highContrast ? 0xffd24a : 0xd4900a,
    placedTorchColor: highContrast ? 0xc78334 : 0x6a4824,
    placedTorchEmissive: highContrast ? 0x572001 : 0x2b1202,
    digSiteColor: highContrast ? 0xb09050 : 0x9a7030,
    digSiteEmissive: highContrast ? 0x6a3a10 : 0x7a4a10,
    brazierColor: highContrast ? 0xc78532 : 0x6a4726,
    brazierEmissive: highContrast ? 0x5d2400 : 0x220c02,
  };
}
