// Constants for Quick Play matchmaker feature

const MATCHMAKER_GAMEMODES = [
    { id: '*', name: 'Any' },
    { id: 'ffa', name: 'FFA' },
    { id: 'tdm', name: 'Team Deathmatch' },
    { id: 'ctf', name: 'Capture the Flag' },
    { id: 'hardpoint', name: 'Hardpoint' },
    { id: 'koth', name: 'King of the Hill' },
    { id: 'infected', name: 'Infected' },
    { id: 'race', name: 'Race' },
    { id: 'lms', name: 'Last Man Standing' },
    { id: 'simon', name: 'Simon Says' },
    { id: 'gun_game', name: 'Gun Game' },
    { id: 'prop', name: 'Prop Hunt' },
    { id: 'boss_hunt', name: 'Boss Hunt' },
    { id: 'classic_ffa', name: 'Classic FFA' },
    { id: 'deathmatch', name: 'Deathmatch' },
    { id: 'defuse', name: 'Defuse' },
    { id: 'sharp_shooter', name: 'Sharp Shooter' },
    { id: 'traitor', name: 'Traitor' },
    { id: 'raid', name: 'Raid' },
    { id: 'stalker', name: 'Stalker' },
    { id: 'kr', name: 'Krunker Royale' },
    { id: 'blitz_ffa', name: 'Blitz FFA' }
];

const MATCHMAKER_REGIONS = [
    '*',
    'us-newjersey',
    'us-texas',
    'us-wash',
    'us-california',
    'de-frankfurt',
    'gb-london',
    'sgp',
    'syd',
    'brz',
    'jpn',
    'nl',
    'india'
];

const MATCHMAKER_REGION_NAMES = {
    '*': 'Any',
    'us-newjersey': 'US East',
    'us-texas': 'US Central',
    'us-wash': 'US West',
    'us-california': 'US West 2',
    'de-frankfurt': 'Frankfurt',
    'gb-london': 'London',
    'sgp': 'Singapore',
    'syd': 'Sydney',
    'brz': 'Brazil',
    'jpn': 'Japan',
    'nl': 'Netherlands',
    'india': 'India'
};

module.exports = {
    MATCHMAKER_GAMEMODES,
    MATCHMAKER_REGIONS,
    MATCHMAKER_REGION_NAMES
};
