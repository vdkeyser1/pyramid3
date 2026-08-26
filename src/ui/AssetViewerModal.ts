/**
 * AssetViewerModal.ts
 * Ispettore e visualizzatore 3D in-game per tutti gli asset e modelli procedurali.
 * Fornisce un catalogo interattivo accessibile per debug e revisione artistica.
 */

export interface AssetItem {
  readonly id: string;
  readonly name: string;
  readonly category: 'NEMICI' | 'ARMI' | 'ARCHITETTURA' | 'TRAPPOLE' | 'DECORAZIONI';
  readonly polyEstimate: number;
  readonly description: string;
}

export const ASSET_CATALOG: readonly AssetItem[] = [
  {
    id: 'mummy_nemes',
    name: 'Mummia Reale con Nemes & Uraeus',
    category: 'NEMICI',
    polyEstimate: 850,
    description: 'Modello antropomorfo dettagliato con copricapo Nemes, cobra reale e occhi incandescenti.',
  },
  {
    id: 'anubis_priest',
    name: 'Sommo Sacerdote di Anubi',
    category: 'NEMICI',
    polyEstimate: 1120,
    description: 'Sciacallo antropomorfo in basalto nero e oro, collare Usekh, scettro Was e amuleto Ankh.',
  },
  {
    id: 'khopesh_blade',
    name: 'Lama Curva Khopesh dei Faraoni',
    category: 'ARMI',
    polyEstimate: 320,
    description: 'Spada a falce in bronzo lucido con impugnatura cerimoniale e finiture in oro.',
  },
  {
    id: 'shovel_archaeologist',
    name: 'Pala d Ottone dell Archeologo',
    category: 'ARMI',
    polyEstimate: 240,
    description: 'Attrezzo da scavo con asta in legno di cedro e lama a spatola in bronzo.',
  },
  {
    id: 'ra_staff',
    name: 'Bastone Sacro del Disco Solare di Ra',
    category: 'ARMI',
    polyEstimate: 410,
    description: 'Asta monumentale con disco solare dorato e corna bovine di Hathor.',
  },
  {
    id: 'crypt_staircase',
    name: 'Scalinata Monumentale a 10 Gradini',
    category: 'ARCHITETTURA',
    polyEstimate: 980,
    description: 'Discesa fisica scolpita nel calcare con profili d oro e camera cerimoniale ribassata.',
  },
  {
    id: 'starlit_ceiling',
    name: 'Soffitto Stellato in Lapislazzuli',
    category: 'ARCHITETTURA',
    polyEstimate: 620,
    description: 'Volta blu profondo con costellazioni d oro di Sah e Sopdet e disco solare alato.',
  },
  {
    id: 'swinging_blade_trap',
    name: 'Pendolo a Mezzaluna Oscillante',
    category: 'TRAPPOLE',
    polyEstimate: 380,
    description: 'Lama affilata in bronzo sospesa al soffitto con fulcro a contrappeso dorato.',
  },
  {
    id: 'pressure_plate_trap',
    name: 'Lastra a Pressione Trabocchetto',
    category: 'TRAPPOLE',
    polyEstimate: 160,
    description: 'Piastra di granito mobile che attiva feritoie di dardi velenosi nelle pareti.',
  },
  {
    id: 'pharaoh_chest',
    name: 'Forziere Monumentale del Tesoro',
    category: 'DECORAZIONI',
    polyEstimate: 540,
    description: 'Cofanetto d oro con gemma di diaspro luminescente e cratere di scavo nella sabbia.',
  },
];

export class AssetViewerModal {
  private element: HTMLElement | null = null;
  private selectedIndex = 0;

  public show(): void {
    if (this.element) return;

    const overlay = document.createElement('div');
    overlay.id = 'asset-viewer-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.backgroundColor = 'rgba(8, 6, 4, 0.94)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.color = '#e6dbc8';
    overlay.style.fontFamily = "'Cinzel', serif, system-ui";
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.padding = '24px 32px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '2px solid rgba(212, 160, 90, 0.4)';
    header.style.paddingBottom = '16px';

    const title = document.createElement('h2');
    title.innerText = '🏛️ CATALOGO DEGLI ASSET 3D — LA PIRAMIDE PERDUTA';
    title.style.margin = '0';
    title.style.color = '#ffd700';
    title.style.letterSpacing = '2px';

    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'CHIUDI [ESC]';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = '1px solid #d4a05a';
    closeBtn.style.color = '#d4a05a';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const body = document.createElement('div');
    body.style.display = 'grid';
    body.style.gridTemplateColumns = '320px 1fr';
    body.style.gap = '24px';
    body.style.marginTop = '20px';
    body.style.flex = '1';
    body.style.overflow = 'hidden';

    // Lista asset
    const list = document.createElement('div');
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    const details = document.createElement('div');
    details.style.border = '1px solid rgba(212, 160, 90, 0.3)';
    details.style.padding = '24px';
    details.style.borderRadius = '6px';
    details.style.background = 'rgba(20, 16, 12, 0.6)';

    const renderDetails = (item: AssetItem) => {
      details.innerHTML = `
        <h3 style="color: #ffd700; margin-top: 0; font-size: 1.4rem;">${item.name}</h3>
        <p style="color: #d4a05a; font-weight: bold;">Categoria: <span style="color: #fff;">${item.category}</span></p>
        <p style="color: #d4a05a; font-weight: bold;">Poligoni stimati: <span style="color: #64ffda;">~${item.polyEstimate} tris</span></p>
        <p style="color: #d4a05a; font-weight: bold;">Stato licenza: <span style="color: #a3e635;">CC0 / Originale di Progetto</span></p>
        <hr style="border: 0; border-top: 1px solid rgba(212, 160, 90, 0.2); margin: 16px 0;" />
        <p style="line-height: 1.6; font-size: 1.05rem; color: #f0e6d2;">${item.description}</p>
      `;
    };

    ASSET_CATALOG.forEach((item, index) => {
      const card = document.createElement('div');
      card.innerText = `${item.name}`;
      card.style.padding = '12px 16px';
      card.style.borderRadius = '4px';
      card.style.border = '1px solid rgba(212, 160, 90, 0.2)';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.2s';
      card.style.backgroundColor = index === this.selectedIndex ? 'rgba(212, 160, 90, 0.25)' : 'rgba(15, 12, 9, 0.7)';

      card.onclick = () => {
        this.selectedIndex = index;
        Array.from(list.children).forEach((c, idx) => {
          (c as HTMLElement).style.backgroundColor = idx === index ? 'rgba(212, 160, 90, 0.25)' : 'rgba(15, 12, 9, 0.7)';
        });
        renderDetails(item);
      };

      list.appendChild(card);
    });

    renderDetails(ASSET_CATALOG[0]!);
    body.appendChild(list);
    body.appendChild(details);
    overlay.appendChild(body);

    document.body.appendChild(overlay);
    this.element = overlay;
  }

  public hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  public isVisible(): boolean {
    return this.element !== null;
  }
}
