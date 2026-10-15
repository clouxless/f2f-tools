// The actions every 4e character can take in combat, from the Player's Handbook and Rules Compendium.
// "sys" names the dnd4e sheet handler a row's icon triggers; "roll" marks a check the sheet can roll.

export const ACTION_SECTIONS = [
	{ key: "standard", label: "Standard Actions" },
	{ key: "move", label: "Move Actions" },
	{ key: "minor", label: "Minor Actions" },
	{ key: "free", label: "Free Actions" },
	{ key: "triggered", label: "Triggered Actions" }
];

export const ACTIONS = [
	// Standard
	{ key: "charge", name: "Charge", action: "standard", source: "PHB 287, RC 240", lines: [
		["Move", "Move up to your speed toward the target. Each square must bring you closer, and you must end at least 2 squares from where you started."],
		["Attack", "Make a melee basic attack or a bull rush against the target, with a +1 bonus to the attack roll."],
		["After", "You can't take any further actions this turn, except free actions."]] },
	{ key: "totalDefense", name: "Total Defense", action: "standard", source: "PHB 292, RC 251", lines: [
		["Effect", "+2 bonus to all defenses until the start of your next turn."]] },
	{ key: "secondWind", name: "Second Wind", action: "standard", sys: "second-wind", source: "PHB 291, RC 248", lines: [
		["Effect", "Spend a healing surge to regain hit points, and gain a +2 bonus to all defenses until the start of your next turn."],
		["Special", "Once per encounter; available again after a short or extended rest. If an ally administers first aid with Heal, you use it without taking an action but get no defense bonus."]] },
	{ key: "aidAttack", name: "Aid Attack", action: "standard", source: "RC 237", lines: [
		["Target", "An enemy adjacent to you."],
		["Effect", "One ally gains +2 to their next attack roll against that enemy before the end of your next turn. Up to four creatures can aid the same attack."]] },
	{ key: "aidDefense", name: "Aid Defense", action: "standard", source: "RC 238", lines: [
		["Target", "An enemy adjacent to you."],
		["Effect", "One ally gains +2 to all defenses against that enemy's next attack against them, before the end of your next turn."]] },
	{ key: "grab", name: "Grab", action: "standard", roll: { ability: "str", vs: "Reflex" }, source: "PHB 290, RC 243", lines: [
		["Target", "A creature within your melee reach (not counting weapon reach), no more than one size larger than you. You need a free hand."],
		["Attack", "Strength vs. Reflex, with no weapon modifiers."],
		["Hit", "The target is immobilized until it escapes or you end the grab."],
		["Sustain Minor", "You keep the grab. It ends if you are dazed, stunned, surprised or unconscious, if you move away, or if forced movement takes either of you out of reach."]] },
	{ key: "bullRush", name: "Bull Rush", action: "standard", roll: { ability: "str", vs: "Fortitude" }, source: "PHB 287, RC 239", lines: [
		["Target", "An adjacent creature no more than one size larger than you."],
		["Attack", "Strength vs. Fortitude, with no weapon modifiers."],
		["Hit", "Push the target 1 square and shift into the space it left. If it can't be pushed, nothing happens."]] },
	{ key: "moveGrabbed", name: "Move a Grabbed Target", action: "standard", roll: { ability: "str", vs: "Fortitude", check: true }, source: "PHB 290, RC 244", lines: [
		["Check", "Strength check against the Fortitude of the creature you are grabbing (automatic for a helpless ally)."],
		["Success", "Move up to half your speed and pull the target with you. The target doesn't get an opportunity attack against you for this move."]] },
	{ key: "readyAction", name: "Ready an Action", action: "standard", source: "PHB 291, RC 247", lines: [
		["Effect", "Choose a standard, move or minor action and a trigger. When the trigger happens, take the action as an immediate reaction. Your initiative moves to just before the creature or event that triggered it."]] },
	{ key: "coupDeGrace", name: "Coup de Grace", action: "standard", source: "PHB 288, RC 241", lines: [
		["Effect", "Use an attack power against an adjacent helpless target. A hit is an automatic critical hit; if it deals damage equal to or more than the target's bloodied value, the target dies."]] },
	{ key: "administerPotion", name: "Administer a Potion", action: "standard", source: "RC 244", lines: [
		["Effect", "Give a potion in your hand to an adjacent creature that is helpless or willing."]] },
	{ key: "equipShield", name: "Equip or Stow a Shield", action: "standard", source: "RC 244", lines: [
		["Effect", "Ready a stowed shield (your shield hand must be free) or sling it out of the way."]] },

	// Move
	{ key: "walk", name: "Walk", action: "move", source: "PHB 292, RC 252", lines: [
		["Movement", "Move up to your speed ({speed} squares). Leaving a square adjacent to an enemy provokes an opportunity attack."]] },
	{ key: "run", name: "Run", action: "move", source: "PHB 291, RC 248", lines: [
		["Movement", "Move up to your speed + 2 ({run} squares)."],
		["Effect", "You take a -5 penalty to attack rolls and grant combat advantage until the start of your next turn."]] },
	{ key: "shift", name: "Shift", action: "move", source: "PHB 292, RC 249", lines: [
		["Movement", "Move {shift} square{shiftS}. Shifting doesn't provoke opportunity attacks. You can't normally shift into difficult terrain."]] },
	{ key: "standUp", name: "Stand Up", action: "move", source: "PHB 292, RC 250", lines: [
		["Effect", "End the prone condition. If your space is occupied, stand and shift 1 square to an unoccupied space."]] },
	{ key: "crawl", name: "Crawl", action: "move", source: "PHB 288, RC 241", lines: [
		["Requirement", "You must be prone."],
		["Movement", "Move up to half your speed."]] },
	{ key: "escape", name: "Escape", action: "move", skills: ["acr", "ath"], source: "PHB 288, RC 243", lines: [
		["Check", "Acrobatics against the grabber's Reflex, or Athletics against its Fortitude (or the DC the effect gives). +2 to the DC for each grabber beyond the first."],
		["Success", "The grab or immobilizing effect ends, and you can shift 1 square."]] },
	{ key: "squeeze", name: "Squeeze", action: "move", source: "PHB 292, RC 249", lines: [
		["Movement", "Move up to half your speed through a narrow space. A Large or bigger creature counts as one size smaller."],
		["Effect", "Until the squeeze ends (a free action), you grant combat advantage and take a -5 penalty to attack rolls."]] },

	// Minor
	{ key: "drawWeapon", name: "Draw or Sheathe a Weapon", action: "minor", source: "RC 244", lines: [
		["Effect", "Draw a weapon (you need a free hand) or put one away."]] },
	{ key: "drinkPotion", name: "Drink a Potion", action: "minor", source: "RC 244", lines: [
		["Requirement", "The potion is in your hand."]] },
	{ key: "pickUp", name: "Pick Up an Item", action: "minor", source: "RC 244", lines: [
		["Effect", "Pick up an unattended item in your reach or your space."]] },
	{ key: "stowItem", name: "Retrieve or Stow an Item", action: "minor", source: "RC 244", lines: [
		["Effect", "Take an item from your pouch or pack, or put one away."]] },
	{ key: "openClose", name: "Open or Close", action: "minor", source: "RC 244", lines: [
		["Effect", "Open or close a door or container, pull a lever, or a similar simple task. Stuck or locked things need a check and a standard action."]] },
	{ key: "loadCrossbow", name: "Load a Crossbow", action: "minor", source: "RC 244", lines: [
		["Effect", "Load a bolt from an accessible quiver or case."]] },
	{ key: "dropProne", name: "Drop Prone", action: "minor", source: "RC 242", lines: [
		["Effect", "You fall prone."]] },

	// Free
	{ key: "actionPoint", name: "Spend an Action Point", action: "free", sys: "action-point", source: "PHB 286, RC 235", lines: [
		["Effect", "Gain an extra standard, move or minor action this turn."],
		["Special", "Only on your turn, once per encounter, never in a surprise round."]] },
	{ key: "talk", name: "Talk", action: "free", source: "RC 251", lines: [
		["Effect", "Speak, within reason. The DM can limit long speeches."]] },
	{ key: "dropItem", name: "Drop a Held Item", action: "free", source: "RC 244", lines: [
		["Effect", "The item lands in your space."]] },
	{ key: "endGrab", name: "End a Grab", action: "free", source: "PHB 290, RC 243", lines: [
		["Effect", "Let go of a creature you are grabbing."]] },
	{ key: "delay", name: "Delay", action: "free", source: "PHB 288, RC 241", lines: [
		["Requirement", "Your turn is about to start."],
		["Effect", "Take your turn later in the round; your initiative moves to where you act. Start-of-turn effects happen now, and anything you are sustaining ends now."]] },

	// Triggered
	{ key: "opportunityAttack", name: "Opportunity Attack", action: "triggered", source: "PHB 290, RC 246", lines: [
		["Trigger", "An enemy adjacent to you leaves a square adjacent to you without shifting or teleporting, or uses a ranged or area power."],
		["Effect", "Make a melee basic attack against it (an opportunity action, once per enemy turn)."]] }
];
