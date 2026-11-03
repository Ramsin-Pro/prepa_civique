import { ImageResponse } from 'next/og';
import { site } from './site';

// Images de partage sur les réseaux sociaux (§1 : acquisition) : couleurs de la charte, et toujours
// la mention d'indépendance, pour ne jamais laisser croire à un site officiel.

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

export function ogImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#faf7f0', padding: '64px 72px', color: '#1b2b34' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1f5e4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, border: '6px solid #f8ebcf' }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{site.name}</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#55626a' }}>{eyebrow}</div>
        <div style={{ marginTop: 16, fontSize: title.length > 60 ? 54 : 66, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{title}</div>
        {subtitle && <div style={{ marginTop: 24, fontSize: 30, color: '#1f5e4b', maxWidth: 1000 }}>{subtitle}</div>}
        <div style={{ marginTop: 'auto', display: 'flex', fontSize: 22, color: '#55626a', borderTop: '2px solid #e4ded1', paddingTop: 20 }}>
          Plateforme indépendante, sans lien avec l’administration française
        </div>
      </div>
    ),
    ogSize,
  );
}
