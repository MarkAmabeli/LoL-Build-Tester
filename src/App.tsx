import { useMemo, useState } from 'react';
import { autoAttack, mitigate, resolveStats, type ChampionBaseStats } from './engine';

// Placeholder stats until the data pipeline output is wired into the UI (ROADMAP step 6).
const SAMPLE: ChampionBaseStats = {
  hp: 600, hpperlevel: 100,
  mp: 300, mpperlevel: 50,
  armor: 30, armorperlevel: 4.5,
  spellblock: 30, spellblockperlevel: 1.3,
  attackdamage: 60, attackdamageperlevel: 3,
  attackspeed: 0.65, attackspeedperlevel: 2.5,
  movespeed: 330, attackrange: 550,
};

export default function App() {
  const [attackerLevel, setAttackerLevel] = useState(9);
  const [targetLevel, setTargetLevel] = useState(9);
  const [bonusAd, setBonusAd] = useState(0);
  const [lethality, setLethality] = useState(0);

  const result = useMemo(() => {
    const attacker = resolveStats(SAMPLE, attackerLevel, { ad: bonusAd, lethality });
    const target = resolveStats(SAMPLE, targetLevel);
    const hit = mitigate(autoAttack(attacker, false), { attacker, target });
    return { attacker, target, hit };
  }, [attackerLevel, targetLevel, bonusAd, lethality]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>LoL Build Tester</h1>
      <p>Engine preview: one auto attack between two sample champions.</p>

      <label>Attacker level {attackerLevel}
        <input type="range" min={1} max={18} value={attackerLevel} onChange={(e) => setAttackerLevel(+e.target.value)} />
      </label>
      <br />
      <label>Target level {targetLevel}
        <input type="range" min={1} max={18} value={targetLevel} onChange={(e) => setTargetLevel(+e.target.value)} />
      </label>
      <br />
      <label>Bonus AD <input type="number" value={bonusAd} onChange={(e) => setBonusAd(+e.target.value)} /></label>
      <br />
      <label>Lethality <input type="number" value={lethality} onChange={(e) => setLethality(+e.target.value)} /></label>

      <table style={{ marginTop: '1rem' }}>
        <tbody>
          <tr><td>Attacker AD</td><td>{result.attacker.ad.total.toFixed(1)}</td></tr>
          <tr><td>Target armor</td><td>{result.target.armor.total.toFixed(1)}</td></tr>
          <tr><td>Effective armor</td><td>{result.hit.effectiveResist.toFixed(1)}</td></tr>
          <tr><td><strong>Damage dealt</strong></td><td><strong>{result.hit.final.toFixed(1)}</strong></td></tr>
        </tbody>
      </table>
    </main>
  );
}
