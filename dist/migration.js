// The retired site sends browser-local saves only to this origin via postMessage.
// Only sanitized mech builds transfer; no identity keys or credentials are read.
import { cleanBuild } from './core.js?v=41';
const legacyOrigin = 'https://ironwake-mech-coop.loganthorneloe.chatgpt.site';
export async function receiveLegacyMechs() {
  if (!window.opener) return;
  return new Promise((resolve) => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve();
    };
    const receive = (event) => {
      if (
        event.origin !== legacyOrigin ||
        event.source !== window.opener ||
        event.data?.type !== 'ironwake-transfer'
      )
        return;
      try {
        const data = event.data;
        if (data.active && typeof data.active === 'object')
          localStorage.setItem('iw-active', JSON.stringify(cleanBuild(data.active)));
        if (Array.isArray(data.mechs)) {
          let existing;
          try {
            existing = JSON.parse(localStorage.getItem('iw-builds') || '[]');
          } catch {
            existing = [];
          }
          if (!Array.isArray(existing)) existing = [];
          const builds = [...existing, ...data.mechs]
            .filter((b) => b && typeof b === 'object')
            .slice(0, 24)
            .map(cleanBuild);
          const unique = [...new Map(builds.map((b) => [JSON.stringify(b), b])).values()].slice(
            0,
            12,
          );
          localStorage.setItem('iw-builds', JSON.stringify(unique));
        }
        event.source.postMessage({ type: 'ironwake-transfer-complete' }, legacyOrigin);
      } catch {
        /* Storage restrictions must not prevent playing. */
      }
      finish();
    };
    window.addEventListener('message', receive);
    timer = setTimeout(finish, 2000);
    window.opener.postMessage({ type: 'ironwake-transfer-ready' }, legacyOrigin);
  });
}
