import { scorchclawsSlash } from './effects/role-quests/scorchclaws-slash';
import type { Effect } from './effects/types';
import { assumed, hand, item, sourced, wiki } from './hand';
import { addBonus, MAX_LEVEL } from './stats';

/**
 * Role quests (wiki: "Role Quests"). Only what changes damage or which builds are possible
 * is modeled; quest points, gold, experience, Teleport and control wards aren't. Every role
 * can mark its quest completed; for some that changes nothing yet.
 *   - top:     level cap +2 (stats keep growing to level 20)
 *   - jungle:  Smite becomes Primal Smite (40 to champions, and Scorchclaw's Slash with Scorchclaw Pup);
 *              the pet's first evolution (its own checkbox) gives Unleashed Smite (40 to champions).
 *              The pet item, consumed in game, moves to the role quest slot and still counts for gold
 *   - mid:     +8% bonus AD and AP, and tier 2 boots upgrade to tier 3 (tier 3 boots are mid-only)
 *   - bot:     boots move to their own slot, so 6 other items fit
 *   - support: Bounty of Worlds' upgrades (Bloodsong, Celestial Opposition, …) become available
 * The support item is bound to the support role (wiki: "World Atlas"): a support starts with it and
 * other roles can't buy it. Its stages (World Atlas → Runic Compass → Bounty of Worlds) come from its
 * own gold quest, not the role quest. Smite is bound to the jungle role the same way (wiki: "Smite"):
 * a jungler must take it and other roles can't.
 */
export type PlayerRole = 'top' | 'jungle' | 'mid' | 'bot' | 'support';
/**
 * Every loadout has a role. Player builds pick one of the player roles (bot by default); the
 * target dummy role is only for target dummy builds (the engine doesn't enforce that). It counts
 * as having completed the quests for items only: it can hold any upgraded item and the support
 * item, but gets no quest rewards (stat amp, level cap, Primal Smite, boots slot) and no
 * automatic item changes.
 */
export type Role = PlayerRole | 'targetDummy';
/** The roles a player build can pick, in lane order. */
export const PLAYER_ROLES: readonly PlayerRole[] = ['top', 'jungle', 'mid', 'bot', 'support'];
export const DEFAULT_PLAYER_ROLE: PlayerRole = 'bot';
export const TARGET_DUMMY_ROLE = 'targetDummy' satisfies Role;

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

/** Item slots the jungle reward frees: the pet, consumed in game, moves to the role quest slot. */
export const JUNGLE_PET_SLOTS = hand('roleQuest.jungle.petSlots', 1, assumed('The consumed pet item keeps a slot outside the six (the role quest slot), so it still counts for gold'));
/** Smite's summoner spell ID. */
export const SMITE = 'SummonerSmite';
/** Scorchclaw Pup: its Primal Smite gives Scorchclaw's Slash. */
export const SCORCHCLAW_PUP = '1101';
/** The pet a jungler gets when the role becomes jungle without one: Gustwalker Hatchling (the blue pet). */
export const DEFAULT_JUNGLE_PET = '1102';

export type SmiteTier = 'basic' | 'unleashed' | 'primal';

const completed = (role: Role, done: boolean | undefined, which: PlayerRole) => role === which && !!done;

/** Highest level the loadout can reach. */
export function roleQuestLevelCap(role: Role, done?: boolean): number {
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
export function roleQuestEffects(role: Role, done?: boolean, items: readonly string[] = []): Effect[] {
  if (completed(role, done, 'mid')) return [midQuestReward];
  if (completed(role, done, 'jungle') && items.includes(SCORCHCLAW_PUP)) return [scorchclawsSlash];
  return [];
}

/**
 * Smite's level, for junglers only: Primal once the jungle quest is done, Unleashed after the
 * pet's first evolution (ignored once the quest is done).
 */
export function smiteTier(role: Role, done?: boolean, petFirstEvolution?: boolean): SmiteTier {
  if (role !== 'jungle') return 'basic';
  return done ? 'primal' : petFirstEvolution ? 'unleashed' : 'basic';
}

/** The parts of a loadout that role and quest changes touch (`applyRoleQuest` in loadout.ts). */
export interface RoleSetup {
  role: Role;
  roleQuestCompleted?: boolean;
  items?: string[];
  summoners?: string[];
  /** Jungle only: the pet's first evolution (Unleashed Smite). Ignored once the quest is done. */
  petFirstEvolution?: boolean;
}
