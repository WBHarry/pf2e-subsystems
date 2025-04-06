export const MODULE_ID = 'pf2e-subsystems';
export const SOCKET_ID = `module.${MODULE_ID}`;

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
}

export const tourIDs = {
    chase: "pf2e-subsystems-chase",
    research: "pf2e-subsystems-research",
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