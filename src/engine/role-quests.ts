import type { Effect } from './effects/types';
import { hand, item, sourced, wiki } from './hand';
import { addBonus, MAX_LEVEL } from './stats';

/**
 * Role quests (wiki: "Role Quests"). Only what changes damage or which builds are possible
 * is modeled; quest points, gold, experience, Teleport and control wards aren't. Every role
 * can mark its quest completed; for some that changes nothing yet.
 *   - top:     level cap +2 (stats keep growing to level 20)
 *   - jungle:  Smite becomes Primal Smite (champion damage); the intermediate Unleashed Smite isn't modeled
 *   - mid:     +8% bonus AD and AP, and tier 2 boots upgrade to tier 3 (tier 3 boots are mid-only)
 *   - bot:     boots move to their own slot, so 6 other items fit
 *   - support: Bounty of Worlds' upgrades (Bloodsong, Celestial Opposition, …) become available
 * The support item is bound to the support role (wiki: "World Atlas"): a support starts with it and
 * other roles can't buy it. Its stages (World Atlas → Runic Compass → Bounty of Worlds) come from its
 * own gold quest, not the role quest.
 */
export type Role = 'top' | 'jungle' | 'mid' | 'bot' | 'support';

/** role-quests.json: item structure derived from the data by the import. */
export interface RoleQuestItems {
  boots: string[];
  /** Tier 2 boots → tier 3 boots. */
  bootsUpgrades: Record<string, string>;
  supportUpgrades: string[];
  junglePets: string[];
  /** The support starting item (World Atlas). */
  supportStarter: string;
  /** The support item's stages before the role quest; the last (Bounty of Worlds) is what the upgrades replace. */
  supportStages: string[];
}

/** Every form of the support item: its stages and Bounty of Worlds' upgrades. */
export const supportItems = (data: RoleQuestItems): string[] => [...data.supportStages, ...data.supportUpgrades];

const MID_AMP = sourced('roleQuest.mid.bonusAdApAmp', item('1206', 'BonusADAP', 0.08));
const TOP_LEVEL_CAP_BONUS = sourced('roleQuest.top.levelCapBonus', item('1221', 'LevelCap', 2));
/** Extra item slots the bot lane reward gives, for boots only. */
export const BOT_BOOTS_SLOTS = hand('roleQuest.bot.bootsSlots', 1, wiki('Role Quests', 'The Role Quest slot is now reserved for any equipped Boots item'));

const completed = (role: Role | undefined, done: boolean | undefined, which: Role) => role === which && !!done;

/** Highest level the loadout can reach. */
export function roleQuestLevelCap(role?: Role, done?: boolean): number {
  return completed(role, done, 'top') ? MAX_LEVEL + TOP_LEVEL_CAP_BONUS : MAX_LEVEL;
}

/**
 * Mid lane reward: +8% bonus AD and +8% AP. Runs in the multiply phase as its own multiplier,
 * so it stacks multiplicatively with Rabadon's Deathcap and Blackfire Torch (order doesn't
 * matter). The wiki doesn't say how it combines with them; this is an assumption.
 */
export const midQuestReward: Effect = {
  id: 'RoleQuest:mid',
  name: 'Mid Lane Quest Reward',
  kind: 'roleQuest',
  verifiedPatch: '16.20',
  statPhase: 'multiply',
  modifyStats: (stats) => ({ ...stats, ad: addBonus(stats.ad, stats.ad.bonus * MID_AMP), ap: stats.ap * (1 + MID_AMP) }),
};

/** The role quest's effects for a loadout. */
export function roleQuestEffects(role?: Role, done?: boolean): Effect[] {
  return completed(role, done, 'mid') ? [midQuestReward] : [];
}

/** Smite's level: Primal once the jungle quest is done. The intermediate Unleashed Smite isn't modeled yet. */
export function smiteTier(role?: Role, done?: boolean): 'basic' | 'primal' {
  return completed(role, done, 'jungle') ? 'primal' : 'basic';
}

/**
 * The items after a role or quest change, as the game would hold them. Call it when the role or
 * quest changes; `resolveLoadout` never changes items itself.
 *   - mid: with the quest completed, tier 2 boots become their tier 3 version; otherwise tier 3
 *     boots go back to tier 2.
 *   - support: World Atlas goes in the first slot if no form of the support item is there. With
 *     the quest completed, World Atlas and Runic Compass become Bounty of Worlds (its upgrade is
 *     the player's choice); otherwise an upgrade goes back to Bounty of Worlds.
 *   - any other role: every form of the support item is removed. With no role, items are kept.
 */
export function applyRoleQuest(items: string[], role: Role | undefined, done: boolean | undefined, data: RoleQuestItems): string[] {
  const up = data.bootsUpgrades;
  const down = Object.fromEntries(Object.entries(up).map(([t2, t3]) => [t3, t2]));
  let result = completed(role, done, 'mid') ? items.map((id) => up[id] ?? id) : items.map((id) => down[id] ?? id);

  const forms = new Set(supportItems(data));
  if (role === 'support') {
    if (!result.some((id) => forms.has(id))) result = [data.supportStarter, ...result];
    const bounty = data.supportStages[data.supportStages.length - 1];
    const toBounty = new Set(done ? data.supportStages : data.supportUpgrades);
    result = result.map((id) => (toBounty.has(id) ? bounty : id));
  } else if (role) {
    result = result.filter((id) => !forms.has(id));
  }
  return result;
}
