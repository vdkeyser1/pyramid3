import { describe, it, expect, beforeEach } from 'vitest';
import { AssetViewerModal, ASSET_CATALOG } from '../../src/ui/AssetViewerModal';

describe('AssetViewerModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mostra la modale del catalogo asset con gli elementi registrati', () => {
    const modal = new AssetViewerModal();
    expect(modal.isVisible()).toBe(false);

    modal.show();
    expect(modal.isVisible()).toBe(true);

    const el = document.getElementById('asset-viewer-modal');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('CATALOGO DEGLI ASSET 3D');
    expect(el?.textContent).toContain(ASSET_CATALOG[0]!.name);

    modal.hide();
    expect(modal.isVisible()).toBe(false);
    expect(document.getElementById('asset-viewer-modal')).toBeNull();
  });
});
