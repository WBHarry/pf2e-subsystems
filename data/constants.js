export const MODULE_ID = 'pf2e-subsystems';
export const SOCKET_ID = `module.${MODULE_ID}`;

export const hooks = {
    subsystemsReady: 'pf2e-subsystems-ready',
};

export const settingIDs = {
    menus: {
        subsystems: "subsystems-menu"
    },
    chase: {
        settings: "chase-settings",
    },
    research: {
        settings: "research-settings",
    },
    infiltration: {
        settings: 'infiltration-settings',
    },
    influence: {
        settings: 'influence-settings',
    }
}

export const tourIDs = {
    chase: "pf2e-subsystems-chase",
    research: "pf2e-subsystems-research",
    infiltration: "pf2e-subsystems-infiltration",
    influence: "pf2e-subsystems-influence",
}

export const timeUnits = {
    year: {
        value: 'year',
        name: 'PF2ESubsystems.TimeUnits.Year.Plural',
    },
    month: {
        value: 'month',
        name: 'PF2ESubsystems.TimeUnits.Month.Plural',
    },
    day: {
        value: 'day',
        name: 'PF2ESubsystems.TimeUnits.Day.Plural',
    },
    hour: {
        value: 'hour',
        name: 'PF2ESubsystems.TimeUnits.Hour.Plural',
    },
}

export const dcAdjustments = {
    incrediblyHard: {
        value: 'incrediblyHard',
        name: 'PF2E.DCAdjustmentIncrediblyHard',
    },
    veryHard: {
        value: 'veryHard',
        name: 'PF2E.DCAdjustmentVeryHard',
    },
    hard: {
        value: 'hard',
        name: 'PF2E.DCAdjustmentHard',
    },
    standard: {
        value: 'standard',
        name: 'PF2E.DCAdjustmentNormal',
    },
    easy: {
        value: 'easy',
        name: 'PF2E.DCAdjustmentEasy',
    },
    veryEasy: {
        value: 'veryEasy',
        name: 'PF2E.DCAdjustmentVeryEasy',
    },
    incrediblyEasy: {
        value: 'incrediblyEasy',
        name: 'PF2E.DCAdjustmentIncrediblyEasy'
    }
};

export const degreesOfSuccess = {
    criticalSuccess: {
        value: 'criticalSuccess',
        name: 'PF2E.Check.Result.Degree.Check.criticalSuccess'
    },
    success: {
        value: 'success',
        name: 'PF2E.Check.Result.Degree.Check.success'
    },
    failure: {
        value: 'failure',
        name: 'PF2E.Check.Result.Degree.Check.failure'
    },
    criticalFailure: {
        value: 'criticalFailure',
        name: 'PF2E.Check.Result.Degree.Check.criticalFailure'
    }
}

export const defaultInfiltrationAwarenessBreakpoints = {
    '1': {
        id: '1',
        breakpoint: 5,
        dcIncrease: 1,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint5',
    },
    '2': {
        id: '2',
        breakpoint: 10,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint10',
    },
    '3': {
        id: '3',
        breakpoint: 15,
        dcIncrease: 2,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint15',
    },
    '4': {
        id: '4',
        breakpoint: 20,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint20',
    }
}

export const defaultInfiltrationPreparations = {
    bribeContact: {
        id: 'bribeContact',
        name: 'Bribe Contact',
        tags: ['downtime', 'secret'],
        cost: 'A bribe worth at least one-tenth of the Currency per Additional PC listed on Table 10–9: Party Treasure by Level. Doubling this amount grants a +2 circumstance bonus to the check.',
        requirements: `You've successfully Gained a Contact.`,
        description: 'You offer a bribe to your contact to help the heist in some way.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'The contact accepts the bribe and you gain 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                fakeDegreeOfSuccess: 'success',
                description: 'You believe you successfully Bribed your Contact and gained 1 EP, but in fact the contact informs the opposition of the attempted bribery, adding 1 AP to the infiltration. The GM can reveal that this Edge Point grants no benefit at any point during the infiltration, as befits the story.',
                awarenessPoints: 1,
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'As failure, but adding 2 AP to the infiltration.',
                awarenessPoints: 2,
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'deception',
                    },
                    '2': {
                        id: '2',
                        skill: 'diplomacy',
                    }
                }
            },
        },
        edgeLabel: "Contact",
        maxAttempts: 1,
    },
    forgeDocuments: {
        id: 'forgeDocuments',
        name: 'Forge Documents',
        tags: ['downtime', 'secret'],
        description: 'You prepare forgeries that might serve as convincing props. Attempt a hard or very hard Society check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You create convincing forgeries and gain 1 EP you can use only when presenting some form of paperwork.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                fakeDegreeOfSuccess: 'success',
                description: 'You create unconvincing documents. You gain 1 EP that (unknown to you) grants no benefit when used.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'As a failure, but a PC who tries to use the Edge Point gets a critical failure, even if they use the Edge Point after rolling a failure.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Forged Documents",
        maxAttempts: 1,
    },
    gainContact: {
        id: 'gainContact',
        name: 'Gain Contact',
        tags: ['downtime'],
        description: 'You try to make contact with an individual who can aid you in the infiltration. Attempt a normal, hard, or very hard DC Diplomacy or Society check, or a check using a Lore skill appropriate to your prospective contact.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You make contact and gain 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You fail to make contact.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                description: 'You insult or spook the contact in some way. Future attempts take a –2 circumstance penalty. <strong>Special</strong> Multiple critical failures might cause the contact to work against the PCs in some way, likely increasing the party’s Awareness Points.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    },
                    '2': {
                        id: '2',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Contact",
        maxAttempts: 1,
    },
    gossip: {
        id: 'gossip',
        name: 'Gossip',
        tags: ['downtime', 'secret'],
        description: 'You seek out rumors about the infiltration’s target. Attempt a normal, hard, or very hard Diplomacy check.',
        results: {
            criticalSuccess: {
                degreeOfSuccess: 'criticalSuccess',
                description: 'You gain inside information about the location or group you’re trying to infiltrate. This grants you a +2 circumstance bonus to future checks you attempt for preparation activities for this infiltration. If you share this information, those you share it with also gain this bonus.',
                inUse: true,
            },
            success: {
                degreeOfSuccess: 'success',
                description: 'You gain inside information about the place or group you’re attempting to infiltrate that aids your planning.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You learn nothing.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                description: 'You hear a few mistaken rumors and take a –2 circumstance penalty to your next check for a preparation activity. Word spreads around that you’re asking after that group or individual, increasing your Awareness Points by 1.',
                awarenessPoints: 1,
                inUse: true,   
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    }
                }
            },
        },
        edgeLabel: "Gossip",
        maxAttempts: 1,
    },
    scoutLocation: {
        id: 'scoutLocation',
        name: 'Scout Location',
        tags: ['downtime', 'secret'],
        description: 'You spend time observing the place or group you wish to infiltrate. Attempt a normal, hard, or very hard DC Perception, Society or Stealth check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You make observations that provide 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You learn nothing particularly noteworthy.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'You misjudge some aspect of what you observed, gaining 1 EP that results in a critical failure instead of a success when used, even if a PC uses the Edge Point after rolling a failure.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    },
                }
            },
        },
        edgeLabel: "Scouting Info",
        maxAttempts: 1,
    },
    secureDisguises: {
        id: 'secureDisguises',
        name: 'Secure Disguises',
        tags: ['downtime'],
        description: 'You seek to procure or create disguises. Attempt a normal, hard, or very hard Crafting, Deception, Performance, or Society check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You procure or creates disguises, gaining 1 EP that can be used only to maintain a cover identity.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'Your efforts result in an unusable disguise.',
                inUse: true,
            },
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'crafting',
                    },
                    '2': {
                        id: '2',
                        skill: 'deception',
                    },
                    '3': {
                        id: '3',
                        skill: 'performance',
                    },
                    '4': {
                        id: '4',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Disguise",
        maxAttempts: 1,
    }
}