import { DESTRUCTION_LIMITS } from './destruction.js';
export const destructionLabEnabled =
  new URLSearchParams(location.search).get('lab') === 'destruction';

export function createDestructionLab({ open, choose, fitKit, restart, graphics, canControl }) {
  if (!destructionLabEnabled) return { update() {} };
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = './destruction-lab.css';
  document.head.append(style);
  document.body.dataset.lab = 'destruction';
  const button = document.createElement('button');
  button.textContent = 'Destruction lab';
  button.id = 'destructionLab';
  document.querySelector('.topbar nav').append(button);
  function show() {
    open(
      `<section class="demolition-brief"><p class="overline">IRONWAKE / EXPERIMENTAL BRANCH</p><h2>MAKE YOUR<br>OWN ENTRANCE.</h2><p class="demolition-intro">Destruction proving grounds. Localized holes, crumbling islands, bouncing chunks and structural collapse. Opt-in only; Cinderfall is unchanged.</p><div class="demolition-cards"><button data-demolition="level"><small>02 / LIVE OPERATION · 1–4 PILOTS</small><strong>BREAKWATER</strong><span>Three industrial compounds. Breach customs, rupture the refinery, collapse command and boost to extraction. A short, high-tempo prototype sortie.</span><b>DEPLOY LEVEL 02 ↗</b></button><button data-demolition="yard"><small>RANGE / NO HOSTILES</small><strong>BREACH RANGE</strong><span>Glass, concrete and steel lanes. Fuel chain array. Four-column collapse rig. Open routes and explore at your own pace.</span><b>ENTER RANGE ↗</b></button><button data-demolition="stress"><small>PERFORMANCE / NO HOSTILES</small><strong>STRESS YARD</strong><span>A dense cargo courtyard and fuel chains. Up to 64 active physics chunks, then sleeping rubble. Fixed simulation and rendering budgets. Watch the live counters while you demolish.</span><b>ENTER STRESS YARD ↗</b></button></div><div class="demolition-tools"><button id="demolitionKit" class="button secondary">Fit demolition kit</button><span>Anvil · Hammer + rockets + repair · 88 / 138t. Optional; your current mech works too.</span></div><p class="demolition-note">Gold = load-bearing columns. Orange = volatile fuel. Dark walls = permanent perimeter. Bullets punch local holes; rockets and melee tear larger openings. Unsupported material falls, bounces and settles. Loose chunks do not block pilots or deal damage. Co-op uses the existing host-and-ready lobby.</p></section>`,
    );
    document
      .querySelectorAll('[data-demolition]')
      .forEach((b) => (b.onclick = () => choose(b.dataset.demolition)));
    document.querySelector('#demolitionKit').onclick = () => {
      fitKit();
      document.querySelector('#demolitionKit').textContent = 'Demolition kit fitted ✓';
    };
  }
  button.onclick = show;
  const hud = document.createElement('section');
  hud.id = 'destructionTelemetry';
  hud.hidden = true;
  hud.setAttribute('aria-label', 'Destruction telemetry');
  hud.innerHTML =
    '<div><b>DESTRUCTION LAB</b><span id="demolitionRun"></span></div><p><span>REMOVED <strong id="demolitionRemoved">0</strong></span><span>CHAINS <strong id="demolitionChains">0</strong></span><span>COLLAPSED <strong id="demolitionCollapsed">0</strong></span><span>FRACTURES <strong id="demolitionFractures">0</strong></span><span>AWAKE <strong id="demolitionAwake">0 / 64</strong></span><span>SETTLED <strong id="demolitionSettled">0 / 160</strong></span><span>DRAWS <strong id="demolitionDraws">—</strong></span></p><small>Localized collision holes · Fixed-step local chunks · Host-authoritative geometry</small><small id="demolitionMemory"></small><label id="demolitionScenarioLabel">SCENARIO <select id="demolitionScenario" aria-label="Lab scenario"><option value="yard">Material lanes</option><option value="fuel">Fuel chain array</option><option value="collapse">Support collapse rig</option><option value="stress">Stress courtyard</option></select></label><button id="restartDemolition" aria-label="Restart destruction run">↻ Reset run</button>';
  document.querySelector('#game').append(hud);
  hud.querySelector('button').onclick = restart;
  hud.querySelector('select').onchange = (e) => choose(e.target.value);
  // Open only the opt-in console; never replace the standard start action.
  if (!new URLSearchParams(location.search).has('room')) show();
  return {
    update(w) {
      hud.hidden = !w?.destruction || document.querySelector('#game').hidden;
      if (hud.hidden) return;
      const stats = graphics();
      hud.querySelector('#demolitionMemory').textContent =
        'GPU ASSETS / ' + stats.geometries + ' geometries · ' + stats.textures + ' textures';
      for (const [id, text] of Object.entries({
        demolitionRun: w.mission.name,
        demolitionRemoved: w.destruction.destroyed + ' / ' + w.mission.panelCount,
        demolitionChains: w.destruction.chains,
        demolitionCollapsed: w.destruction.collapses,
        demolitionFractures: w.destruction.fractures,
        demolitionAwake: stats.awake + ' / ' + DESTRUCTION_LIMITS.awake,
        demolitionSettled: stats.settled + ' / ' + DESTRUCTION_LIMITS.rubble,
        demolitionDraws: stats.calls,
      }))
        hud.querySelector('#' + id).textContent = text;
      hud.querySelector('button').disabled = !canControl();
      hud.querySelector('label').hidden = w.mission.variant === 'level';
      hud.querySelector('select').disabled = !canControl();
      hud.querySelector('select').value = w.mission.variant;
    },
  };
}
